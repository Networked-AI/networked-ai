import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { isPlatformBrowser } from '@angular/common';
import { UserService } from '@/services/user.service';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { StripeService } from '@/services/stripe.service';
import { environment } from 'src/environments/environment';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { NavigationService } from '@/services/navigation.service';
import { IonHeader, IonToolbar, IonContent, NavController } from '@ionic/angular/standalone';
import { signal, inject, Component, ChangeDetectionStrategy, OnInit, PLATFORM_ID } from '@angular/core';
import { SettingsProfileHeader } from '@/pages/settings/components/settings-profile-header';
import { SettingListItem, SettingsListItem } from '@/pages/settings/components/settings-list-item';
@Component({
  selector: 'settings',
  styleUrl: './settings.scss',
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsProfileHeader, SettingsListItem, IonHeader, IonToolbar, IonContent]
})
export class Settings implements OnInit {
  // services
  navigationService = inject(NavigationService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private modalService = inject(ModalService);
  private stripeService = inject(StripeService);
  private toasterService = inject(ToasterService);
  navCtrl = inject(NavController);

  // platform
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // signals
  appVersion = signal<string>('1.2.05');
  buildVersion = signal<string>('1');

  // settings sections
  accountItems = signal<SettingListItem[]>([
    {
      label: 'Account Settings',
      icon: 'pi pi-user-edit',
      route: '/settings/account'
    },
    {
      label: 'Change Password',
      icon: 'pi pi-lock',
      route: '/settings/change-account-info/password'
    },
    // {
    //   label: 'Payment',
    //   icon: 'pi pi-credit-card',
    //   route: '/settings/payment'
    // },
    {
      label: 'Payment History',
      icon: 'pi pi-history',
      route: '/settings/payment-history'
    },
    {
      icon: 'pi pi-wallet',
      label: 'Manage Payments',
      action: 'manage-payments'
    }
  ]);

  preferencesItems = signal<SettingListItem[]>([
    {
      label: 'Notifications',
      icon: 'pi pi-bell',
      route: '/notification'
    },
    {
      label: 'Permissions',
      icon: 'pi pi-cog',
      route: '/settings/permissions'
    }
    // {
    //   label: 'App Icon Appearance',
    //   icon: 'pi pi-palette',
    //   route: '/settings/app-icon'
    // }
  ]);

  resourcesItems = signal<SettingListItem[]>([
    {
      label: 'Contact Support',
      icon: 'pi pi-comments',
      action: 'send-mail'
    },
    {
      label: 'Rate in App Store',
      icon: 'pi pi-star',
      action: 'rate-app'
    },
    {
      label: 'Invite a Friend',
      icon: 'pi pi-user-plus',
      route: '/add-network'
    }
  ]);

  subscriptionsItems = signal<SettingListItem[]>([
    {
      label: 'My Subscriptions Plans',
      icon: 'pi pi-crown',
      action: 'subscription-plans'
    },
    {
      label: 'My Subscriptions',
      icon: 'pi pi-crown',
      route: '/subscription'
    }
  ]);

  aboutItems = signal<SettingListItem[]>([
    {
      label: 'App Version',
      value: this.appVersion(),
      showChevron: false
    },
    {
      label: 'Build Version',
      value: this.buildVersion(),
      showChevron: false
    },
    {
      label: 'Terms & Conditions',
      route: '/terms',
      showChevron: true
    },
    {
      label: 'Privacy Policy',
      route: '/policy',
      showChevron: true
    }
  ]);

  sections = signal([
    { title: 'Account', items: this.accountItems },
    { title: 'Preferences', items: this.preferencesItems },
    { title: 'Resources', items: this.resourcesItems },
    { title: 'Subscriptions', items: this.subscriptionsItems },
    { title: 'About the App', items: this.aboutItems, useItemShowChevron: true }
  ]);

  ngOnInit(): void {}

  onItemClick(item: any): void {
    if (item.route) {
      this.navigationService.navigateForward(item.route);
    } else if (item.action) {
      this.handleAction(item.action);
    }
  }

  async navigateToSubscriptionPlans(): Promise<void> {
    const user = await this.userService.getCurrentUser(true);
    if (!user?.email) {
      this.toasterService.showError('Please add your email to your profile to view subscription plans.');
      return;
    }
    if (user?.stripe_account_id && user?.stripe_account_status === 'active') {
      this.navigationService.navigateForward('/subscription/plans');
    } else {
      this.stripeService.openStripePayoutModal('view subscription plans in app', user?.stripe_account_status);
    }
  }

  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case 'rate-app':
        await this.rateApp();
        break;
      case 'subscription-plans':
        await this.navigateToSubscriptionPlans();
        break;
      case 'send-mail':
        if (this.isBrowser) window.open('mailto:admin@net-worked.ai', '_self');
        break;
      case 'manage-payments':
        await this.openStripeDashboard();
        break;
    }
  }

  async onSignOut(): Promise<void> {
    try {
      const result = await this.modalService.openConfirmModal({
        title: 'Sign Out',
        description: 'Are you sure you want to sign out?',
        confirmButtonLabel: 'Sign Out',
        cancelButtonLabel: 'Cancel',
        confirmButtonColor: 'danger',
        iconName: 'pi-sign-out',
        iconBgColor: '#C73838',
        iconPosition: 'center'
      });

      if (result && result.role === 'confirm') {
        await this.authService.signOut();
        this.navigationService.navigateRoot('/');
      }
    } catch (error: any) {
      console.error('Sign out error:', error);
      this.toasterService.showError(error.message || 'Failed to sign out. Please try again.');
    }
  }

  async rateApp() {
    const platform = Capacitor.getPlatform();

    let url = '';

    if (platform === 'android') {
      url = 'https://play.google.com/store/apps/details?id=app.networked.ai';
    } else {
      // Web fallback
      url = 'https://apps.apple.com/us/app/networked-ai-invites/id6471849642';
    }

    await Browser.open({
      url,
      presentationStyle: 'popover'
    });
  }

  async openStripeDashboard(): Promise<void> {
    try {
      const user = await this.userService.getCurrentUser(true);
      if (!user?.stripe_account_id || user?.stripe_account_status !== 'active') {
        await this.stripeService.openStripePayoutModal('access your Stripe dashboard and manage payments', user?.stripe_account_status);
        return;
      }
      
      const dashboardResponse = await this.stripeService.getStripeDashboard();
      await Browser.open({ url: dashboardResponse.url });
    } catch (error) {
      console.error('Error opening Stripe dashboard:', error);
      const message = BaseApiService.getErrorMessage(error, 'Error opening Stripe dashboard. Please try again.');
      this.toasterService.showError(message);
    }
  }
}
