import { IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { NotificationsService } from '@/services/notifications.service';
import { PopoverService } from '@/services/popover.service';
import { NavigationService } from '@/services/navigation.service';
import { input, inject, signal, computed, Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  imports: [IonIcon],
  selector: 'profile-header-toolbar',
  styleUrl: './profile-header-toolbar.scss',
  templateUrl: './profile-header-toolbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileHeaderToolbar {
  // services
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  navigationService = inject(NavigationService);
  private popoverService = inject(PopoverService);
  notificationsService = inject(NotificationsService);

  // inputs
  showMenuIcon = input(false);
  isPopoverOpen = signal(false);

  // computed
  loggedInUserName = computed(() => {
    const currentUser = this.authService.currentUser();
    return currentUser?.name || currentUser?.username;
  });

  goToNotification(): void {
    this.navigationService.navigateForward('/notification');
    this.popoverService.close();
  }

  async openAccountSwitcherPopover(event: Event): Promise<void> {
    this.isPopoverOpen.set(true);
    await this.popoverService.openAccountSwitcherPopover(event);
    this.isPopoverOpen.set(false);
    this.popoverService.close();
  }

  async openProfileOptionsPopover(event: Event): Promise<void> {
    await this.popoverService.openProfileOptionsPopover(event);
    this.popoverService.close();
  }

  async onShare(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (currentUser) await this.modalService.openShareProfileModal(currentUser);
  }
}
