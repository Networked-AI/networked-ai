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

  // on the server, localStorage is not available, so allow access
  // the guard will run again on the client where localStorage is available
  if (!isPlatformBrowser(platformId)) return true;

  const tokenFromQuery = route.queryParams?.['token'];
  if (tokenFromQuery) {
    try {
      await modalService.openLoadingModal('Signing you in...');
      const response = await authService.login({ bearer_token: tokenFromQuery });
      if (response?.data?.token) {
        localStorageService.setItem(KEYS.ONBOARDED, 'true');
        navCtrl.navigateRoot('/');
        return true;
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
    // only redirect if not already on onboarding page to avoid infinite loop
    if (state.url !== '/onboarding') {
      navCtrl.navigateRoot('/onboarding');
      return false;
    }

    return true; // allow access to onboarding page
  }

  // if already onboarded and trying to access onboarding, redirect to home
  if (state.url === '/onboarding') {
    navCtrl.navigateRoot('/');
    return false;
  }

  return true; // allow access to other routes
};
