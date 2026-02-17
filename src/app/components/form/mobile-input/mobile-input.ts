import { of } from 'rxjs';
import intlTelInput, { Iti } from 'intl-tel-input';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { UserService } from '@/services/user.service';
import { AuthService } from '@/services/auth.service';
import { availability } from '@/validations/availability';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { FormGroup, Validators, FormBuilder, AbstractControl, ControlContainer, AsyncValidatorFn, ReactiveFormsModule } from '@angular/forms';
import { input, inject, OnInit, signal, Component, ViewChild, ElementRef, afterNextRender, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'mobile-input',
  styleUrl: './mobile-input.scss',
  templateUrl: './mobile-input.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InputIconModule, IconFieldModule, InputTextModule, ReactiveFormsModule],
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true })
    }
  ]
})
export class MobileInput implements OnInit {
  // inputs
  required = input(true);
  isSubmitted = input(true);
  controlName = input('mobile');
  label = input('Mobile Number');
  showVerifiedIcon = input(false);
  checkIfExists = input(false); // for login - shows error if mobile doesn't exist
  checkIfTaken = input(false); // for signup - shows error if mobile is already taken

  // services
  private userService = inject(UserService);
  private authService = inject(AuthService);

  // signals
  isChecking = signal(false);
  shouldValidate = signal(false);

  // variables
  iti!: Iti;
  @ViewChild('mobileNumberInput', { static: false }) mobileNumberInput!: ElementRef;

  constructor(
    private fb: FormBuilder,
    private parentContainer: ControlContainer
  ) {
    // initialize intl-tel-input after the view is ready
    afterNextRender(() => this.initializeIntlTelInput());
  }

  get control(): AbstractControl {
    return this.parentFormGroup.get(this.controlName())!;
  }

  get parentFormGroup(): FormGroup {
    return this.parentContainer.control as FormGroup;
  }

  get isMobileValid(): boolean {
    // if verified icon is not shown, no need to validate
    if (!this.showVerifiedIcon()) return false;

    const control = this.control;
    if (!control || !control.value || this.isChecking()) return false;

    // if there are validation errors, it's invalid
    if (this.getErrorMessage) return false;

    // if control is disabled, return true
    if (control.disabled) return true;

    // // check if phone number is valid using intl-tel-input
    // if (!this.iti.isValidNumber()) return false;

    // if control is enabled, check validity
    return control.valid;
  }

  get getErrorMessage(): string | null {
    const control = this.control;
    if (!control.touched) return null;

    if (control.errors?.['required']) {
      return 'Please enter your mobile number.';
    } else if (control.errors?.['taken']) {
      return 'This mobile number is already taken.';
    } else if (control.errors?.['notFound']) {
      return 'No account found with this mobile number.';
    } else if (!this.iti?.isValidNumber()) {
      return 'Please enter a valid mobile number.';
    } else {
      return null;
    }
  }

  private initializeIntlTelInput(): void {
    // check if input element exists
    if (this.mobileNumberInput) {
      const mobileNumberInput = this.mobileNumberInput.nativeElement;

      // initialize intl-tel-input package
      this.iti = intlTelInput(mobileNumberInput, {
        initialCountry: 'us',
        separateDialCode: true,
        countryOrder: ['us', 'in'],
        loadUtils: () => import('node_modules/intl-tel-input/build/js/utils.js')
      });

      // wait for iti to be fully initialized
      this.iti.promise.then(() => {
        // keep iti in sync with form control
        const subscription = this.control.valueChanges.pipe(debounceTime(100), distinctUntilChanged()).subscribe((val) => {
          if (this.control?.value) this.iti.setNumber(val);
          subscription.unsubscribe();
        });

        // handle country change and trigger validation
        mobileNumberInput.addEventListener('countrychange', () => {
          this.control?.updateValueAndValidity();
        });
      });
    }
  }

  ngOnInit(): void {
    const validators = [];
    if (this.required()) {
      validators.push(Validators.required);
    }

    const asyncValidators: AsyncValidatorFn[] = [];
    if (this.checkIfTaken() || this.checkIfExists()) {
      // create a wrapper validator that only runs when isSubmitted is true and there are no validation errors
      const availabilityValidator = availability(this.userService, this.authService, 'mobile', () => this.getPhoneNumber(), this.checkIfExists());
      asyncValidators.push((control: AbstractControl) => {
        // don't run the API call if shouldValidate flag is false

        if (!this.shouldValidate()) {
          return of(null);
        }

        // don't run the API call if there is an error message
        if (!!this.getErrorMessage) {
          return of(null);
        }

        return availabilityValidator(control);
      });
    }

    // Check if control already exists - preserve value and disabled state (like email-input)
    const existingControl = this.parentFormGroup.get(this.controlName());
    const existingValue = existingControl?.value || '';
    const isDisabled = existingControl?.disabled || false;

    if (existingControl) {
      this.parentFormGroup.removeControl(this.controlName());
    }

    const newControl = this.fb.control(existingValue, {
      validators,
      asyncValidators,
      updateOn: 'change'
    });

    // Restore disabled state if it was disabled
    if (isDisabled) newControl.disable({ emitEvent: false });
    this.parentFormGroup.addControl(this.controlName(), newControl);

    // check username status
    this.control?.statusChanges?.subscribe((status) => {
      this.isChecking.set(status === 'PENDING');
    });

    // check validation if there's an value (edit scenario)
    const subscription = this.control.valueChanges.pipe(debounceTime(100), distinctUntilChanged()).subscribe(() => {
      this.checkValidation();
      subscription.unsubscribe();
    });
  }

  checkValidation(): void {
    this.control.markAsTouched();
    this.control.updateValueAndValidity();
  }

  // allow only integer numbers
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const filteredValue = input.value.replace(/[^0-9]/g, '');

    // update the input value
    input.value = filteredValue;

    // update the form control value to trigger validation with filtered value
    this.control.setValue(filteredValue);
  }

  getPhoneNumber(): string {
    return this.iti?.getNumber();
  }
}
