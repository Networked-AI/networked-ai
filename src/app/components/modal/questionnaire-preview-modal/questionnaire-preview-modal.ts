import { SelectModule } from 'primeng/select';
import { CommonModule } from '@angular/common';
import { Button } from '@/components/form/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ModalService } from '@/services/modal.service';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TextInput } from '@/components/form/text-input';
import { validateFields } from '@/utils/form-validation';
import { ToasterService } from '@/services/toaster.service';
import { NumberInput } from '@/components/form/number-input';
import { MobileInput } from '@/components/form/mobile-input';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import { IonHeader, IonFooter, IonToolbar, ModalController, IonContent } from '@ionic/angular/standalone';
import { Input, signal, inject, Component, OnInit, ChangeDetectionStrategy, computed, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';

interface QuestionnaireQuestionWithPhase {
  question: string;
  type?: string;
  question_type?: string;
  required?: boolean;
  is_required?: boolean;
  visibility?: 'public' | 'private';
  is_public?: boolean;
  options?: (string | { option: string; order?: number })[];
  min?: number;
  max?: number;
  rating?: number;
  rating_scale?: number;
  event_phase?: 'PreEvent' | 'PostEvent';
}

@Component({
  selector: 'app-questionnaire-preview-modal',
  styleUrl: './questionnaire-preview-modal.scss',
  templateUrl: './questionnaire-preview-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent,
    Button,
    IonHeader,
    IonFooter,
    TextInput,
    IonToolbar,
    NumberInput,
    MobileInput,
    SegmentButton,
    CommonModule,
    SelectModule,
    CheckboxModule,
    RadioButtonModule,
    ReactiveFormsModule
  ]
})
export class QuestionnairePreviewModal implements OnInit {
  // inputs
  @Input() isPreviewMode = false;
  @Input() questions: QuestionnaireQuestionWithPhase[] = [];

  // services
  private fb = inject(FormBuilder);
  modalCtrl = inject(ModalController);
  toasterService = inject(ToasterService);
  private modalService = inject(ModalService);

  // form and signals
  form!: FormGroup;
  @ViewChild(MobileInput) mobileInput?: MobileInput;
  selectedPhase = signal<'PreEvent' | 'PostEvent'>('PreEvent');

  preEventQuestions = computed(() => {
    return this.questions.filter((q) => !q.event_phase || q.event_phase === 'PreEvent');
  });

  postEventQuestions = computed(() => {
    return this.questions.filter((q) => q.event_phase === 'PostEvent');
  });

  hasBothPhases = computed(() => {
    return this.preEventQuestions().length > 0 && this.postEventQuestions().length > 0;
  });

  displayedQuestions = computed(() => {
    const phase = this.selectedPhase();
    return phase === 'PreEvent' ? this.preEventQuestions() : this.postEventQuestions();
  });

  segmentItems = computed<SegmentButtonItem[]>(() => {
    return [
      { value: 'PreEvent', label: 'Pre-Event' },
      { value: 'PostEvent', label: 'Post-Event' }
    ];
  });

  hasPrivateQuestions = computed(() => {
    return this.displayedQuestions().some((q) => q.is_public === false || q.visibility === 'private');
  });

  ngOnInit(): void {
    if (this.hasBothPhases()) {
      this.selectedPhase.set('PreEvent');
    } else if (this.postEventQuestions().length > 0) {
      this.selectedPhase.set('PostEvent');
    }
    this.initializeForm();
  }

  onPhaseChange(phase: string): void {
    this.selectedPhase.set(phase as 'PreEvent' | 'PostEvent');
    this.initializeForm();
  }

  initializeForm(): void {
    const formControls: { [key: string]: any } = {};
    const questionsToDisplay = this.displayedQuestions();

    questionsToDisplay.forEach((question, index) => {
      const questionType = question.question_type || question.type || '';
      const isRequired = question.is_required !== undefined ? question.is_required : question.required || false;
      const validators = isRequired ? [Validators.required] : [];

      switch (questionType) {
        case 'Text':
        case 'PhoneNumber':
          formControls[`question_${index}`] = ['', validators];
          break;
        case 'Number':
          const numberValidators = [...validators];
          if (question.min !== undefined) {
            numberValidators.push(Validators.min(question.min));
          }
          if (question.max !== undefined) {
            numberValidators.push(Validators.max(question.max));
          }
          formControls[`question_${index}`] = ['', numberValidators];
          break;
        case 'SingleChoice':
          formControls[`question_${index}`] = ['', validators];
          break;
        case 'MultipleChoice':
          const optionControls = question.options?.map(() => this.fb.control(false)) || [];
          const multipleChoiceArray = this.fb.array(optionControls, isRequired ? [this.atLeastOneSelected] : []);
          formControls[`question_${index}`] = multipleChoiceArray;
          if (this.isPreviewMode) {
            multipleChoiceArray.valueChanges.subscribe(() => {
              multipleChoiceArray.markAsTouched();
            });
          }
          break;
        case 'Rating':
          formControls[`question_${index}`] = ['', validators];
          break;
      }
    });

    this.form = this.fb.group(formControls);

    if (this.isPreviewMode) {
      Object.keys(this.form.controls).forEach((key) => {
        const control = this.form.get(key);
        if (control) {
          control.valueChanges.subscribe(() => {
            control.markAsTouched();
          });
        }
      });
    }
  }

  atLeastOneSelected = (control: AbstractControl) => {
    const formArray = control as FormArray;
    const hasSelection = formArray.controls.some((c) => c.value === true);
    return hasSelection ? null : { atLeastOneRequired: true };
  };

  getQuestionControl(index: number): AbstractControl | null {
    return this.form.get(`question_${index}`);
  }

  getMultipleChoiceArray(index: number): FormArray {
    return this.form.get(`question_${index}`) as FormArray;
  }

  getRatingScale(question: QuestionnaireQuestionWithPhase): number[] {
    const scale = question.rating_scale || question.rating || 10;
    return Array.from({ length: scale }, (_, i) => i + 1);
  }

  selectRating(index: number, rating: number): void {
    const control = this.form.get(`question_${index}`);
    if (control) {
      control.setValue(rating);
      control.markAsTouched();
    }
  }

  isRatingSelected(index: number, rating: number): boolean {
    return this.form.get(`question_${index}`)?.value === rating;
  }

  async dismiss(): Promise<void> {
    if (this.isPreviewMode) {
      await this.modalService.close();
    } else {
      // validate personal info fields
      if (!(await validateFields(this.form, Object.keys(this.form.controls)))) {
        this.toasterService.showError('Please answer all questions to continue.');
        return;
      }
      const questionsToDisplay = this.displayedQuestions();
      const responses = questionsToDisplay.map((question, index) => {
        const control = this.getQuestionControl(index);
        let value = control?.value;
        const questionType = question.question_type || question.type || '';

        if (questionType === 'MultipleChoice') {
          const formArray = this.getMultipleChoiceArray(index);
          value = question.options?.filter((_, i) => formArray.at(i).value) || [];
        }

        if (questionType === 'PhoneNumber') {
          value = this.mobileInput?.getPhoneNumber();
        }

        return {
          question_id: (question as any).id || null,
          question: question.question,
          type: questionType,
          answer: value,
          options: question.options || []
        };
      });
      await this.modalCtrl.dismiss({ responses });
    }
  }
}
