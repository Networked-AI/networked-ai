import { SelectModule } from 'primeng/select';
import { TitleCasePipe } from '@angular/common';
import { CheckboxModule } from 'primeng/checkbox';
import { Button } from '@/components/form/button';
import { InputTextModule } from 'primeng/inputtext';
import { ModalService } from '@/services/modal.service';
import { TextInput } from '@/components/form/text-input';
import { NumberInput } from '@/components/form/number-input';
import { Component, Input, inject, signal } from '@angular/core';
import { IonReorder, IonReorderGroup, ItemReorderEventDetail, ModalController } from '@ionic/angular/standalone';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, FormControl, AbstractControl } from '@angular/forms';
@Component({
  selector: 'questionnaire-form-modal',
  templateUrl: './questionnaire-form-modal.html',
  styleUrl: './questionnaire-form-modal.scss',
  imports: [
    Button,
    TextInput,
    IonReorder,
    NumberInput,
    SelectModule,
    TitleCasePipe,
    CheckboxModule,
    IonReorderGroup,
    InputTextModule,
    ReactiveFormsModule
  ]
})
export class QuestionnaireFormModal {
  fb = inject(FormBuilder);
  modalService = inject(ModalService);
  modalCtrl = inject(ModalController);
  @Input() type: 'pre-event' | 'post-event' = 'pre-event';
  @Input() initialData: any;

  showSelectionBox = signal(false);

  form = this.fb.group({
    questions: this.fb.array([])
  });

  ngOnInit(): void {
    if (this.initialData && this.initialData.length) {
      const questionFormGroups = this.initialData.map((q: any) => {
        const isRequired = q.is_required !== undefined ? q.is_required : q.required || false;
        const visibility = q.is_public !== undefined ? (q.is_public ? 'public' : 'private') : q.visibility || 'public';

        return this.fb.group({
          id: [q.id || `question-${Date.now()}-${Math.random()}`, Validators.required],
          question: [q.question, Validators.required],
          type: [q.question_type || q.type, Validators.required],
          required: [isRequired],
          visibility: [visibility],
          options: this.fb.array(
            q.options ? q.options.map((opt: any) => {
              const optionValue = typeof opt === 'object' && opt.option ? opt.option : opt;
              const optionId = typeof opt === 'object' && opt.id ? opt.id : null;
              return this.fb.group({
                id: [optionId],
                value: [optionValue, Validators.required]
              });
            }) : []
          ),
          min: [q.min || null],
          max: [q.max || null],
          rating_scale: [q.rating_scale || null]
        });
      });

      this.form.setControl('questions', this.fb.array(questionFormGroups));
    } else {
      this.addQuestion();
    }
  }

  get questions() {
    return this.form.get('questions') as FormArray;
  }

  get filteredQuestionTypes() {
    return this.questionTypes.filter((q) => {
      if (this.type === 'pre-event') {
        return q.value !== 'Rating';
      }
      return true;
    });
  }

  questionTypes = [
    {
      label: 'Text Field',
      value: 'Text',
      image: 'textInputIcon.svg',
      description: 'Allows attendees to input free text answer.'
    },
    {
      label: 'Number Input',
      value: 'Number',
      image: 'numberInputIcon.svg',
      description: 'Allows attendees to input numbers only.'
    },
    {
      label: 'Single Choice',
      value: 'SingleChoice',
      image: 'choiceInputIcon.svg',
      description: 'Allows attendees to select an option.'
    },
    {
      label: 'Multiple Choice',
      value: 'MultipleChoice',
      image: 'choiceInputIcon.svg',
      description: 'Allows attendees to select multiple options.'
    },
    {
      label: 'phone number',
      value: 'PhoneNumber',
      icon: 'phone',
      description: 'Allows attendees to input their phone number.'
    },
    {
      label: '1-10 Rating',
      value: 'Rating',
      image: 'choiceInputIcon.svg',
      description: 'Allows attendees to rate the event .'
    }
  ];

  visibilityOptions = [
    { label: 'Public', value: 'public', description: "Attendees can see other's answers." },
    { label: 'Private', value: 'private', description: 'Answer only visible to event host.' }
  ];

  close() {
    this.modalService.close();
  }

