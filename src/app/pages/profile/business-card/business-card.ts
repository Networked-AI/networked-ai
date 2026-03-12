import { Share } from '@capacitor/share';
import { IUser } from '@/interfaces/IUser';
import { Capacitor } from '@capacitor/core';
import { QrCodeComponent } from 'ng-qrcode';
import * as htmlToImage from 'html-to-image';
import { Clipboard } from '@capacitor/clipboard';
import { Button } from '@/components/form/button';
import { UserService } from '@/services/user.service';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { ActivatedRoute, Router } from '@angular/router';
import { SocketService } from '@/services/socket.service';
import { environment } from 'src/environments/environment';
import { NetworkService } from '@/services/network.service';
import { ToasterService } from '@/services/toaster.service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { BaseApiService } from '@/services/base-api.service';
import { MessagesService } from '@/services/messages.service';
import { IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { ConnectionStatus } from '@/enums/connection-status.enum';
import { NavigationService } from '@/services/navigation.service';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Contacts, EmailType, PhoneType } from '@capacitor-community/contacts';
import { IonHeader, IonToolbar, IonContent, IonFooter } from '@ionic/angular/standalone';
import { CommonShareFooter } from '@/components/common/common-share-footer/common-share-footer';
import { Component, inject, ChangeDetectionStrategy, signal, computed, OnInit, ViewChild, ElementRef, DOCUMENT, PLATFORM_ID } from '@angular/core';
interface SocialLink {
  type: 'website' | 'facebook' | 'twitter' | 'instagram' | 'snapchat' | 'linkedin' | 'phone' | 'email';
  icon: string;
  label: string;
  value: string;
  href: string;
}

@Component({
  selector: 'business-card',
  styleUrl: './business-card.scss',
  templateUrl: './business-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSpinner, IonContent, IonToolbar, IonHeader, IonFooter, Button, IonIcon, NgOptimizedImage, QrCodeComponent, CommonShareFooter]
})
export class BusinessCardPage implements OnInit {
  @ViewChild('cardDownloadSection', { static: false, read: ElementRef }) cardDownloadSection?: ElementRef<HTMLDivElement>;

  // services
  private navigationService = inject(NavigationService);
  authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private userService = inject(UserService);
  private socketService = inject(SocketService);
  private networkService = inject(NetworkService);
  private toasterService = inject(ToasterService);
  private modalService = inject(ModalService);
  private readonly document = inject(DOCUMENT);
  private messagesService = inject(MessagesService);
  // platform
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  isLoading = signal(false);
  user = signal<IUser | null>(null);
  showMoreLinks = signal(false);
  isDownloading = signal(false);
  isAddingToNetwork = signal(false);
  isAcceptingRequest = signal(false);
  connectionStatus = signal<ConnectionStatus | null>(null);

  isAddedToNetwork = computed(() => this.connectionStatus() === ConnectionStatus.CONNECTED);
  isRequestSent = computed(() => this.connectionStatus() === ConnectionStatus.REQUEST_SENT);
  isRequestReceived = computed(() => this.connectionStatus() === ConnectionStatus.REQUEST_RECEIVED);
  isNativePlatform = computed(() => Capacitor.isNativePlatform());

  networkButtonConfig = computed(() => {
    if (this.isAddedToNetwork()) {
      return { label: 'Connected', icon: '/assets/svg/user-check.svg', disabled: false, color: '#0A9E57', action: 'connected' };
    } else if (this.isRequestSent()) {
      return { label: 'Pending', iconName: 'pi-clock', disabled: false, action: 'pending' };
    } else if (this.isRequestReceived()) {
      return { label: 'Accept', iconName: 'pi-check', disabled: this.isAcceptingRequest(), action: 'accept' };
    } else {
      return { label: 'Add Network', iconName: 'pi-user-plus', disabled: this.isAddingToNetwork(), action: 'add' };
    }
  });

  handleNetworkAction(): void {
    switch (this.networkButtonConfig().action) {
      case 'add':
        this.addToNetwork();
        break;
      case 'accept':
        this.acceptNetworkRequest();
        break;
      case 'pending':
        this.withdrawNetworkRequest();
        break;
      case 'connected':
        this.showRemoveConnectionAlert();
        break;
    }
  }

