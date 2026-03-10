import { Button } from '@/components/form/button';
import { EmailInput } from '@/components/form/email-input';
import { MobileInput } from '@/components/form/mobile-input';
import { TextInput } from '@/components/form/text-input';
import { UsernameInput } from '@/components/form/username-input';
import { PasswordInput } from '@/components/form/password-input';
import { ToasterService } from '@/services/toaster.service';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { UserService } from '@/services/user.service';
import { validateFields } from '@/utils/form-validation';
import { ActivatedRoute, Router } from '@angular/router';
import { NavigationService } from '@/services/navigation.service';
import { signal, computed, inject, Component, ChangeDetectionStrategy, OnInit, viewChild, ChangeDetectorRef } from '@angular/core';
import { IonHeader, IonToolbar, IonContent, NavController } from '@ionic/angular/standalone';
import { FormGroup, FormBuilder, ReactiveFormsModule, FormControl, Validators } from '@angular/forms';

type AccountInfoType = 'email' | 'phone' | 'username' | 'password';

interface ChangeAccountInfoForm {
  currentValue?: FormControl<string | null>;
  newValue?: FormControl<string | null>;
  confirmNewValue?: FormControl<string | null>;
}

@Component({
  selector: 'change-account-info',
  styleUrl: './change-account-info.scss',
  templateUrl: './change-account-info.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, EmailInput, MobileInput, TextInput, UsernameInput, PasswordInput, IonHeader, IonToolbar, IonContent, ReactiveFormsModule]
})
export class ChangeAccountInfo implements OnInit {
  // services
  private fb = inject(FormBuilder);
  navigationService = inject(NavigationService);
  private route = inject(ActivatedRoute);
  private toasterService = inject(ToasterService);
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private userService = inject(UserService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef);

  emailInput = viewChild<EmailInput>('newEmailInput');
  mobileInput = viewChild<MobileInput>('newPhoneInput');
  usernameInput = viewChild<UsernameInput>('newUsernameInput');

  // signals
  type = signal<AccountInfoType>('email');
  currentValue = signal('');
  hasCurrentValue = signal(false);
  isLoading = signal(false);
  isSubmitted = signal(false);
  form = signal<FormGroup<ChangeAccountInfoForm>>(
    this.fb.group<ChangeAccountInfoForm>({
      currentValue: this.fb.control<string | null>(''),
      newValue: this.fb.control<string | null>(''),
      confirmNewValue: this.fb.control<string | null>('')
    })
  );
  wrongCurrentPassword = signal(false);
  passwordsDontMatch = signal(false);

  // computed
  isEmail = computed(() => this.type() === 'email');
  isPhone = computed(() => this.type() === 'phone');
  isUsername = computed(() => this.type() === 'username');
  isPassword = computed(() => this.type() === 'password');
  title = computed(() => {
    if (this.isEmail()) return 'Update Your Email';
    if (this.isPhone()) return 'Update Your Phone Number';
    if (this.isPassword()) return 'Change Password';
    return 'Update Your Username';
  });
  currentLabel = computed(() => {
    if (this.isEmail()) return 'Current Email';
    if (this.isPhone()) return 'Current Phone Number';
    if (this.isPassword()) return 'Current Password';
    return 'Current Username';
  });
  newLabel = computed(() => {
    const prefix = this.hasCurrentValue() ? 'New' : 'Set';
    if (this.isEmail()) return `${prefix} Email`;
    if (this.isPhone()) return `${prefix} Phone Number`;
    if (this.isPassword()) return 'New Password';
    return `${prefix} Username`;
  });
  confirmButtonLabel = computed(() => {
    if (this.isUsername()) return 'Confirm and Save';
    if (this.isPassword()) return 'Save';
    return 'Confirm';
  });
  showCurrentValue = computed(() => {
    return this.hasCurrentValue() && !this.isPassword();
  });

  async ngOnInit(): Promise<void> {
    // Get type from route params
    const typeParam = this.route.snapshot.paramMap.get('type') as AccountInfoType;
    if (typeParam && ['email', 'phone', 'username', 'password'].includes(typeParam)) {
      this.type.set(typeParam);
    }

    // Get navigation state
    const navigation = this.router.currentNavigation();
    const state: any = navigation?.extras?.state;

    // Get current user data and set current value based on type
    const currentUser = await this.userService.getCurrentUser();
    const valueMap: Record<AccountInfoType, string | null | undefined> = {
      email: currentUser?.email,
      phone: currentUser?.mobile,
      username: currentUser?.username,
      password: null
    };

    const currentVal = valueMap[this.type()];
    if (currentVal) {
      this.currentValue.set(currentVal);
      this.hasCurrentValue.set(true);
    }

    this.initializeForm();

    // ✅ Patch password if passed from navigation
    if (this.isPassword() && state?.password) {
      this.form().patchValue({
        currentValue: state.password
      });
    }
  }

