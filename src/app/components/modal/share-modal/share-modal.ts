import * as XLSX from 'xlsx';
import { Checkbox } from 'primeng/checkbox';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { Searchbar } from '@/components/common/searchbar';
import { ToasterService } from '@/services/toaster.service';
import { NetworkService } from '@/services/network.service';
import { FeedService } from '@/services/feed.service';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  IonHeader,
  IonFooter,
  IonToolbar,
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSpinner,
  ModalController
} from '@ionic/angular/standalone';
import {
  Input,
  inject,
  signal,
  computed,
  Component,
  ChangeDetectionStrategy,
  OnInit,
  DestroyRef,
  ChangeDetectorRef,
  effect,
  PLATFORM_ID,
  DOCUMENT
} from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap, from, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IUser } from '@/interfaces/IUser';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { EventService } from '@/services/event.service';
import { CommonShareFooter } from '@/components/common/common-share-footer';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { environment } from 'src/environments/environment';
import { MessagesService } from '@/services/messages.service';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
export interface ICsvGuest {
  name: string;
  email: string;
  phone: string;
}

@Component({
  selector: 'share-modal',
  styleUrl: './share-modal.scss',
  templateUrl: './share-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    CommonShareFooter,
    Checkbox,
    IonFooter,
    Searchbar,
    IonHeader,
    IonToolbar,
    ReactiveFormsModule,
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSpinner,
    NgOptimizedImage
  ]
})
export class ShareModal implements OnInit {
  // services
  private modalService = inject(ModalService);
  private toasterService = inject(ToasterService);
  private networkService = inject(NetworkService);
  private feedService = inject(FeedService);
  private modalCtrl = inject(ModalController);
  private destroyRef = inject(DestroyRef);
  private cd = inject(ChangeDetectorRef);
  private eventService = inject(EventService);
  private messagesService = inject(MessagesService);
  private document = inject(DOCUMENT);

  // platform
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // inputs
  @Input() id?: string;
  @Input() image_url?: string;
  @Input() type: 'Event' | 'Post' | 'Plan' = 'Event';

  // signals
  searchQuery = signal<string>('');
  selectedUsers = signal<IUser[]>([]);
  selectAllNetworkCtrl = signal<FormControl>(new FormControl(false));
  yourNetwork = signal<IUser[]>([]);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  isSharing = signal<boolean>(false);
  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  sendEntireNetwork = signal<boolean>(false);
  eventSlug = signal<string | null>(null);
  csvGuests = signal<ICsvGuest[]>([]);
  private searchSubject = new Subject<string>();

  // computed
  selectedCount = computed(() => {
    const count = this.selectedUsers().length;
    return count > 0 ? ` (${count})` : '';
  });

  shareButtonLabel = computed(() => {
    return `Share ${this.type}${this.selectedCount()}`;
  });

  hasMore = computed(() => {
    return this.currentPage() < this.totalPages();
  });

  selectedUserIds = computed(() => {
    return this.selectedUsers().map((u) => u.id);
  });

