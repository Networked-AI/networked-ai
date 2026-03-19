import { Subscription } from 'rxjs';
import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { OtpInput } from '@/components/common/otp-input';
import { validateFields } from '@/utils/form-validation';
import { Router, ActivatedRoute } from '@angular/router';
import { EmailInput } from '@/components/form/email-input';
import { ToasterService } from '@/services/toaster.service';
import { MobileInput } from '@/components/form/mobile-input';
import { BaseApiService } from '@/services/base-api.service';
import { PasswordInput } from '@/components/form/password-input';
import { NavigationService } from '@/services/navigation.service';
import { SocialLoginButtons } from '@/components/common/social-login-buttons';
import { IonContent, IonIcon, ModalController } from '@ionic/angular/standalone';
import { FormGroup, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { signal, inject, Component, viewChild, OnDestroy, Input, AfterViewInit } from '@angular/core';
import { KEYS, LocalStorageService } from '@/services/localstorage.service';

interface LoginForm {
  email?: FormControl<string | null>;
  mobile?: FormControl<string | null>;
  password?: FormControl<string | null>;
}

type LoginMethod = 'email' | 'mobile';

@Component({
  selector: 'login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
  imports: [Button, IonIcon, OtpInput, EmailInput, MobileInput, PasswordInput, SocialLoginButtons, ReactiveFormsModule, IonContent]
})
export class Login implements OnDestroy, AfterViewInit {
  @Input() onLoginSuccess: (isNewUser?: boolean) => void = () => {};
  @Input() isRsvpModal: boolean = false;
  @Input() prefillEmail: string | null = null;
  // services
  router = inject(Router);
  fb = inject(FormBuilder);
  route = inject(ActivatedRoute);
  authService = inject(AuthService);
  modalCtrl = inject(ModalController);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);
  navigationService = inject(NavigationService);
  localStorageService = inject(LocalStorageService);

  // view child
  mobileInput = viewChild(MobileInput);
  emailInput = viewChild(EmailInput);

  // signals
  isInvalidOtp = signal(false);
  otpSent = signal<boolean>(false);
  phoneNumber = signal<string>('');
  otp = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  isSubmitted = signal<boolean>(false);
  activeTab = signal<LoginMethod>('email');
  loginForm = signal<FormGroup<LoginForm>>(this.fb.group<LoginForm>({}));

  // subscriptions
  private queryParamsSubscription!: Subscription;

  ngAfterViewInit() {
    if (this.prefillEmail) {
      this.activeTab.set('email');
      this.loginForm().patchValue({ email: this.prefillEmail });
    }

    if (this.isRsvpModal) return;

    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      const email = params.get('email');
      const method = params.get('method');
      const password = params.get('password');

      if (method === 'mobile') {
        this.activeTab.set('mobile');
      } else {
        this.activeTab.set('email');
      }

      // auto fille credentials and login (for forgot password email)
      if (email && password) {
        this.loginForm().patchValue({ email, password });
        this.loginWithEmail();
      }
    });
  }

  switchLoginMethod(method: LoginMethod) {
    // don't switch if the method is already active
    if (this.activeTab() === method) return;

    // reset otp state when switching back to phone input
    if (method === 'mobile') {
      this.otp.set(null);
      this.otpSent.set(false);
      this.phoneNumber.set('');
      this.isSubmitted.set(false);
    }

    // set the active tab
    this.activeTab.set(method);

    if (!this.isRsvpModal) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { method },
        queryParamsHandling: 'merge'
      });
    }
  }

  private async loginWithEmail() {
    try {
      this.emailInput()?.shouldValidate.set(true);

      // validate email and password
      if (!(await validateFields(this.loginForm(), ['email', 'password']))) {
        this.emailInput()?.shouldValidate.set(false);
        return;
      }

      this.emailInput()?.shouldValidate.set(false);

      // set loading state
      this.isLoading.set(true);
      await this.modalService.openLoadingModal('Signing you in...');

      // login with email and password
      const { email, password } = this.loginForm().value;
      await this.authService.login({ email: email!, password: password! }, { isRsvpModal: this.isRsvpModal });
      if (this.isRsvpModal) {
        this.onLoginSuccess(false);
      } else {
        const returnTo = this.route.snapshot.queryParams['returnTo'];
        this.navigateAfterAuth(returnTo);
      }
      await this.modalService.close();
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to login.');
      this.toasterService.showError(message);
      if (message) await this.modalService.close();
    } finally {
      this.isLoading.set(false);
      if (!this.isRsvpModal) await this.modalService.close();
    }
  }

  private async sendOtp() {
    console.log('sendOtp');
    // Enable async validation on mobile input before validation
    this.mobileInput()?.shouldValidate.set(true);

    // get full phone number and validate phone number
    const mobile = this.mobileInput()?.getPhoneNumber();
    if (!(await validateFields(this.loginForm(), ['mobile'])) || !mobile) {
      this.mobileInput()?.shouldValidate.set(false);
      return;
    }

    // Disable async validation after successful validation
    this.mobileInput()?.shouldValidate.set(false);

    try {
      this.isLoading.set(true);
      await this.authService.sendOtp({ mobile });

      // store phone number and create masked version
      this.otpSent.set(true);
      this.phoneNumber.set(mobile);
      this.isSubmitted.set(false); // reset submission state for otp input
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to send OTP.');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async verifyOtp() {
    const otp = this.otp();
    if (!otp || otp.length !== 6) {
      this.toasterService.showError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      this.isLoading.set(true);
      await this.modalService.openLoadingModal('Signing you in...');
      await this.authService.login({ mobile: this.phoneNumber(), otp });
      if (this.isRsvpModal) {
        this.onLoginSuccess(false);
      } else {
        const returnTo = this.route.snapshot.queryParams['returnTo'];
        this.navigateAfterAuth(returnTo);
      }
    } catch (error) {
      this.isInvalidOtp.set(true);
      const message = BaseApiService.getErrorMessage(error, 'Invalid or expired OTP.');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
      await this.modalService.close();
    }
  }

  async login() {
    this.isSubmitted.set(true);

    if (this.activeTab() === 'email') {
      await this.loginWithEmail();
    } else {
      if (!this.otpSent()) {
        await this.sendOtp();
      } else {
        await this.verifyOtp();
      }
    }
  }

  async resendOtp() {
    if (!this.phoneNumber()) return;

    try {
      this.isLoading.set(true);
      await this.authService.sendOtp({ mobile: this.phoneNumber() });
      this.toasterService.showSuccess('OTP resent successfully.');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to resend OTP.');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  async goToSignup(): Promise<void> {
    if (this.isRsvpModal) {
      await this.modalService.openSignupModal();
    } else {
      const returnTo = this.route.snapshot.queryParams['returnTo'];
      const route = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup';
      this.navigationService.navigateForward(route, true);
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

  async goToForgotPassword() {
    const email = this.loginForm().get('email')?.value ?? null;

    if (this.isRsvpModal) {
      await this.modalService.openForgotPasswordModal({
        prefillEmail: email
      });
      return;
    }

    // Normal flow (non-RSVP login page)
    const route = email ? `/forgot-password?email=${encodeURIComponent(email)}` : '/forgot-password';

    await this.navigationService.navigateForward(route, false);
  }

  ngOnDestroy() {
    this.queryParamsSubscription?.unsubscribe();
  }

  navigateAfterAuth(returnTo?: string): void {
    const isOnboarded = this.localStorageService.getItem(KEYS.ONBOARDED) === 'true';
    const destination = returnTo || '/';

    if (!isOnboarded) {
      this.navigationService.navigateForward(`/onboarding?returnTo=${encodeURIComponent(destination)}`, true);
    } else {
      this.navigationService.navigateForward(destination, true);
    }
  }
}