  createQuestion(type: string): FormGroup {
    const base = {
      id: new FormControl(),
      type: new FormControl(type, Validators.required),
      question: new FormControl('', Validators.required),
      required: new FormControl(false),
      visibility: new FormControl('public')
    };

    if (type === 'SingleChoice' || type === 'MultipleChoice') {
      return this.fb.group({
        ...base,
        options: this.fb.array([
          this.fb.group({ id: [null], value: ['', Validators.required] }),
          this.fb.group({ id: [null], value: ['', Validators.required] })
        ])
      });
    }
    if (type === 'Number') {
      return this.fb.group({
        ...base,
        min: new FormControl(null),
        max: new FormControl(null)
      });
    }

    if (type === 'Rating') {
      return this.fb.group({
        ...base,
        rating_scale: new FormControl(null)
      });
    }

    return this.fb.group(base);
  }

  selectType(type: string) {
    const q = this.createQuestion(type);
    this.questions.push(q);
    this.showSelectionBox.set(false);
  }

  addQuestion() {
    this.showSelectionBox.set(true);
  }

  changeType(index: number, type: string) {
    const newQuestion = this.createQuestion(type);
    this.questions.setControl(index, newQuestion);
  }

  getOptions(q: any): FormArray {
    return q.get('options') as FormArray;
  }

  addOption(qIndex: number) {
    this.getOptions(this.questions.at(qIndex)).push(
      this.fb.group({ id: [null], value: ['', Validators.required] })
    );
  }

  removeOption(qIndex: number, optIndex: number) {
    this.getOptions(this.questions.at(qIndex)).removeAt(optIndex);
  }

  deleteQuestion(idx: number) {
    if (idx >= 0 && idx < this.questions.length) {
      this.questions.removeAt(idx);
      if (this.questions.length === 0) {
        this.showSelectionBox.set(true);
      }
    }
  }

  save() {
    const formValue = this.form.value;
    const questions = (formValue.questions || []).map((q: any) => {
      const question: any = {
        id: q.id,
        question: q.question,
        event_phase: this.type === 'pre-event' ? 'PreEvent' : 'PostEvent',
        question_type: q.type,
        is_required: q.required || false,
        is_public: q.visibility === 'public'
      };

      if (q.type === 'SingleChoice' || q.type === 'MultipleChoice') {
        question.options = (q.options || [])
          .filter((opt: any) => opt.value && opt.value.trim() !== '')
          .map((opt: any, optIndex: number) => {
            return opt.id
              ? { id: opt.id, option: opt.value, order: optIndex + 1 }
              : { option: opt.value, order: optIndex + 1 };
          });
      }

      if (q.type === 'Number') {
        if (q.min !== null && q.min !== undefined) {
          question.min = Number(q.min);
        }
        if (q.max !== null && q.max !== undefined) {
          question.max = Number(q.max);
        }
      }

      if (q.type === 'Rating' && q.rating_scale !== null && q.rating_scale !== undefined) {
        question.rating_scale = Number(q.rating_scale);
      }

      return question;
    });

    this.modalCtrl.dismiss({ questions });
  }

  reorderQuestions(event: CustomEvent<ItemReorderEventDetail>) {
    const reorderedQuestions = event.detail.complete(this.questions.controls as unknown as FormGroup[]);
    this.form.setControl('questions', this.fb.array(reorderedQuestions));
  }

  reorderOptions(questionIndex: number, event: CustomEvent<ItemReorderEventDetail>) {
    event.detail.complete(this.getOptions(this.questions.at(questionIndex)).controls as unknown as FormControl[]);
    event.detail.complete();
  }

  isNumberInvalid(q: AbstractControl): boolean {
    if (!q || q.get('type')?.value !== 'Number') return false;

    const min = q.get('min')?.value;
    const max = q.get('max')?.value;

    const oneMissing = (min !== null && max === null) || (min === null && max !== null);

    const invalidNumber = isNaN(min) || isNaN(max);

    const wrongOrder = min !== null && max !== null && min >= max;

    return oneMissing || invalidNumber || wrongOrder;
  }

  isRatingInvalid(q: FormGroup): boolean {
    return q.get('type')?.value === 'Rating' && !q.get('rating_scale')?.value;
  }

  areOptionsInvalid(q: AbstractControl): boolean {
    if (!['SingleChoice', 'MultipleChoice'].includes(q.get('type')?.value)) return false;
    const options = q.get('options') as FormArray;
    return options.controls.some((opt) => !opt.get('value')?.value || opt.get('value')?.value.trim() === '');
  }
  isFormInvalid(): boolean {
    const qArray = this.questions.controls as FormGroup[];
    return this.form.invalid || qArray.some((q) => this.isNumberInvalid(q) || this.isRatingInvalid(q) || this.areOptionsInvalid(q));
  }
}
