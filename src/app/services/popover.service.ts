import { inject, Injectable } from '@angular/core';
import { PopoverController } from '@ionic/angular/standalone';
import { ProfileOptionsPopover } from '@/components/popover/profile-options-popover';
import { AccountSwitcherPopover } from '@/components/popover/account-switcher-popover';
import { CommonPopover } from '@/components/popover/common-popover';
import { NotificationSubscriptionPopover } from '@/components/popover/notification-subscription-popover';
import { ProfileSubscription } from '@/interfaces/IUser';

@Injectable({ providedIn: 'root' })
export class PopoverService {
  // services
  private popoverCtrl = inject(PopoverController);

  async openProfileOptionsPopover(event: Event, isViewingOtherProfile: boolean = false, user?: any): Promise<void> {
    const popover = await this.popoverCtrl.create({
      mode: 'md',
      event: event as MouseEvent,
      cssClass: 'common-popover-css',
      component: ProfileOptionsPopover,
      componentProps: {
        isViewingOtherProfile,
        user
      }
    });

    await popover.present();
    await popover.onDidDismiss();
  }

  async openAccountSwitcherPopover(event: Event): Promise<void> {
    const popover = await this.popoverCtrl.create({
      mode: 'md',
      event: event as MouseEvent,
      cssClass: 'common-popover-css',
      component: AccountSwitcherPopover
    });

    await popover.present();
    await popover.onDidDismiss();
  }

  async openCommonPopover(event: Event, items: any[]): Promise<void> {
    const popover = await this.popoverCtrl.create({
      mode: 'md',
      event: event as MouseEvent,
      cssClass: 'common-popover-css',
      component: CommonPopover,
      componentProps: {
        items: items
      }
    });

    await popover.present();
    await popover.onDidDismiss();
  }

  async openNotificationSubscriptionPopover(event: Event, username: string, initialPreferences: { posts: boolean; events: boolean }): Promise<any> {
    let preferences: ProfileSubscription = {};
    const popover = await this.popoverCtrl.create({
      mode: 'md',
      event: event as MouseEvent,
      cssClass: 'common-popover-css',
      component: NotificationSubscriptionPopover,
      componentProps: {
        username,
        initialPreferences,
        preferencesChange: (prefs: ProfileSubscription) => {
          preferences = prefs;
        }
      }
    });

    await popover.present();
    await popover.onWillDismiss();

    return preferences;
  }

  async close(): Promise<void> {
    await this.popoverCtrl.dismiss();
  }
}