  private readonly socialConfigs = [
    { type: 'website', icon: 'globe-outline', key: 'website' },
    { type: 'facebook', icon: 'logo-facebook', key: 'facebook' },
    { type: 'twitter', icon: 'logo-twitter', key: 'twitter' },
    { type: 'instagram', icon: 'logo-instagram', key: 'instagram' },
    { type: 'snapchat', icon: 'logo-snapchat', key: 'snapchat' },
    { type: 'linkedin', icon: 'logo-linkedin', key: 'linkedin' }
  ] as const;

  profileImage = computed(() => {
    const user = this.user();
    return user?.thumbnail_url;
  });

  location = computed(() => {
    const user = this.user();
    if (!user?.address) return '';
    const parts = user.address.split(',').map((s) => s.trim());
    if (parts.length >= 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
    return user.address;
  });

  isViewingOtherProfile = computed(() => {
    const loggedInUser = this.authService.currentUser();
    const viewedUser = this.user();
    return viewedUser?.id && viewedUser?.id !== loggedInUser?.id;
  });

  showLocation = computed(() => {
    return !this.isViewingOtherProfile() || (this.isViewingOtherProfile() && !this.user()?.settings?.hide_location);
  });

  showEmail = computed(() => {
    return !this.isViewingOtherProfile() || (this.isViewingOtherProfile() && !this.user()?.settings?.hide_email);
  });

  showMobile = computed(() => {
    return !this.isViewingOtherProfile() || (this.isViewingOtherProfile() && !this.user()?.settings?.hide_mobile);
  });

  profileLink = computed(() => {
    const user = this.user();
    if (!user?.username) return '';
    const frontendUrl = environment.frontendUrl;
    return `${frontendUrl}/business-card/${user.username}`;
  });

  contactLinks = computed(() => {
    const user = this.user();
    if (!user) return [];

    const links: SocialLink[] = [];

    // Email
    if (user.email?.trim() && this.showEmail()) {
      links.push({
        type: 'email',
        icon: 'mail-outline',
        label: user.email.trim(),
        value: user.email.trim(),
        href: `mailto:${user.email.trim()}`
      });
    }

    // Phone
    if (user.mobile?.trim() && this.showMobile()) {
      const mobile = user.mobile.trim();
      const currentName = this.authService.currentUser()?.name?.trim();
      const messageText = currentName
        ? `Hi! This is ${currentName}. Looking forward to staying in touch.`
        : "Hi! Looking forward to staying in touch.";
      const defaultMessage = encodeURIComponent(messageText);
      links.push({
        type: 'phone',
        icon: 'call-outline',
        label: mobile,
        value: mobile,
        href: `sms:${mobile}?body=${defaultMessage}`
      });
    }

    return links;
  });

  socialLinks = computed(() => {
    const user = this.user();
    if (!user?.socials) return [];

    const links: SocialLink[] = [];

    for (const config of this.socialConfigs) {
      const value = user.socials[config.key as keyof typeof user.socials];
      if (value?.trim()) {
        const trimmedValue = value.trim();
        links.push({
          type: config.type,
          icon: config.icon,
          label: this.extractDisplayValue(trimmedValue, config.type),
          value: trimmedValue,
          href: trimmedValue
        });
      }
    }

    return links;
  });

  allLinks = computed(() => {
    return [...this.contactLinks(), ...this.socialLinks()];
  });

  visibleLinks = computed(() => {
    const links = this.allLinks();
    return this.showMoreLinks() ? links : links.slice(0, 2);
  });

  hiddenLinksCount = computed(() => {
    const total = this.allLinks().length;
    const visible = this.visibleLinks().length;
    return total > visible ? total - visible : 0;
  });

  ngOnInit(): void {
    const usernameParam = this.route.snapshot.paramMap.get('username');

    if (usernameParam) {
      this.loadUserByUsername(usernameParam);
    } else {
      const navigation = this.router.currentNavigation();
      const state: any = navigation?.extras?.state;

      if (state?.user) {
        this.user.set(state.user);
        this.connectionStatus.set((this.user() as any)?.connection_status ?? null);
      } else {
        const currentUser = this.authService.currentUser();
        if (currentUser) this.user.set(currentUser);
      }
    }
  }

  constructor() {
    this.setupNetworkConnectionListener();
  }

  private isSameAsCurrentUser(viewedUser: IUser | null): boolean {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !viewedUser) return false;
    return currentUser.id === viewedUser.id;
  }

  private async loadUserByUsername(username: string): Promise<void> {
    this.isLoading.set(true);

    try {
      const user = await this.userService.getUser(username);
      this.user.set(user);

      this.connectionStatus.set((user as any)?.connection_status ?? null);
    } catch (error) {
      console.error('Error loading user for business card:', error);
      const message = BaseApiService.getErrorMessage(error, 'User not found');
      this.toasterService.showError(message);
      this.navigationService.back();
    } finally {
      this.isLoading.set(false);
    }
  }

