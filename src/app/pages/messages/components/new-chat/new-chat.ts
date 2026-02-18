import { Searchbar } from '@/components/common/searchbar';
import { AuthService } from '@/services/auth.service';
import { NetworkService } from '@/services/network.service';
import { IUser } from '@/interfaces/IUser';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  NavController,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, from, switchMap } from 'rxjs';
import { onImageError, getImageUrlOrDefault, extractUsernameFromQR } from '@/utils/helper';
import { NgOptimizedImage } from '@angular/common';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { ToasterService } from '@/services/toaster.service';
import { UserService } from '@/services/user.service';
import { ConnectionStatus } from '@/enums/connection-status.enum';

@Component({
  selector: 'new-chat',
  styleUrl: './new-chat.scss',
  templateUrl: './new-chat.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonContent,
    IonToolbar,
    IonHeader,
    Searchbar,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    NgOptimizedImage
  ]
})
export class NewChat {
  private navCtrl = inject(NavController);
  private authService = inject(AuthService);
  private networkService = inject(NetworkService);
  private toasterService = inject(ToasterService);
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);
  private isInitialized = false;

  searchText = signal('');

  // auth
  isLoggedIn = computed(() => !!this.authService.currentUser());

  // pagination + data
  users = signal<IUser[]>([]);
  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);

  hasMore = computed(() => this.currentPage() < this.totalPages());

  isNativePlatform = computed(() => Capacitor.isNativePlatform());

  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => from(this.resetAndLoad(query.trim() || undefined))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // Watch search changes (debounced)
    effect(() => {
      const query = this.searchText();
      if (!this.isLoggedIn() || !this.isInitialized) return;
      this.searchSubject.next(query);
    });

    // Initial load (and re-load on re-login)
    effect(() => {
      const userId = this.authService.currentUser()?.id;
      if (!userId) {
        // logged out
        this.isInitialized = false;
        this.users.set([]);
        this.currentPage.set(1);
        this.totalPages.set(0);
        return;
      }

      // Only do immediate load when user becomes available
      if (!this.isInitialized) {
        this.isInitialized = true;
        this.resetAndLoad(this.searchText().trim() || undefined);
      }
    });
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  private async resetAndLoad(search?: string): Promise<void> {
    // this.users.set([]);
    this.currentPage.set(1);
    this.totalPages.set(0);
    await this.loadConnections(1, false, search);
  }

  async loadConnections(page: number = 1, append: boolean = false, search?: string): Promise<void> {
    if (!this.isLoggedIn()) return;

    try {
      if (page === 1) this.isLoading.set(true);

      const result = await this.networkService.getMyConnections({
        page,
        limit: 15,
        search: search || undefined
      });

      const nextUsers = result.data || [];

      if (append) {
        this.users.update((current) => [...current, ...nextUsers]);
      } else {
        this.users.set(nextUsers);
      }

      this.currentPage.set(result.pagination?.currentPage || 1);
      this.totalPages.set(result.pagination?.totalPages || 0);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  loadMoreUsers = async (event: Event): Promise<void> => {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;
    const search = this.searchText().trim() || undefined;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);
      const nextPage = this.currentPage() + 1;
      await this.loadConnections(nextPage, true, search);
    } catch (error) {
      console.error('Error loading more users:', error);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  };

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      this.searchText.set('');
      await this.loadConnections(1, false);
    } catch (error) {
      console.error('Error refreshing connections:', error);
    } finally {
      event.target.complete();
    }
  }

  goToChatRoom(user: IUser) {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;

    const user_ids = [currentUserId, user.id];

    this.navCtrl.navigateForward('/chat-room', {
      state: {
        user_ids,
        is_personal: true
      }
    });
  }

  async scanQRCodeForContact(): Promise<void> {
    try {
      const result = await BarcodeScanner.scan();

      if (result.barcodes && result.barcodes.length > 0) {
        const barcode = result.barcodes[0];
        const scannedValue = barcode.displayValue || barcode.rawValue || '';

        if (scannedValue) {
          await this.handleQRCodeForContact(scannedValue);
        } else {
          this.toasterService.showError('No QR code data found');
        }
      } else {
        this.toasterService.showError('No QR code detected');
      }
    } catch (error: any) {
      if (error.message && (error.message.includes('cancel') || error.message.includes('dismiss'))) {
        // User cancelled, no need to show error
        return;
      }
      console.error('Error scanning QR code:', error);
      this.toasterService.showError('Failed to scan QR code');
    }
  }

  private async handleQRCodeForContact(decodedText: string): Promise<void> {
    try {
      const username = extractUsernameFromQR(decodedText);
      if (!username) {
        this.toasterService.showError('Invalid QR code. Please scan a valid profile QR code.');
        return;
      }

      const user = await this.userService.getUser(username);

      if (!user || !user.id) {
        this.toasterService.showError('User not found.');
        return;
      }

      if (user.connection_status === ConnectionStatus.CONNECTED) {
        const currentUserId = this.authService.currentUser()?.id;
        if (!currentUserId) {
          this.toasterService.showError('You must be logged in to start a chat.');
          return;
        }

        this.navCtrl.navigateForward('/chat-room', {
          state: {
            user_ids: [currentUserId, user.id],
            is_personal: true
          }
        });
      } else {
        this.toasterService.showError('User is not in your network.');
      }
    } catch (error: any) {
      console.error('Error handling QR code for contact:', error);
      if (error.message && error.message.includes('not found')) {
        this.toasterService.showError('User not found.');
      } else {
        this.toasterService.showError('Failed to add contact. Please try again.');
      }
    }
  }

  goToCreateGroup() {
    this.navCtrl.navigateForward('/create-group');
  }

  handleBack() {
    this.navCtrl.back();
  }

  getDiamondPath(user: IUser): string {
    const points = user?.total_gamification_points || 0;

    if (points >= 50000) {
      return '/assets/svg/gamification/diamond-50k.svg';
    } else if (points >= 40000) {
      return '/assets/svg/gamification/diamond-40k.svg';
    } else if (points >= 30000) {
      return '/assets/svg/gamification/diamond-30k.svg';
    } else if (points >= 20000) {
      return '/assets/svg/gamification/diamond-20k.svg';
    } else if (points >= 10000) {
      return '/assets/svg/gamification/diamond-10k.svg';
    } else if (points >= 5000) {
      return '/assets/svg/gamification/diamond-5k.svg';
    } else {
      return '/assets/svg/gamification/diamond-1k.svg';
    }
  }
}
