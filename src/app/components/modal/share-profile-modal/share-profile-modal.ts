import { Button } from '@/components/form/button';
import { IonIcon } from '@ionic/angular/standalone';
import { IonToolbar, IonFooter, ModalController } from '@ionic/angular/standalone';
import { ToasterService } from '@/services/toaster.service';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import * as htmlToImage from 'html-to-image';
import { QrCodeComponent } from 'ng-qrcode';
import { Component, inject, ChangeDetectionStrategy, signal, computed, Input, ViewChild, ElementRef, DOCUMENT, PLATFORM_ID } from '@angular/core';
import { IUser } from '@/interfaces/IUser';
import { Clipboard } from '@capacitor/clipboard';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { environment } from 'src/environments/environment';
import { CommonShareFooter } from '@/components/common/common-share-footer';
import { MessagesService } from '@/services/messages.service';
import { ModalService } from '@/services/modal.service';
import { AuthService } from '@/services/auth.service';

@Component({
  selector: 'share-profile-modal',
  styleUrl: './share-profile-modal.scss',
  templateUrl: './share-profile-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonToolbar, IonFooter, Button, IonIcon, NgOptimizedImage, QrCodeComponent, CommonShareFooter]
})
export class ShareProfileModal {
  @ViewChild('downloadableSection', { static: false, read: ElementRef }) downloadableSection?: ElementRef<HTMLDivElement>;
  // services
  authService = inject(AuthService);
  private document = inject(DOCUMENT);
  private modalCtrl = inject(ModalController);
  private toasterService = inject(ToasterService);
  private messagesService = inject(MessagesService);
  private modalService = inject(ModalService);

  // platform
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  @Input() user?: IUser;

  isDownloading = signal(false);

  profileImage = computed(() => {
    const user = this.user;
    return user?.thumbnail_url;
  });

  location = computed(() => {
    const user = this.user;
    if (!user?.address) return '';
    const parts = user.address.split(',').map((s) => s.trim());
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
    return user.address;
  });

  isViewingOtherProfile = computed(() => {
    const loggedInUser = this.authService.currentUser();
    const viewedUser = this.user;
    return viewedUser?.id && viewedUser?.id !== loggedInUser?.id;
  });

  showLocation = computed(() => {
    return !this.isViewingOtherProfile() || (this.isViewingOtherProfile() && !this.user?.settings?.hide_location);
  });

  profileLink = computed(() => {
    const user = this.user;
    if (!user?.username) return '';
    const frontendUrl = environment.frontendUrl;
    return `${frontendUrl}/${user.username}`;
  });

  async copyLink(): Promise<void> {
    const link = this.profileLink();
    if (!link) {
      this.toasterService.showError('Profile link not available');
      return;
    }

    try {
      await Clipboard.write({ string: link });
      this.toasterService.showSuccess('Link copied to clipboard');
    } catch (error) {
      console.error('Error copying link:', error);
      this.toasterService.showError('Failed to copy link');
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  async downloadProfile(): Promise<void> {
    const element = this.downloadableSection?.nativeElement;
    if (!element) {
      return;
    }

    this.isDownloading.set(true);

    try {
      const dataUrl = await htmlToImage.toPng(element, {
        cacheBust: true,
        skipFonts: true
      });

      const username = this.user?.username || 'profile';
      const sanitizedUsername = this.sanitizeFileName(username);
      const fileName = `${sanitizedUsername}-${Date.now()}.png`;

      // WEB
      if (Capacitor.getPlatform() === 'web') {
        const link = this.document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        return;
      }

      // MOBILE (Android / iOS)
      const base64Data = dataUrl.split(',')[1];

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents
      });

      // iOS → Share sheet
      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Download Profile',
          url: savedFile.uri
        });
      } else {
        // Android → Show success message
        this.toasterService.showSuccess('Profile saved successfully!');
      }
    } catch (err) {
      console.error('Profile download failed', err);
    } finally {
      this.isDownloading.set(false);
    }
  }

  async close(): Promise<void> {
    await this.modalCtrl.dismiss();
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(url: string | undefined | null): string {
    return getImageUrlOrDefault(url || '');
  }

  onContact(): void {
    const link = this.profileLink();
    if (!link) {
      this.toasterService.showError('Profile link not available');
      return;
    }

    const message = encodeURIComponent(`Check out my profile: ${link}`);
    if (this.isBrowser) window.open(`sms:?body=${message}`, '_self');
  }

  onCopyLink(): Promise<void> {
    return this.copyLink();
  }

  async onShareTo(): Promise<void> {
    const link = this.profileLink();
    if (!link) {
      this.toasterService.showError('Profile link not available');
      return;
    }
    try {
      await Share.share({
        text: link
      });
    } catch (error: any) {
      if (error.message && !error.message.includes('cancel')) {
        console.error('Error sharing:', error);
      }
    }
  }

  async onChat(): Promise<void> {
    const result = await this.modalService.openConfirmModal({
      title: 'Please Confirm',
      description: 'It will send a message to your entire network. Are you sure you want to proceed?',
      confirmButtonLabel: 'Send Message',
      cancelButtonLabel: 'Close',
      confirmButtonColor: 'primary',
      onConfirm: async () => {
        const link = this.profileLink();

        if (!link) {
          this.toasterService.showError('Profile link not available');
          return;
        }

        if (!this.user?.id) {
          this.toasterService.showError('User information not available');
          return;
        }

        try {
          const profileMessage = `Check out ${this.user.name || this.user.username}'s profile: ${link}`;

          const payload = {
            type: 'Text',
            message: profileMessage,
            send_entire_network: true
          };

          await this.messagesService.shareInChat(payload);
          this.toasterService.showSuccess('Profile shared to your network successfully');
        } catch (error: any) {
          console.error('Error sharing profile in chat:', error);
          this.toasterService.showError(error?.message || 'Failed to share profile');
          throw error;
        }
      }
    });
  }

  onEmail(): void {
    const link = this.profileLink();
    if (!link) {
      this.toasterService.showError('Profile link not available');
      return;
    }

    const subject = encodeURIComponent(`Check out my profile - ${this.user?.name || this.user?.username || 'Profile'}`);
    const body = encodeURIComponent(`Hi,\n\nCheck out my profile: ${link}`);
    if (this.isBrowser) window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  }

  onWhatsapp(): void {
    const link = this.profileLink();
    if (!link) {
      this.toasterService.showError('Profile link not available');
      return;
    }

    const message = encodeURIComponent(`Check out my profile: ${link}`);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    if (this.isBrowser) window.open(whatsappUrl, '_blank');
  }

  onShareToX(): void {
    const link = this.profileLink();
    if (!link) return;

    const text = encodeURIComponent(link);
    const twitterUrl = `https://x.com/intent/tweet?text=${text}`;
    if (this.isBrowser) window.open(twitterUrl, '_blank');
  }

  onShareToThreads(): void {
    const link = this.profileLink();
    if (!link) return;

    const text = encodeURIComponent(link);
    const threadsUrl = `https://threads.net/intent/post?text=${text}`;
    if (this.isBrowser) window.open(threadsUrl, '_blank');
  }
}
