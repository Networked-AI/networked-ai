import {
  input,
  signal,
  OnInit,
  inject,
  Component,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  afterNextRender
} from '@angular/core';
import { ModalService } from '@/services/modal.service';
import { FormGroup, Validators, FormBuilder, AbstractControl, ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { HapticService } from '@/services/haptic.service';
@Component({
  imports: [ReactiveFormsModule],
  selector: 'profile-image-input',
  styleUrl: './profile-image-input.scss',
  templateUrl: './profile-image-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true })
    }
  ]
})
export class ProfileImageInput implements OnInit {
  // inputs
  label = input('');
  required = input(true);
  isSubmitted = input(true);
  controlName = input.required<string>();

  hapticService = inject(HapticService);
  // signals
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);

  // variables
  private objectUrl: string | null = null;

  @ViewChild('fileInput', { static: false }) fileInputRef!: ElementRef<HTMLInputElement>;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private modalService: ModalService,
    private parentContainer: ControlContainer
  ) {
    afterNextRender(() => this.updateImagePreview(this.control.value));
  }

  get control(): AbstractControl {
    return this.parentFormGroup.get(this.controlName())!;
  }

  get parentFormGroup(): FormGroup {
    return this.parentContainer.control as FormGroup;
  }

  get isControlInvalid(): boolean {
    return !this.control?.valid && this.control?.touched && this.required() && this.isSubmitted();
  }

  removeImage(): void {
    this.control.setValue(null);
    this.control.markAsTouched();
    this.updateImagePreview(null);
  }

  ngOnInit(): void {
    const validators = this.required() ? [Validators.required] : [];
    this.parentFormGroup.addControl('thumbnail_url', this.fb.control(null, validators));
    this.parentFormGroup.addControl(this.controlName(), this.fb.control(null, validators));

    this.updateImagePreview(this.control.value);

    this.control.valueChanges.subscribe((value) => {
      this.updateImagePreview(value);
      this.cdr.markForCheck();
    });
  }

  private updateImagePreview(value: any): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    if (!value) {
      this.imagePreview.set(null);
      this.selectedFile.set(null);
      return;
    }

    if (value instanceof File) {
      this.selectedFile.set(value);
      this.objectUrl = URL.createObjectURL(value);
      this.imagePreview.set(this.objectUrl);
    } else if (typeof value === 'string') {
      this.selectedFile.set(null);
      this.imagePreview.set(value);
    } else {
      this.imagePreview.set(null);
      this.selectedFile.set(null);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const result = await this.modalService.showProfileImageConfirmationModal(file);

      if (result.action === 'confirm' && result.file) {
        this.control.setValue(result.file);
        this.control.markAsTouched();
      } else if (result.action === 'retake') {
        setTimeout(() => {
          if (this.fileInputRef?.nativeElement) {
            this.fileInputRef.nativeElement.click();
          }
        }, 100);
      }
    }

    input.value = '';
  }
}
