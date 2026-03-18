import { ActivatedRoute, CanActivateFn, Router } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavController } from '@ionic/angular/standalone';
import { KEYS, LocalStorageService } from '@/services/localstorage.service';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { BaseApiService } from '@/services/base-api.service';
import { ToasterService } from '@/services/toaster.service';

export const onboardingGuard: CanActivateFn = async (route, state) => {
  const navCtrl = inject(NavController);
  const platformId = inject(PLATFORM_ID);
  const localStorageService = inject(LocalStorageService);
  const authService = inject(AuthService);
  const modalService = inject(ModalService);
  const toasterService = inject(ToasterService);

  if (!isPlatformBrowser(platformId)) return true;

  const tokenFromQuery = route.queryParams?.['token'];
  const eventIdFromQuery = route.queryParams?.['eventId'];

  if (tokenFromQuery) {
    try {
      await modalService.openLoadingModal('Signing you in...');
      const response = await authService.login({ bearer_token: tokenFromQuery });
      if (response?.data?.token) {
        localStorageService.setItem(KEYS.ONBOARDED, 'true');

        // ✅ redirect based on eventId
        if (eventIdFromQuery) {
          navCtrl.navigateRoot(`/event/${eventIdFromQuery}`);
        } else {
          navCtrl.navigateRoot('/');
        }

        return false; // navigation already handled
      }
    } catch (error) {
      console.error('Token login failed:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to login.');
      toasterService.showError(message);
    } finally {
      await modalService.close();
    }
  }

  // check if user has completed onboarding
  const onboarded = localStorageService.getItem(KEYS.ONBOARDED);

  // if not onboarded, redirect to onboarding page
  if (!onboarded || onboarded !== 'true') {
    // ✅ Extract path only (ignore query params) to avoid infinite loop
    const urlPath = state.url.split('?')[0];
    if (urlPath !== '/onboarding') {
      const returnTo = encodeURIComponent(state.url);
      navCtrl.navigateRoot(`/onboarding?returnTo=${returnTo}`);
      return false;
    }
    return true;
  }

  // if already onboarded and trying to access onboarding, redirect to home
  if (state.url.split('?')[0] === '/onboarding') {
    navCtrl.navigateRoot('/');
    return false;
  }

  return true; // allow access to other routes
};
