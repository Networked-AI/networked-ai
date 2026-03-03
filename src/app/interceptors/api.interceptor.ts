import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { environment } from 'src/environments/environment';
import { NavigationService } from '@/services/navigation.service';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { IS_RSVP_FLOW } from '@/interceptors/request-context';

let isLogoutModalOpen = false;
let isPasswordNotSetModalOpen = false;

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const modalService = inject(ModalService);
  const navigationService = inject(NavigationService);

  // URLs that should skip token addition (e.g., login)
  const skipUrls = ['https://api.maptiler.com', 'users/check', 'https://api.openai.com', 'https://api.github.com', 'https://places.googleapis.com'];
  const shouldSkip = skipUrls.some((url) => req.url.includes(url));

  // check if URL is relative (starts with /) and not absolute (starts with http:// or https://)
  const isRelativeUrl = req.url.startsWith('/') && !req.url.startsWith('http://') && !req.url.startsWith('https://');

  // prepend base API URL for relative URLs
  const apiUrl = isRelativeUrl ? `${environment.apiUrl}${req.url}` : req.url;

  // skip token addition if URL is in skip list
  if (shouldSkip) {
    const clonedReq = req.clone({ url: apiUrl });
    return next(clonedReq);
  }

  // get the API token from the first user in the array
  const bearerToken = authService.getCurrentToken();

  // clone the request with base URL and add the Authorization header if token exists
  const clonedReq = bearerToken
    ? req.clone({
        url: apiUrl,
        setHeaders: {
          Authorization: `Bearer ${bearerToken}`
        }
      })
    : req.clone({ url: apiUrl });

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      handleApiError(req, router, error, authService, modalService, navigationService);
      return throwError(() => error);
    })
  );
};

const handleApiError = async (
  req: any,
  router: Router,
  error: HttpErrorResponse,
  authService: AuthService,
  modalService: ModalService,
  navigationService: NavigationService
): Promise<void> => {
  if (error.error?.errorCode === 'TOKEN_EXPIRED' && !isLogoutModalOpen) {
    isLogoutModalOpen = true;

    // Check if already on login page to avoid showing modal unnecessarily
    const isOnLoginPage = router.url.includes('/login');

    if (!isOnLoginPage) {
      try {
        // Open logout modal
        const result = await modalService.openConfirmModal({
          iconPosition: 'center',
          iconBgColor: '#C73838',
          iconName: 'pi-sign-out',
          title: 'Session Expired',
          cancelButtonLabel: 'Cancel',
          confirmButtonColor: 'primary',
          confirmButtonLabel: 'Sign In',
          description: 'Your session has expired. Please sign in again to continue.'
        });

        if (result && result.role === 'confirm') {
          await authService.signOut();
          navigationService.navigateForward('/login');
        }
      } catch (err) {
        console.error('Error handling invalid token:', err);
      } finally {
        // Reset flag after a delay to allow modal to close
        setTimeout(() => (isLogoutModalOpen = false), 500);
      }
    } else {
      // If already on login page, just sign out silently
      authService.signOut();
      isLogoutModalOpen = false;
    }
  } else if (error.error?.errorCode === 'PASSWORD_NOT_SET' && !isPasswordNotSetModalOpen) {
    isPasswordNotSetModalOpen = true;

    try {
      const email = req?.body?.email;
      const isRsvpModalFlow = req?.context?.get?.(IS_RSVP_FLOW) === true;

      // wait 500ms to close the login loading modal
      await new Promise((resolve) => setTimeout(resolve, 500));
      const result = await modalService.openConfirmModal({
        iconName: 'pi-lock',
        iconPosition: 'center',
        iconBgColor: 'linear-gradient(138.06deg, #F5BC61 8.51%, #C89034 48.28%, #9E660A 85.69%)',
        title: 'Forgot password?',
        cancelButtonLabel: 'Close',
        confirmButtonColor: 'primary',
        description: error.error?.message,
        confirmButtonLabel: 'Forgot password'
      });

      if (result?.role === 'confirm') {
        if (isRsvpModalFlow) {
          await modalService.openForgotPasswordModal({
            prefillEmail: email ?? null
          });
        } else {
          await modalService.dismissAllModals();
          const route = email ? `/forgot-password?email=${encodeURIComponent(email)}` : '/forgot-password';
          await navigationService.navigateForward(route, false);
        }
      }
    } catch (err) {
      console.error('Error handling PASSWORD_NOT_SET:', err);
    } finally {
      setTimeout(() => (isPasswordNotSetModalOpen = false), 500);
    }
  }
};