  constructor() {
    // Set up debounced search
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((searchText: string) => {
          this.isLoading.set(true);
          this.currentPage.set(1);

          return from(
            this.networkService.getMyConnections({
              page: 1,
              limit: 20,
              search: searchText || undefined
            })
          ).pipe(
            catchError((error) => {
              console.error('Error fetching network connections:', error);
              this.isLoading.set(false);
              return of({ data: [], pagination: { totalCount: 0, currentPage: 1, totalPages: 0 } });
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        const users: IUser[] = response.data || [];

        this.yourNetwork.set(users);
        this.currentPage.set(response.pagination?.currentPage || 1);
        this.totalPages.set(response.pagination?.totalPages || 0);
        this.isLoading.set(false);
        this.cd.detectChanges();
      });

    // Watch for search query changes
    effect(() => {
      const query = this.searchQuery();
      if (query !== undefined) {
        this.searchSubject.next(query);
      }
    });

    // Watch for checkbox changes
    this.selectAllNetworkCtrl().valueChanges.subscribe((checked) => {
      this.onSelectAllChange(checked);
    });
  }

  async ngOnInit() {
    await this.loadNetworkConnections();
    if (this.type === 'Event' && this.id) {
      try {
        const eventData = await this.eventService.getEventById(this.id);
        if (eventData?.slug) {
          this.eventSlug.set(eventData.slug);
        }
      } catch (error) {
        console.error('Error fetching event data:', error);
      }
    }
  }

  async loadNetworkConnections(page: number = 1, append: boolean = false) {
    try {
      if (!append) {
        this.isLoading.set(true);
      } else {
        this.isLoadingMore.set(true);
      }

      const response = await this.networkService.getMyConnections({
        page,
        limit: 20,
        search: this.searchQuery() || undefined
      });

      const users: IUser[] = response.data || [];

      if (append) {
        this.yourNetwork.update((current) => [...current, ...users]);
      } else {
        this.yourNetwork.set(users);
      }

      this.currentPage.set(response.pagination?.currentPage || 1);
      this.totalPages.set(response.pagination?.totalPages || 0);
    } catch (error) {
      console.error('Error loading network connections:', error);
    } finally {
      this.isLoading.set(false);
      this.isLoadingMore.set(false);
      this.cd.detectChanges();
    }
  }

  async loadMoreUsers(event: Event): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      const nextPage = this.currentPage() + 1;
      await this.loadNetworkConnections(nextPage, true);
      if (this.sendEntireNetwork()) {
        this.onSelectAllChange(true);
      }
    } catch (error) {
      console.error('Error loading more users:', error);
    } finally {
      infiniteScroll.complete();
    }
  }

  toggleUser(user: IUser) {
    const selected = this.selectedUsers();
    const exists = selected.some((u) => u.id === user.id);

    if (exists) {
      this.selectedUsers.set(selected.filter((u) => u.id !== user.id));
    } else {
      this.selectedUsers.set([...selected, user]);
    }

    this.syncSelectAllCheckbox();
  }

  isSelected(user: IUser) {
    return this.selectedUsers().some((u) => u.id === user.id);
  }

  syncSelectAllCheckbox() {
    const network = this.yourNetwork();
    const allSelected = network.length > 0 && network.every((u) => this.isSelected(u));

    this.selectAllNetworkCtrl().setValue(allSelected, {
      emitEvent: false
    });
    this.sendEntireNetwork.set(allSelected);
  }

  onSelectAllChange(checked: boolean) {
    this.sendEntireNetwork.set(checked);

    if (checked) {
      const network = this.yourNetwork();
      const selected = this.selectedUsers();
      const merged = [...selected, ...network.filter((u) => !selected.some((s) => s.id === u.id))];
      this.selectedUsers.set(merged);
    } else {
      const networkIds = new Set(this.yourNetwork().map((u) => u.id));
      this.selectedUsers.set(this.selectedUsers().filter((u) => !networkIds.has(u.id)));
    }
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(user: IUser): string {
    return getImageUrlOrDefault(user.thumbnail_url || '', 'assets/images/profile.jpeg');
  }

  getUserDisplayName(user: IUser): string {
    const name = user.name || user.username || '';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return name;
  }

  async share(): Promise<void> {
    const sendEntireNetwork = this.sendEntireNetwork();
    const selectedIds = this.selectedUserIds();

    if (!sendEntireNetwork && selectedIds.length === 0) {
      this.toasterService.showError('Please select at least one user or enable "Send to Entire Network"');
      return;
    }

    try {
      this.isSharing.set(true);

      if (this.type === 'Post') {
        if (!this.id) {
          this.toasterService.showError('Invalid post share request');
          return;
        }

        const payload: {
          feed_id: string;
          peer_ids?: string[];
          send_entire_network?: boolean;
        } = {
          feed_id: this.id
        };

        sendEntireNetwork ? (payload.send_entire_network = true) : (payload.peer_ids = selectedIds);

        const response = await this.feedService.shareFeed(payload);

        this.toasterService.showSuccess(response.message || 'Post shared successfully');
      }

      if (this.type === 'Event') {
        if (!this.id) {
          this.toasterService.showError('Invalid event share request');
          return;
        }

        const payload = {
          event_id: this.id,
          type: 'Event',
          send_entire_network: false,
          peer_ids: selectedIds
        };

        const response = await this.eventService.shareEvent(payload);

        this.toasterService.showSuccess(response.message || 'Event shared successfully');
      }

      if (this.type === 'Plan') {
        const link = this.getContentLink();

        if (!link) {
          this.toasterService.showError('Plan link not available');
          return;
        }

        const planMessage = `Check out this Subscription plan: ${link}`;

        const payload = {
          type: 'Text',
          message: planMessage,
          send_entire_network: false,
          peer_ids: [...selectedIds]
        };

        await this.messagesService.shareInChat(payload);
        this.toasterService.showSuccess('Plan shared successfully');
      }

      await this.modalCtrl.dismiss({ success: true });
    } catch (error: any) {
      console.error('Error sharing:', error);
      this.toasterService.showError(error?.message || 'Failed to share. Please try again.');
    } finally {
      this.isSharing.set(false);
    }
  }

  async close() {
    await this.modalCtrl.dismiss();
  }

  getContentLink(): string {
    if (this.type === 'Event' && this.eventSlug()) {
      return `${environment.frontendUrl}/event/${this.eventSlug()}`;
    }
    if (this.type === 'Post' && this.id) {
      return `${environment.frontendUrl}/post/${this.id}`;
    }
    if (this.type === 'Plan' && this.id) {
      return `${environment.frontendUrl}/subscription/${this.id}`;
    }
    return '';
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve((reader.result as string).split(',')[1]);
      };
      reader.readAsDataURL(blob);
    });
  }

  async downloadImage(): Promise<void> {
    if (!this.image_url) return;
    try {
      const response = await fetch(this.image_url, { mode: 'cors' });
      if (!response.ok) throw new Error('Image fetch failed');

      const blob = await response.blob();

      const extension = blob.type.split('/')[1] || 'png';
      const fileName = `image-${Date.now()}.${extension}`;

      const base64Data = await this.blobToBase64(blob);
      const dataUrl = `data:${blob.type};base64,${base64Data}`;

      if (Capacitor.getPlatform() === 'web') {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        return;
      }

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents
      });

      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Download image',
          url: savedFile.uri
        });
      } else {
        this.toasterService.showSuccess('Image saved successfully!');
      }
    } catch (err) {
      console.error('Download failed', err);
      this.toasterService?.showError?.('Failed to download image');
    }
  }

  async onContact(): Promise<void> {
    if (this.type === 'Plan') {
      const link = this.getContentLink();
      if (!link) {
        this.toasterService.showError(`${this.type} link not available`);
        return;
      }
      const message = encodeURIComponent(`Check out this subsciption plan: ${link}`);
      if (this.isBrowser) window.open(`sms:?body=${message}`, '_self');
      return;
    }
    const contentType = this.type === 'Event' ? 'event' : 'post';
    const result = await this.modalService.openConfirmModal({
      title: 'Please Confirm',
      description: `It will send an SMS to your entire network with this ${contentType}. Are you sure you want to proceed?`,
      confirmButtonLabel: 'Send SMS',
      cancelButtonLabel: 'Close',
      confirmButtonColor: 'primary',
      onConfirm: async () => {
        try {
          if (this.type === 'Post') {
            if (!this.id) {
              this.toasterService.showError('Post information not available');
              return;
            }
            await this.feedService.networkBroadcast(this.id, 'sms');
            this.toasterService.showSuccess('Post shared via SMS successfully');
          } else if (this.type === 'Event') {
            if (!this.id) {
              this.toasterService.showError('Event information not available');
              return;
            }
            await this.eventService.networkBroadcast(this.id, 'sms');
            this.toasterService.showSuccess('Event shared via SMS successfully');
          }
        } catch (error: any) {
          console.error(`Error sharing ${this.type} via SMS:`, error);
          this.toasterService.showError(error?.message || `Failed to share ${this.type} via SMS`);
          throw error;
        }
      }
    });
  }

  async onCopyLink(): Promise<void> {
    const link = this.getContentLink();
    if (!link) {
      this.toasterService.showError(`${this.type} link not available`);
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
    const link = this.getContentLink();
    if (!link) {
      this.toasterService.showError(`${this.type} link not available`);
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
    const contentType = this.type === 'Event' ? 'event' : 'post';
    const result = await this.modalService.openConfirmModal({
      title: 'Please Confirm',
      description: `It will send a message to your entire network. Are you sure you want to proceed?`,
      confirmButtonLabel: 'Send Message',
      cancelButtonLabel: 'Close',
      confirmButtonColor: 'primary',
      onConfirm: async () => {
        try {
          if (this.type === 'Event') {
            if (!this.id) {
              this.toasterService.showError('Event information not available');
              return;
            }
            const payload = {
              event_id: this.id,
              type: 'Event',
              send_entire_network: true
            };
            await this.eventService.shareEvent(payload);
            this.toasterService.showSuccess('Event shared to your network successfully');
          } else if (this.type === 'Post') {
            if (!this.id) {
              this.toasterService.showError('Post information not available');
              return;
            }
            const payload = {
              feed_id: this.id,
              type: 'Post',
              send_entire_network: true
            };
            await this.messagesService.shareInChat(payload);
            this.toasterService.showSuccess('Post shared to your network successfully');
          } else if (this.type === 'Plan') {
            const link = this.getContentLink();

            if (!link) {
              this.toasterService.showError('Plan link not available');
              return;
            }

            const planMessage = `Check out this Subscription plan: ${link}`;

            const payload = {
              type: 'Text',
              message: planMessage,
              send_entire_network: true
            };

            await this.messagesService.shareInChat(payload);
            this.toasterService.showSuccess('Plan shared to your network successfully');
          }
        } catch (error: any) {
          console.error(`Error sharing ${this.type} in chat:`, error);
          this.toasterService.showError(error?.message || `Failed to share ${this.type}`);
          throw error;
        }
      }
    });
  }

  async onEmail(): Promise<void> {
    const contentType = this.type === 'Event' ? 'event' : 'post';
    const result = await this.modalService.openConfirmModal({
      title: 'Please Confirm',
      description: `It will send an email to your entire network with this ${contentType}. Are you sure you want to proceed?`,
      confirmButtonLabel: 'Send Email',
      cancelButtonLabel: 'Close',
      confirmButtonColor: 'primary',
      onConfirm: async () => {
        try {
          if (this.type === 'Post') {
            if (!this.id) {
              this.toasterService.showError('Post information not available');
              return;
            }
            await this.feedService.networkBroadcast(this.id, 'email');
            this.toasterService.showSuccess('Post shared via Email successfully');
          } else if (this.type === 'Event') {
            if (!this.id) {
              this.toasterService.showError('Event information not available');
              return;
            }
            await this.eventService.networkBroadcast(this.id, 'email');
            this.toasterService.showSuccess('Event shared via Email successfully');
          } else if (this.type === 'Plan') {
            const link = this.getContentLink();
            if (!link) {
              this.toasterService.showError('Plan link not available');
              return;
            }

            const subject = encodeURIComponent(`Check out this Subscription plan: ${link}`);
            const body = encodeURIComponent(`Hi,\n\nCheck out this subscription plan: ${link}`);
            if (this.isBrowser) window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
          }
        } catch (error: any) {
          console.error(`Error sharing ${this.type} via Email:`, error);
          this.toasterService.showError(error?.message || `Failed to share ${this.type} via Email`);
          throw error;
        }
      }
    });
  }

  onWhatsapp(): void {
    const link = this.getContentLink();
    if (!link) {
      this.toasterService.showError(`${this.type} link not available`);
      return;
    }

    const message = encodeURIComponent(`Check out this ${this.type.toLowerCase()}: ${link}`);
    const whatsappUrl = `https://wa.me/?text=${message}`;
    if (this.isBrowser) window.open(whatsappUrl, '_blank');
  }

  onShareToX(): void {
    const link = this.getContentLink();
    if (!link) return;

    const text = encodeURIComponent(link);
    const twitterUrl = `https://x.com/intent/tweet?text=${text}`;
    if (this.isBrowser) window.open(twitterUrl, '_blank');
  }

  onShareToThreads(): void {
    const link = this.getContentLink();
    if (!link) return;

    const text = encodeURIComponent(link);
    const threadsUrl = `https://threads.net/intent/post?text=${text}`;
    if (this.isBrowser) window.open(threadsUrl, '_blank');
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  normalizePhone(phone: any): string {
    phone = String(phone || '');
    phone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    if (phone && !phone.startsWith('+')) {
      phone = '+' + phone;
    }
    return phone;
  }

  isValidPhone(phone: string): boolean {
    return /^\+[0-9]{7,15}$/.test(phone);
  }

  private extractGuests(rows: any[]): ICsvGuest[] {
    return rows
      .map((row) => {
        const name = String(row.Name || row.name || '').trim();
        const email = String(row.Email || row.email || '').trim();
        const phone = this.normalizePhone(row.PhoneNumber || row.phone || '');
  
        return { name, email, phone };
      })
      .filter((g) => {
        if (!g.name && !g.email && !g.phone) return false;
  
        if (g.email && !this.isValidEmail(g.email)) {
          g.email = '';
        }
  
        if (g.phone && !this.isValidPhone(g.phone)) {
          g.phone = '';
        }
  
        if (!g.name && (g.email || g.phone)) {
          g.name = 'User';
        }
  
        // keep row if at least one field remains
        return g.name || g.email || g.phone;
      });
  }

  async onCsvFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    input.value = '';
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    await this.modalService.openLoadingModal('Processing contacts...');
    const reader = new FileReader();
    reader.onload = async (e) => {
      let rows: any[] = [];

      // CSV
      if (fileExt === 'csv') {
        const text = e.target?.result as string;

        const lines = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l);

        const [headerLine, ...dataRows] = lines;

        const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));

        const nameIdx = headers.indexOf('name');
        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.indexOf('phonenumber');

        rows = dataRows.map((row) => {
          const cols = row.split(',').map((c) => c.trim());

          return {
            name: nameIdx !== -1 ? cols[nameIdx] : '',
            email: emailIdx !== -1 ? cols[emailIdx] : '',
            phone: phoneIdx !== -1 ? cols[phoneIdx] : ''
          };
        });
      }

      // XLSX
      else {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheet = workbook.Sheets[workbook.SheetNames[0]];

        rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      }

      const guests = this.extractGuests(rows);

      if (!guests.length) {
        this.toasterService.showError('No valid contacts found in file.');
        await this.modalService.close();
        return;
      }

      this.csvGuests.set(guests);
      this.handleCsvGuests(guests);
    };

    fileExt === 'csv' ? reader.readAsText(file) : reader.readAsArrayBuffer(file);
  }

  private async handleCsvGuests(guests: ICsvGuest[]): Promise<void> {
    try {
      await this.modalService.openCsvDataModal(guests, this.id!, this.type, this.getContentLink());
      await this.modalService.close();
    } catch (error) {
      console.error(error);
      this.toasterService.showError('Failed to process CSV contacts.');
    }
  }

  async downloadSampleFile() {
    try {
      const fileName = 'sample.xlsx';
      const fileUrl = 'assets/sample.xlsx';

      // WEB
      if (Capacitor.getPlatform() === 'web') {
        const link = this.document.createElement('a');
        link.href = fileUrl;
        link.download = fileName;
        link.click();
        return;
      }

      // MOBILE (iOS / Android)
      const response = await fetch(fileUrl);
      const blob = await response.blob();

      const base64 = await this.blobToBase64(blob);

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Documents
      });

      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Sample File',
          url: savedFile.uri
        });
      } else {
        this.toasterService.showSuccess('File downloaded successfully!');
      }
    } catch (error) {
      console.error(error);
      this.toasterService.showError('Failed to download file');
    }
  }
}
