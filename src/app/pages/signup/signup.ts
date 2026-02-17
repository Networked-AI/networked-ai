import { Subscription } from 'rxjs';
import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { Router, ActivatedRoute } from '@angular/router';
import { OtpInput } from '@/components/common/otp-input';
import { validateFields } from '@/utils/form-validation';
import { EmailInput } from '@/components/form/email-input';
import { ToasterService } from '@/services/toaster.service';
import { MobileInput } from '@/components/form/mobile-input';
import { BaseApiService } from '@/services/base-api.service';
import { PasswordInput } from '@/components/form/password-input';
import { NavigationService } from '@/services/navigation.service';
import { IonContent, IonIcon, ModalController } from '@ionic/angular/standalone';
import { SocialLoginButtons } from '@/components/common/social-login-buttons';
import { FormGroup, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { signal, inject, Component, viewChild, OnInit, OnDestroy, Input } from '@angular/core';

interface SignupForm {
  email?: FormControl<string | null>;
  mobile?: FormControl<string | null>;
  password?: FormControl<string | null>;
}

type SignupMethod = 'email' | 'mobile';

@Component({
  selector: 'signup',
  styleUrl: './signup.scss',
  templateUrl: './signup.html',
  imports: [Button, IonIcon, OtpInput, EmailInput, MobileInput, PasswordInput, SocialLoginButtons, ReactiveFormsModule, IonContent]
})
export class Signup implements OnInit, OnDestroy {
  @Input() onSignupSuccess: () => void = () => {};
  @Input() isRsvpModal: boolean = false;
  // services
  router = inject(Router);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  authService = inject(AuthService);
  modalCtrl = inject(ModalController);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);
  navigationService = inject(NavigationService);

  // view child
  mobileInput = viewChild(MobileInput);
  emailInput = viewChild(EmailInput);

  // signals
  isInvalidOtp = signal(false);
  otpSent = signal<boolean>(false);
  phoneNumber = signal<string>('');
  email = signal<string>('');
  otp = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isSubmitted = signal<boolean>(false);
  activeTab = signal<SignupMethod>('email');
  signupForm = signal<FormGroup<SignupForm>>(this.fb.group<SignupForm>({}));

  // subscriptions
  private queryParamsSubscription!: Subscription;

  ngOnInit() {
    if (this.isRsvpModal) return;
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      const method = params.get('method');
      if (method === 'mobile') {
        this.activeTab.set('mobile');
      } else {
        this.activeTab.set('email');
      }
    });
  }

  switchSignupMethod(method: SignupMethod) {
    // don't switch if the method is already active
    if (this.activeTab() === method) return;

    // reset otp state when switching
    this.otp.set(null);
    this.email.set('');
    this.otpSent.set(false);
    this.phoneNumber.set('');
    this.isSubmitted.set(false);

    // set the active tab
    this.activeTab.set(method);

    // navigate to the signup page with the new method
    if (!this.isRsvpModal) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { method },
        queryParamsHandling: 'merge'
      });
    }
  }

  private async sendVerificationCode() {
    if (this.activeTab() === 'email') {
      this.emailInput()?.shouldValidate.set(true);

      // validate email and password
      if (!(await validateFields(this.signupForm(), ['email', 'password']))) {
        this.emailInput()?.shouldValidate.set(false);
        return;
      }

      this.emailInput()?.shouldValidate.set(false);

      const { email, password } = this.signupForm().value;
      if (!email || !password) return;

      // check if account exists (validation is handled by checkIfTaken)
      // if validation passes, account doesn't exist, proceed to send OTP
      try {
        this.isLoading.set(true);
        await this.authService.sendOtp({ email });

        // store email and password for later registration
        this.email.set(email);
        this.otpSent.set(true);
        this.isSubmitted.set(false); // reset submission state for otp input
      } catch (error) {
        const message = BaseApiService.getErrorMessage(error, 'Failed to send verification code.');
        this.toasterService.showError(message);
      } finally {
        this.isLoading.set(false);
      }
    } else {
      // validate mobile
      const mobile = this.mobileInput()?.getPhoneNumber();

      this.mobileInput()?.shouldValidate.set(true);
      if (!(await validateFields(this.signupForm(), ['mobile'])) || !mobile) {
        this.mobileInput()?.shouldValidate.set(false);
        return;
      }

      this.mobileInput()?.shouldValidate.set(false);

      // check if account exists (validation is handled by checkIfTaken)
      // if validation passes, account doesn't exist, proceed to send OTP
      try {
        this.isLoading.set(true);
        await this.authService.sendOtp({ mobile });

        // store phone number for later registration
        this.otpSent.set(true);
        this.phoneNumber.set(mobile);
        this.isSubmitted.set(false); // reset submission state for otp input
      } catch (error) {
        const message = BaseApiService.getErrorMessage(error, 'Failed to send verification code.');
        this.toasterService.showError(message);
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  private async verifyAndRegister() {
    const otp = this.otp();
    if (!otp || otp.length !== 6) {
      this.toasterService.showError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      this.isLoading.set(true);
      await this.modalService.openLoadingModal('Creating your account...');

      if (this.activeTab() === 'email') {
        // verify OTP for email
        const verified = await this.authService.verifyOtp({ email: this.email(), code: otp });
        console.log('verified', verified);
        if (!verified) {
          this.isInvalidOtp.set(true);
          this.toasterService.showError('Invalid OTP for email.');
          return;
        }

        // register with email and password
        const { password } = this.signupForm().value;
        await this.authService.register({ email: this.email(), password: password! });
      } else {
        // verify OTP for mobile
        const verified = await this.authService.verifyOtp({ mobile: this.phoneNumber(), code: otp });
        if (!verified) {
          this.isInvalidOtp.set(true);
          this.toasterService.showError('Invalid OTP for mobile.');
          return;
        }

        // register with mobile
        await this.authService.register({ mobile: this.phoneNumber() });
      }

      // after successful registration, navigate to profile setup
      if (this.isRsvpModal) {
        this.onSignupSuccess();
      } else {
        await this.modalService.close();
        await this.modalService.openPhoneEmailVerifiedModal(this.activeTab());
        this.navigationService.navigateForward('/profile/setup', true);
      }
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Invalid OTP or failed to create account.');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
      await this.modalService.close();
    }
  }

  async signup() {
    this.isSubmitted.set(true);

    if (!this.otpSent()) {
      await this.sendVerificationCode();
    } else {
      await this.verifyAndRegister();
    }
  }

  async resendOtp() {
    try {
      this.isLoading.set(true);

      if (this.activeTab() === 'email') {
        await this.authService.sendOtp({ email: this.email() });
      } else {
        await this.authService.sendOtp({ mobile: this.phoneNumber() });
      }

      this.toasterService.showSuccess('Verification code resent successfully.');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to resend verification code.');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  goToLogin() {
    if (this.isRsvpModal) {
      this.modalCtrl.dismiss();
      this.modalService.openLoginModal();
    } else {
      this.navigationService.navigateForward('/login');
    }
  }

  async goToTerms() {
    if (this.isRsvpModal) {
      await this.modalService.dismissAllModals();
    }

    this.navigationService.navigateForward('/terms');
  }

  async goToPrivacyPolicy() {
    if (this.isRsvpModal) {
      await this.modalService.dismissAllModals();
    }

    this.navigationService.navigateForward('/policy');
  }

  ngOnDestroy() {
    this.queryParamsSubscription?.unsubscribe();
  }
}
