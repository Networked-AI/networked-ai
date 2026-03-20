import { CanActivateFn } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavController } from '@ionic/angular/standalone';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { KEYS, LocalStorageService } from '@/services/localstorage.service';

export const tokenLoginGuard: CanActivateFn = async (route) => {
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

  return true; // token login failed — still show the page
};