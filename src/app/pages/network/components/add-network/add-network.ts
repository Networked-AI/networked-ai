import { Button } from '@/components/form/button';
import { Searchbar } from '@/components/common/searchbar';
import { UserCardList } from '@/components/card/user-card-list';
import { SearchEmptyState } from '@/components/common/search-empty-state';
import { UserNetworkRequestCard } from '@/components/card/user-network-request-card';
import { UserRecommendations } from '@/components/common/user-recommendations';
import { UserService } from '@/services/user.service';
import { NetworkService } from '@/services/network.service';
import { ToasterService } from '@/services/toaster.service';
import { SocketService } from '@/services/socket.service';
import { IonHeader, IonToolbar, IonContent, NavController, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular/standalone';
import { inject, signal, computed, Component, afterEveryRender, ChangeDetectionStrategy, effect, DestroyRef, OnDestroy } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap, from, map, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IUser } from '@/interfaces/IUser';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHintALLOption } from '@capacitor/barcode-scanner';
import { NavigationService } from '@/services/navigation.service';
import { Capacitor } from '@capacitor/core';
import { extractUsernameFromQR } from '@/utils/helper';

@Component({
  selector: 'add-network',
  styleUrl: './add-network.scss',
  templateUrl: './add-network.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    Searchbar,
    IonHeader,
    IonToolbar,
    IonContent,
    UserCardList,
    SearchEmptyState,
    UserNetworkRequestCard,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    UserRecommendations
  ]
})
export class AddNetwork implements OnDestroy {
  // services
  private navCtrl = inject(NavController);
  private userService = inject(UserService);
  private networkService = inject(NetworkService);
  private toasterService = inject(ToasterService);
  private socketService = inject(SocketService);
  private navigationService = inject(NavigationService);
  private destroyRef = inject(DestroyRef);
  private searchSubject = new Subject<string>();

  // signals
  showAll = signal(false);
  searchQuery = signal<string>('');
  searchResults = signal<IUser[]>([]);
  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  isLoadingMore = signal<boolean>(false);
  isSearching = signal<boolean>(false);
  networkRequests = signal<IUser[]>([]);
  isLoadingRequests = signal<boolean>(false);

  visibleSuggestions = computed(() => {
    const list = this.networkRequests();
    return this.showAll() ? list : list.slice(0, 3);
  });

  remainingCount = computed(() => {
    const total = this.networkRequests().length;
    return total > 3 ? total - 3 : 0;
  });

  hasMore = computed(() => this.currentPage() < this.totalPages());

  isNativePlatform = computed(() => Capacitor.isNativePlatform());

  constructor() {
    // Load network requests on init
    this.loadNetworkRequests();

    // Setup socket listener for real-time updates
    this.setupNetworkConnectionListener();

    // Setup debounced search
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => {
          const trimmedQuery = query.trim();

          if (!trimmedQuery) {
            // Clear search results when query is empty
            this.searchResults.set([]);
            this.isSearching.set(false);
            this.currentPage.set(1);
            this.totalPages.set(0);
            return from(Promise.resolve([]));
          }

          // Set searching state
          this.isSearching.set(true);

          // Reset pagination for new search
          this.currentPage.set(1);
          this.totalPages.set(0);

          return from(this.userService.searchUsers(trimmedQuery, 1, 20)).pipe(
            map((result) => {
              this.searchResults.set(result.users);
              this.currentPage.set(result.pagination.currentPage);
              this.totalPages.set(result.pagination.totalPages);
              this.isSearching.set(false);
              return result.users;
            }),
            catchError((error) => {
              console.error('Error searching users:', error);
              this.isSearching.set(false);
              this.searchResults.set([]);
              return of([]);
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // Watch searchQuery changes and emit to subject
    effect(() => {
      this.searchSubject.next(this.searchQuery());
    });
  }

  async loadMoreSearchResults(event: Event): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;
    const search = this.searchQuery().trim();

    if (this.isLoadingMore() || !this.hasMore() || !search) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);

      const nextPage = this.currentPage() + 1;
      const result = await this.userService.searchUsers(search, nextPage, 20);

      // Append new results to existing ones
      this.searchResults.update((current) => [...current, ...result.users]);
      this.currentPage.set(result.pagination.currentPage);
      this.totalPages.set(result.pagination.totalPages);
    } catch (error) {
      console.error('Error loading more search results:', error);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  }

  navigateBack() {
    this.navCtrl.back();
  }

  async scanQRCode(): Promise<void> {
    try {
      const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHintALLOption.ALL });
      if (ScanResult) {
        await this.handleQRCodeScanned(ScanResult);
      } else {
        this.toasterService.showError('No QR code detected');
      }
    } catch (error: any) {
      this.toasterService.showError('Failed to scan QR code');
    }
  }

