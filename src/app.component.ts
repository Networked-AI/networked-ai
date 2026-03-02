import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';
import { HapticService } from '@/services/haptic.service';
import { SocketService } from '@/services/socket.service';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { NavigationService } from '@/services/navigation.service';
import { LiveUpdateService } from '@/services/live-update.service';
import { PermissionsService } from '@/services/permissions.service';
import { PushNotificationService } from '@/services/push-notification.service';
import { inject, effect, Component, viewChild, PLATFORM_ID } from '@angular/core';
import { AppUpdate, AppUpdateAvailability, AppUpdateResultCode } from '@capawesome/capacitor-app-update';

@Component({
  selector: 'app-root',
  imports: [IonRouterOutlet],
  template: `
    <!-- dynamic routes -->
    <ion-router-outlet />
  `
})
export class AppComponent {
  // services
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private hapticService = inject(HapticService);
  private socketService = inject(SocketService);
  private liveUpdateService = inject(LiveUpdateService);
  private navigationService = inject(NavigationService);
  private permissionsService = inject(PermissionsService);
  private pushNotificationService = inject(PushNotificationService);

  // view child
  private routerOutlet = viewChild(IonRouterOutlet);

  constructor() {
    // set the router outlet to the navigation service
    effect(() => this.navigationService.setRouterOutlet(this.routerOutlet()));

    // update FCM token and location when user is logged in or switches accounts
    effect(() => {
      // user is logged in, update FCM token and location
      const currentUser = this.authService.currentUser();
      if (Capacitor.isNativePlatform() && currentUser?.id) {
        this.pushNotificationService.updateFcmTokenInDatabase();
      }
      this.updateCurrentLocation();
    });

    // add icons
    addIcons(icons);

    // refresh current user from API on app initialization
    this.authService.refreshCurrentUser();

    // initialize push notifications on native platforms
    if (Capacitor.isNativePlatform()) {
      this.pushNotificationService.initialize();
    }

    // initialize live updates and app updates (native only)
    void this.initUpdates();

    // setup deep linking (native only)
    this.setupDeepLinking();

    // setup status bar scroll to top (iOS only)
    this.setupStatusBarScrollToTop();
  }

  private async initUpdates(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const info = await AppUpdate.getAppUpdateInfo();
      const updateAvailable =
        info.updateAvailability === AppUpdateAvailability.UPDATE_AVAILABLE || info.updateAvailability === AppUpdateAvailability.UPDATE_IN_PROGRESS;

      if (updateAvailable) {
        if (Capacitor.getPlatform() === 'android' && info.immediateUpdateAllowed) {
          const result = await AppUpdate.performImmediateUpdate();
          if (result.code === AppUpdateResultCode.OK) {
            return;
          }
        }

        await AppUpdate.openAppStore();
        return;
      }
    } catch (error) {
      console.error('Store update check failed:', error);
    }

    await this.liveUpdateService.init();
  }

  private async updateCurrentLocation(): Promise<void> {
    try {
      const location = await this.permissionsService.getCurrentLocation();
      if (location) {
        await this.userService.updateFcmTokenAndLocation(null, location.latitude, location.longitude);
      } else {
        console.log('Location not available');
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  }

  setupDeepLinking() {
    if (!Capacitor.isNativePlatform()) return;

    App.addListener('appUrlOpen', ({ url }: URLOpenListenerEvent) => {
      if (!url) return;

      try {
        const parsed = new URL(url);
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        setTimeout(() => this.navigationService.navigateForward(path));
      } catch {
        this.navigationService.navigateForward(url);
      }
    });
  }

  private setupStatusBarScrollToTop(): void {
    if (!isPlatformBrowser(this.platformId) || Capacitor.getPlatform() !== 'ios') return;

    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('statusTap', async () => {
        const contents = Array.from(document.querySelectorAll('ion-content'));
        const activeContent = contents[contents.length - 1];
        await activeContent?.scrollToTop(500);
      });
    });
  }
}