  private extractDisplayValue(value: string, type: string): string {
    if (!value || value.trim() === '') return '';

    const trimmedValue = value.trim();

    if (!trimmedValue.startsWith('http://') && !trimmedValue.startsWith('https://')) {
      return type === 'website' ? trimmedValue : trimmedValue.startsWith('@') ? trimmedValue : `@${trimmedValue}`;
    }

    try {
      const url = new URL(trimmedValue);
      const pathname = url.pathname.replace(/^\/+|\/+$/g, '');

      if (type === 'website') {
        return trimmedValue.replace(/^https?:\/\//, '');
      }

      if (type === 'linkedin') {
        const username = pathname.replace(/^in\/+/, '');
        return username.startsWith('@') ? username : `@${username}`;
      }

      const username = pathname || trimmedValue;
      return username.startsWith('@') ? username : `@${username}`;
    } catch {
      return type === 'website' ? trimmedValue : trimmedValue.startsWith('@') ? trimmedValue : `@${trimmedValue}`;
    }
  }

  toggleShowMore(): void {
    this.showMoreLinks.update((value) => !value);
  }

  goBack(): void {
    this.navigationService.back();
  }

  onEdit(): void {
    this.navigationService.navigateForward('/profile/edit');
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  async onDownload(): Promise<void> {
    const element = this.cardDownloadSection?.nativeElement;
    if (!element) {
      return;
    }

    this.isDownloading.set(true);

    try {
      const dataUrl = await htmlToImage.toPng(element, {
        cacheBust: true,
        skipFonts: true
      });

      const username = this.user()?.username || 'business-card';
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

      // iOS → Share sheet (best UX)
      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Download Business Card',
          url: savedFile.uri
        });
      } else {
        // Android → Show success message
        this.toasterService.showSuccess('Business card saved successfully!');
      }
    } catch (err) {
      console.error('Business card download failed', err);
    } finally {
      this.isDownloading.set(false);
    }
  }

  async onCopyLink(): Promise<void> {
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
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  onShareToThreads(): void {
    const link = this.profileLink();
    if (!link) return;

    const text = encodeURIComponent(link);
    const threadsUrl = `https://threads.net/intent/post?text=${text}`;
    if (this.isBrowser) window.open(threadsUrl, '_blank');
  }

  onShareToX(): void {
    const link = this.profileLink();
    if (!link) return;

    const text = encodeURIComponent(link);
    const twitterUrl = `https://x.com/intent/tweet?text=${text}`;
    if (this.isBrowser) window.open(twitterUrl, '_blank');
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

  async onChat(): Promise<void> {
    const result = await this.modalService.openConfirmModal({
      title: 'Please Confirm',
      description: 'It will send a message to your entire network. Are you sure you want to proceed?',
      confirmButtonLabel: 'Send Message',
      cancelButtonLabel: 'Close',
      confirmButtonColor: 'primary',
      onConfirm: async () => {
        const user = this.user();
        const link = this.profileLink();

        if (!link) {
          this.toasterService.showError('Profile link not available');
          return;
        }

        if (!user?.id) {
          this.toasterService.showError('User information not available');
          return;
        }

        try {
          const profileMessage = `Check out ${user.name || user.username}'s profile: ${link}`;

          const payload = {
            type: 'Text',
            message: profileMessage,
            send_entire_network: true
          };

          await this.messagesService.shareInChat(payload);
          this.toasterService.showSuccess('Profile shared to your network successfully');
        } catch (error: any) {
          console.error('Error sharing profile in chat:', error);
          const message = BaseApiService.getErrorMessage(error, 'Failed to share profile');
          this.toasterService.showError(message);
          throw error;
        }
      }
    });
  }

  onEmail(): void {
    const user = this.user();
    const link = this.profileLink();
    if (!link) {
      this.toasterService.showError('Profile link not available');
      return;
    }

    const subject = encodeURIComponent(`Check out my profile - ${user?.name || user?.username || 'Profile'}`);
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

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(url: string | undefined | null): string {
    return getImageUrlOrDefault(url || '');
  }

  private async ensureLoggedIn(): Promise<boolean> {
    if (this.authService.getCurrentToken()) return true;
    const result = await this.modalService.openLoginModal();
    return result?.success ?? false;
  }

  async addToNetwork(): Promise<void> {
    const wasLoggedIn = !!this.authService.getCurrentToken();

    // ensure login
    const isLoggedIn = await this.ensureLoggedIn();
    if (!isLoggedIn) return;

    if (!wasLoggedIn) {
      if (this.isSameAsCurrentUser(this.user())) {
        return;
      }

      // Fetch fresh connection status
      const freshUser = await this.userService.getUser(this.user()!.username!);
      if (freshUser) {
        const freshStatus = (freshUser?.connection_status as ConnectionStatus) ?? null;
        this.connectionStatus.set(freshStatus);

        if (freshStatus !== ConnectionStatus.NOT_CONNECTED) {
          return;
        }
      }
    }

    const userId = this.user()?.id;
    if (!userId) return;

    try {
      this.isAddingToNetwork.set(true);
      await this.networkService.sendNetworkRequest(userId);
      this.connectionStatus.set(ConnectionStatus.REQUEST_SENT);
      this.toasterService.showSuccess('Network request sent!');
    } catch (error: any) {
      console.error('Error sending network request:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to send network request');
      this.toasterService.showError(message);
    } finally {
      this.isAddingToNetwork.set(false);
    }
  }

  async acceptNetworkRequest(): Promise<void> {
    const userId = this.user()?.id;
    if (!userId) return;
    try {
      this.isAcceptingRequest.set(true);
      await this.networkService.acceptNetworkRequest(userId);
      this.connectionStatus.set(ConnectionStatus.CONNECTED);
      this.toasterService.showSuccess('Network request accepted!');
    } catch (error) {
      console.error('Error accepting network request:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to accept network request');
      this.toasterService.showError(message);
    } finally {
      this.isAcceptingRequest.set(false);
    }
  }

  async withdrawNetworkRequest(): Promise<void> {
    const user = this.user();
    const userId = user?.id;
    if (!userId) return;
    await this.modalService.openConfirmModal({
      icon: 'assets/svg/alert-white.svg',
      title: 'Withdraw Invitation?',
      description: `Are you sure you want to withdraw your network invitation to ${user?.name || user?.username}?`,
      confirmButtonLabel: 'Withdraw',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconBgColor: '#C73838',
      iconPosition: 'left',
      onConfirm: async () => {
        await this.networkService.cancelNetworkRequest(userId);
        this.connectionStatus.set(ConnectionStatus.NOT_CONNECTED);
        this.toasterService.showSuccess('Invitation withdrawn');
      }
    });
  }

  async showRemoveConnectionAlert(): Promise<void> {
    const user = this.user();
    if (!user?.id) return;

    const username = user?.name || user?.username || 'this user';

    await this.modalService.openConfirmModal({
      icon: 'assets/svg/alert-white.svg',
      title: 'Remove Network?',
      description: `Are you sure you want to remove ${username} from your network list? The user won't be notified.`,
      confirmButtonLabel: 'Remove',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconBgColor: '#C73838',
      iconPosition: 'left',
      onConfirm: async () => {
        try {
          await this.networkService.removeNetworkConnection(user.id);
          this.connectionStatus.set(ConnectionStatus.NOT_CONNECTED);
          this.toasterService.showSuccess('Network connection removed');
        } catch (error) {
          console.error('Error removing network connection:', error);
          const message = BaseApiService.getErrorMessage(error, 'Failed to remove network connection');
          this.toasterService.showError(message);
          throw error;
        }
      }
    });
  }

  async onAddToContacts(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.toasterService.showError('Add to Contacts is only available on mobile');
      return;
    }

    const user = this.user();
    if (!user) return;
    try {
      const nameParts = user.name?.trim().split(' ') || [];
      await Contacts.createContact({
        contact: {
          name: {
            given: nameParts[0] || '',
            family: nameParts.slice(1).join(' ') || ''
          },
          emails: user.email ? [{ type: EmailType.Work, address: user.email }] : [],
          phones: user.mobile ? [{ type: PhoneType.Mobile, number: user.mobile }] : []
        }
      });
      this.toasterService.showSuccess('Contact saved!');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to save contact');
      this.toasterService.showError(message);
    }
  }

  private setupNetworkConnectionListener(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    if (!payload?.id) return;
    const viewedUser = this.user();
    if (viewedUser?.id === payload.id || (viewedUser as any)?.username === payload.username) {
      this.connectionStatus.set(payload.connection_status as ConnectionStatus);
    }
  };

  ngOnDestroy(): void {
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }
}