  private async handleQRCodeScanned(decodedText: string): Promise<void> {
    try {
      const username = extractUsernameFromQR(decodedText);
      if (!username) {
        this.toasterService.showError('Invalid QR code. Please scan a valid profile QR code.');
        return;
      }
      await this.navigationService.navigateForward(`/${username}`);
    } catch (error) {
      console.error('Error parsing QR code:', error);
      this.toasterService.showError('Invalid QR code format.');
    }
  }

  async loadNetworkRequests(): Promise<void> {
    try {
      this.isLoadingRequests.set(true);
      const result = await this.networkService.getNetworkRequests({ page: 1, limit: 10 });
      this.networkRequests.set(result.data || []);
    } catch (error) {
      console.error('Error loading network requests:', error);
      this.toasterService.showError('Failed to load network requests');
    } finally {
      this.isLoadingRequests.set(false);
    }
  }

  async acceptNetwork(userId: string): Promise<void> {
    try {
      await this.networkService.acceptNetworkRequest(userId);
      // Remove from list after successful accept
      this.networkRequests.update((list) => list.filter((user) => user.id !== userId));
      this.toasterService.showSuccess('Network request accepted');
    } catch (error) {
      console.error('Error accepting network request:', error);
      this.toasterService.showError('Failed to accept network request');
    }
  }

  async rejectNetwork(userId: string): Promise<void> {
    try {
      await this.networkService.rejectNetworkRequest(userId);
      // Remove from list after successful reject
      this.networkRequests.update((list) => list.filter((user) => user.id !== userId));
      this.toasterService.showSuccess('Network request rejected');
    } catch (error) {
      console.error('Error rejecting network request:', error);
      this.toasterService.showError('Failed to reject network request');
    }
  }

  toggleView() {
    this.showAll.update((v) => !v);
  }

  private setupNetworkConnectionListener(): void {
    // Set up listener after socket is registered, or immediately if already registered
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    console.log('Network connection update event received in add-network:', payload);
    if (!payload || !payload.id) return;

    const userId = payload.id;
    const newStatus = payload.connection_status;

    // Update search results if the user is in the search results
    this.searchResults.update((results) => results.map((user) => (user.id === userId ? { ...user, connection_status: newStatus } : user)));

    // Handle network requests list (Added You section)
    this.networkRequests.update((requests) => {
      const existingUserIndex = requests.findIndex((user) => user.id === userId);

      if (newStatus === 'NotConnected') {
        if (existingUserIndex !== -1) {
          return requests.filter((user) => user.id !== userId);
        }
        return requests;
      }

      if (newStatus === 'RequestReceived') {
        const userUpdate: Partial<IUser> = {
          ...payload,
          connection_status: newStatus
        };

        if (existingUserIndex !== -1) {
          return requests.map((user) => (user.id === userId ? { ...user, ...userUpdate } : user));
        } else {
          return [{ ...userUpdate } as IUser, ...requests];
        }
      }
      return requests;
    });
  };

  ngOnDestroy(): void {
    // Clean up socket listener
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }
}
