import { IonIcon } from '@ionic/angular/standalone';
import { NgOptimizedImage } from '@angular/common';
import { ToasterService } from '@/services/toaster.service';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { IUser } from '@/interfaces/IUser';
import { environment } from 'src/environments/environment';
import { ModalService } from '@/services/modal.service';
import { NavigationService } from '@/services/navigation.service';
import { NetworkService } from '@/services/network.service';
import { ConnectionStatus } from '@/enums/connection-status.enum';
import { Button } from '@/components/form/button';
import { Clipboard } from '@capacitor/clipboard';
import { HapticService } from '@/services/haptic.service';
import { Zoom } from 'swiper/modules';
import { Component, inject, ChangeDetectionStrategy, input, output, computed, signal, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';

const CONFIRM_DANGER_OPTIONS = {
  icon: 'assets/svg/alert-white.svg',
  cancelButtonLabel: 'Cancel' as const,
  confirmButtonColor: 'danger' as const,
  iconBgColor: '#C73838',
  iconPosition: 'left' as const
};

@Component({
  selector: 'profile-image-preview-overlay',
  styleUrl: './profile-image-preview-overlay.scss',
  templateUrl: './profile-image-preview-overlay.html',
  imports: [IonIcon, NgOptimizedImage, Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA]
})
export class ProfileImagePreviewOverlay {
  user = input<IUser | null>(null);
  isViewingOtherProfile = input<boolean>(false);
  closeOverlay = output<void>();
  swiperModules = [Zoom];

  private toasterService = inject(ToasterService);
  private modalService = inject(ModalService);
  private navigationService = inject(NavigationService);
  private networkService = inject(NetworkService);
  hapticService = inject(HapticService);
  isAddingToNetwork = signal(false);
  isWithdrawingInvitation = signal(false);

  private connectionStatus = computed(() => {
    if (!this.isViewingOtherProfile()) return null;
    return this.user()?.connection_status as ConnectionStatus | undefined;
  });

  isOtherUserConnected = computed(() => this.connectionStatus() === ConnectionStatus.CONNECTED);
  isRequestSent = computed(() => this.connectionStatus() === ConnectionStatus.REQUEST_SENT);
  showAddAsNetworkOnly = computed(
    () =>
      this.isViewingOtherProfile() &&
      this.connectionStatus() !== ConnectionStatus.CONNECTED &&
      this.connectionStatus() !== ConnectionStatus.REQUEST_SENT
  );
  showRequestSentOnly = computed(() => this.isViewingOtherProfile() && this.isRequestSent());

  close(): void {
    this.closeOverlay.emit();
  }

  async onCopyLink(): Promise<void> {
    const user = this.user();
    if (!user) return;
    try {
      const url = environment.frontendUrl;
      await Clipboard.write({ string: `${url}/${user.username ?? ''}` });
      this.toasterService.showSuccess('Link copied to clipboard');
    } catch (error) {
      console.error('Error copying link:', error);
      this.toasterService.showError('Failed to copy link');
    }
  }

  async onShare(): Promise<void> {
    const user = this.user();
    if (user) await this.modalService.openShareProfileModal(user);
  }

  onBusinessCard(): void {
    const user = this.user();
    if (user) {
      this.navigationService.navigateForward('/profile/business-card', false, {
        user
      });
    }
  }

  async onMyNetwork(): Promise<void> {
    const user = this.user();
    if (!user?.id) return;
    await this.modalService.openConfirmModal({
      ...CONFIRM_DANGER_OPTIONS,
      title: 'Remove Network?',
      description: `Are you sure you want to remove ${this.displayName(user)} from your network list? The user won't be notified.`,
      confirmButtonLabel: 'Remove',
      onConfirm: async () => {
        try {
          await this.networkService.removeNetworkConnection(user.id);
          this.toasterService.showSuccess('Network connection removed');
        } catch (error) {
          console.error('Error removing network connection:', error);
          this.toasterService.showError('Failed to remove network connection');
          throw error;
        }
      }
    });
  }

  async onAddToNetwork(): Promise<void> {
    const userId = this.user()?.id;
    if (!userId) return;
    try {
      this.isAddingToNetwork.set(true);
      await this.networkService.sendNetworkRequest(userId);
      this.toasterService.showSuccess('Network request sent successfully');
    } catch (error) {
      console.error('Error sending network request:', error);
      this.toasterService.showError('Failed to send network request');
    } finally {
      this.isAddingToNetwork.set(false);
    }
  }

  async onWithdrawInvitation(): Promise<void> {
    const user = this.user();
    if (!user?.id) return;
    await this.modalService.openConfirmModal({
      ...CONFIRM_DANGER_OPTIONS,
      title: 'Withdraw Invitation?',
      description: `Are you sure you want to withdraw your network invitation to ${this.displayName(user)}?`,
      confirmButtonLabel: 'Withdraw',
      onConfirm: async () => {
        try {
          this.isWithdrawingInvitation.set(true);
          await this.networkService.cancelNetworkRequest(user.id);
          this.toasterService.showSuccess('Network invitation withdrawn');
        } catch (error) {
          console.error('Error withdrawing network invitation:', error);
          this.toasterService.showError('Failed to withdraw network invitation');
          throw error;
        } finally {
          this.isWithdrawingInvitation.set(false);
        }
      }
    });
  }

  getImage(user: IUser | null): string {
    return (user?.image_url as string) || user?.thumbnail_url || '';
  }

  getImageUrl(url: string | undefined | null): string {
    return getImageUrlOrDefault(url ?? '');
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  private displayName(user: IUser): string {
    return user?.username || user?.name || 'this user';
  }
}