  private initializeForm(): void {
    // Keep the same FormGroup instance; just update values/state.
    const form = this.form();

    const currentVal = this.hasCurrentValue() ? this.currentValue() : '';
    form.get('currentValue')?.setValue(currentVal, { emitEvent: false });

    // Disable currentValue control if it has a value (similar to edit-profile pattern)
    if (this.hasCurrentValue()) {
      form.get('currentValue')?.disable({ emitEvent: false });
    } else {
      form.get('currentValue')?.enable({ emitEvent: false });
    }
  }

  async onConfirm(): Promise<void> {
    this.isSubmitted.set(true);
    this.wrongCurrentPassword.set(false);
    this.passwordsDontMatch.set(false);

    const form = this.form();

    // Handle password change separately
    if (this.isPassword()) {
      const password = form.get('currentValue')?.value || '';
      const new_password = form.get('newValue')?.value || '';
      const confirm_password = form.get('confirmNewValue')?.value;

      // Validate password fields
      if (!(await validateFields(form, ['currentValue', 'newValue', 'confirmNewValue']))) {
        return;
      }

      // Check if passwords match
      if (new_password !== confirm_password) {
        this.passwordsDontMatch.set(true);
        return;
      }

      try {
        this.isLoading.set(true);
        // TODO: Implement API call to change password
        await this.authService.changePassword(password, new_password);

        // Show success modal
        await this.modalService.openSuccessModal({
          title: 'Password Successfully Updated',
          description: "You've updated your password. Use this for login next time.",
          buttonLabel: 'Close',
          navigateBack: true
        });
      } catch (error: any) {
        console.error('Error changing password:', error);
        this.toasterService.showError(error.message || 'Failed to change password. Please try again.');
      } finally {
        this.isLoading.set(false);
      }
      return;
    }

    // Handle email, phone, and username
    const fields = ['newValue'];

    // Validate form based on type
    if (this.isEmail() || this.isPhone() || this.isUsername()) {
      this.emailInput()?.shouldValidate.set(true);
      this.mobileInput()?.shouldValidate.set(true);
      this.usernameInput()?.shouldValidate.set(true);

      if (!(await validateFields(form, fields))) {
        this.emailInput()?.shouldValidate.set(false);
        this.mobileInput()?.shouldValidate.set(false);
        this.usernameInput()?.shouldValidate.set(false);
        return;
      }

      this.emailInput()?.shouldValidate.set(false);
      this.mobileInput()?.shouldValidate.set(false);
      this.usernameInput()?.shouldValidate.set(false);
    }

    // Get new value
    let newValue: string | null | undefined;
    if (this.isPhone()) {
      newValue = this.mobileInput()?.getPhoneNumber();
    } else {
      newValue = form.get('newValue')?.value;
    }

    if (!newValue) {
      return;
    }

    // Check if new value is different from current (only if current value exists)
    if (this.hasCurrentValue() && newValue === this.currentValue()) {
      const errorMessages: Record<AccountInfoType, string> = {
        email: 'New email must be different from current email.',
        phone: 'New phone number must be different from current phone number.',
        username: 'New username must be different from current username.',
        password: ''
      };
      this.toasterService.showError(errorMessages[this.type()]);
      return;
    }

    try {
      this.isLoading.set(true);

      if (this.isEmail()) {
        // Send OTP to new email
        await this.authService.sendOtp({ email: newValue });
        this.navigationService.navigateForward('/settings/verify-otp', false, {
          email: newValue,
          type: 'email',
          successTitle: 'Email Successfully Updated',
          successDescription: "You've verified your new email address. Use this for quick login next time."
        });
      } else if (this.isPhone()) {
        // Send OTP to new phone number
        await this.authService.sendOtp({ mobile: newValue });
        this.navigationService.navigateForward('/settings/verify-otp', false, {
          mobile: newValue,
          type: 'phone',
          successTitle: 'Phone Number Successfully Updated',
          successDescription: "You've verified your new phone number. Use this for quick login next time."
        });
      } else {
        // Username - direct update (no OTP)
        const payload = this.userService.generateUserPayload({ username: newValue });
        await this.userService.updateCurrentUser(payload);

        await this.modalService.openSuccessModal({
          title: 'Username Successfully Updated',
          description: "You've updated your username.",
          buttonLabel: 'Close',
          navigateBack: true
        });
      }
    } catch (error: any) {
      console.error(`Error updating ${this.type()}:`, error);
      const errorMsg = error.message || `Failed to update ${this.type()}. Please try again.`;
      this.toasterService.showError(errorMsg);
    } finally {
      this.isLoading.set(false);
    }
  }
}
