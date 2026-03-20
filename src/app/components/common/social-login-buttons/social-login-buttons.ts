import { ActivatedRoute } from '@angular/router';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { inject, Component, input } from '@angular/core';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { NavigationService } from '@/services/navigation.service';
import { KEYS, LocalStorageService } from '@/services/localstorage.service';

@Component({
  selector: 'social-login-buttons',
  styleUrl: './social-login-buttons.scss',
  templateUrl: './social-login-buttons.html'
})
export class SocialLoginButtons {
  isRsvpModal = input<boolean>(false);
  onLoginSuccess = input<(isNewUser?: boolean) => void>(() => {});

  // services
  route = inject(ActivatedRoute);
  authService = inject(AuthService);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);
  navigationService = inject(NavigationService);
  localStorageService = inject(LocalStorageService);

  private handleLoginSuccess(isNewUser: boolean) {
    if (this.isRsvpModal()) {
      this.onLoginSuccess()(isNewUser);
      return;
    }
    if (isNewUser) {
      const returnTo = this.route.snapshot.queryParams['returnTo'];
      const destination = returnTo || '/';
      this.navigationService.navigateForward(`/profile/setup?returnTo=${encodeURIComponent(destination)}`, true);
      return;
    }
    const returnTo = this.route.snapshot.queryParams['returnTo'];
    const isOnboarded = this.localStorageService.getItem(KEYS.ONBOARDED) === 'true';
    const targetUrl = isOnboarded ? returnTo : `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
    this.navigationService.navigateForward(targetUrl, true);
  }

  async loginWithGoogle() {
    try {
      await this.modalService.openLoadingModal('Signing you in...');
      const { data } = await this.authService.signInWithGoogle();
      this.handleLoginSuccess(data.is_new_user);
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to sign in with Google.');
      this.toasterService.showError(message);
    } finally {
      await this.modalService.close();
    }
  }

  async loginWithApple() {
    try {
      await this.modalService.openLoadingModal('Signing you in...');
      const { data } = await this.authService.signInWithApple();
      this.handleLoginSuccess(data.is_new_user);
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to sign in with Apple.');
      this.toasterService.showError(message);
    } finally {
      await this.modalService.close();
    }
  }

  async loginWithFacebook() {
    try {
      await this.modalService.openLoadingModal('Signing you in...');
      const { data } = await this.authService.signInWithFacebook();
      this.handleLoginSuccess(data.is_new_user);
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to sign in with Facebook.');
      this.toasterService.showError(message);
    } finally {
      await this.modalService.close();
    }
  }
}
