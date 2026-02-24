import { IconField } from 'primeng/iconfield';
import { DatePipe } from '@angular/common';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { IonIcon } from '@ionic/angular/standalone';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { input, OnInit, inject, Component, ChangeDetectionStrategy, ChangeDetectorRef, SimpleChanges } from '@angular/core';
import { FormGroup, Validators, FormBuilder, AbstractControl, ControlContainer, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'text-input',
  styleUrl: './text-input.scss',
  templateUrl: './text-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon, IconField, InputIcon, InputTextModule, ReactiveFormsModule],
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true })
    }
  ]
})
export class TextInput implements OnInit {
  // inputs
  label = input('');
  iconName = input('');
  required = input(true);
  placeholder = input('');
  endIconName = input('');
  showLabel = input(true);
  readonly = input(false);
  isSubmitted = input(true);
  controlName = input.required<string>();
  initialValue = input<string | number>('');
  type = input<'text' | 'date' | 'time'>('text');
  displayValue = '';

  private datePipe = new DatePipe('en-US');
  private cdr = inject(ChangeDetectorRef);

  constructor(
    private fb: FormBuilder,
    private parentContainer: ControlContainer
  ) {}

  get control(): AbstractControl {
    return this.parentFormGroup.get(this.controlName())!;
  }

  get parentFormGroup(): FormGroup {
    return this.parentContainer.control as FormGroup;
  }

  get getPlaceholder(): string {
    return this.placeholder() || `Enter ${this.label().toLowerCase()}`;
  }

  get isControlInvalid(): boolean {
    return !this.control?.valid && this.control?.touched && this.required() && this.isSubmitted();
  }

  ngOnInit(): void {
    const validators = this.required() ? [Validators.required] : [];

    this.parentFormGroup.addControl(this.controlName(), this.fb.control(this.initialValue(), validators));

    setTimeout(() => {
      this.updateDisplayValue(this.control.value);
      this.checkValidation();
      this.cdr.markForCheck();
    }, 0);

    this.control.valueChanges.pipe(distinctUntilChanged()).subscribe((value) => {
      this.updateDisplayValue(value);
      this.checkValidation();
      this.cdr.markForCheck();
    });
  }

  onInputChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.control.setValue(value);
  }

  checkValidation(): void {
    this.control.markAsTouched();
    this.control.updateValueAndValidity();
  }

  private updateDisplayValue(value: any): void {
    if (!value) {
      this.displayValue = '';
      return;
    }

    if (this.type() === 'date') {
      this.displayValue = this.datePipe.transform(value, 'dd MMMM yyyy') ?? '';
      return;
    }

    if (this.type() === 'time') {
      const time = value.includes('T') ? new Date(value) : new Date(`1970-01-01T${value}`);

      this.displayValue = this.datePipe.transform(time, 'hh:mm a') ?? '';
      return;
    }

    this.displayValue = value;
  }
}
