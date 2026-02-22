import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { onImageError } from '@/utils/helper';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Button } from '@/components/form/button';
import { NgOptimizedImage } from '@angular/common';
import { getImageUrlOrDefault } from '@/utils/helper';
import { EventService } from '@/services/event.service';
import { Searchbar } from '@/components/common/searchbar';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { EmptyState } from '@/components/common/empty-state';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { NavigationService } from '@/services/navigation.service';
import { Component, inject, signal, effect, ChangeDetectionStrategy, computed, DOCUMENT } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonSkeletonText } from '@ionic/angular/standalone';

@Component({
  selector: 'analytics-user-list',
  styleUrl: './analytics-user-list.scss',
  templateUrl: './analytics-user-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonInfiniteScrollContent,
    IonInfiniteScroll,
    IonIcon,
    IonToolbar,
    IonHeader,
    IonContent,
    IonSkeletonText,
    CommonModule,
    Searchbar,
    Button,
    EmptyState,
    NgOptimizedImage
  ]
})
export class AnalyticsUserList {
  // services
  route = inject(ActivatedRoute);
  eventService = inject(EventService);
  toasterService = inject(ToasterService);
  private readonly document = inject(DOCUMENT);
  navigationService = inject(NavigationService);

  // signals
  totalPages = signal(0);
  currentPage = signal(1);
  searchQuery = signal('');
  isLoading = signal(true);
  users = signal<any[]>([]);
  ticket = signal<any>(null);
  isDownloading = signal(false);
  isLoadingMore = signal(false);

  // computed
  hasMore = computed(() => this.currentPage() < this.totalPages());
  filteredSuggestions = computed(async () => {
    const search = this.searchQuery().toLowerCase().trim();
    if (!search) return this.users();
    const response = await this.eventService.getEventTicketAnalytics(this.ticket()?.id, 1, 20, search);
    return response?.users;
  });

  constructor() {
    effect(async () => {
      const state = history.state as { ticket?: any };

      const eventId = this.route.snapshot.paramMap.get('id');
      const ticketId = state?.ticket?.id;

      if (eventId && ticketId) {
        try {
          const response = await this.eventService.getEventTicketAnalytics(ticketId, 1, 20, this.searchQuery() || '');
          this.ticket.set(response?.ticket);
          this.currentPage.set(response?.pagination?.currentPage || 1);
          this.totalPages.set(response?.pagination?.totalPages || 0);
          this.users.set(response?.users);
        } catch (error) {
          const message = BaseApiService.getErrorMessage(error, 'Failed to fetch analytics data.');
          this.toasterService.showError(message);
        } finally {
          this.isLoading.set(false);
        }
      } else {
        this.users.set([]);
        this.currentPage.set(1);
        this.totalPages.set(0);
        this.isLoading.set(false);
      }
    });
  }

  penniesToDollars(value: number): string {
    return (value / 100).toFixed(2);
  }

  getTicketStatus = (ticket: any): 'sale-ended' | 'sold-out' | 'upcoming' | 'ongoing' => {
    const now = new Date();
    const saleStartDate = ticket.sales_start_date;
    const saleEndDate = ticket.sales_end_date;
    const availableQuantity = ticket.available_quantity;

    if (availableQuantity !== null && availableQuantity !== undefined && availableQuantity <= 0) {
      return 'sold-out';
    }

    if (saleEndDate) {
      const endDate = new Date(saleEndDate);
      if (now > endDate) {
        return 'sale-ended';
      }
    }

    if (saleStartDate) {
      const startDate = new Date(saleStartDate);
      if (now < startDate) {
        return 'upcoming';
      }
    }

    return 'ongoing';
  };

  getStatusChip() {
    const status = this.getTicketStatus(this.ticket());
    if (status === 'upcoming') {
      return 'assets/svg/ticket/upcoming-chip.svg';
    } else if (status === 'ongoing') {
      return 'assets/svg/ticket/on-going-chip.svg';
    } else if (status === 'sale-ended') {
      return 'assets/svg/ticket/ended-chip.svg';
    }
    return 'assets/svg/ticket/sold-out.svg';
  }

  getTicketTypeChip(ticket: any) {
    switch (ticket.ticket_type) {
      case 'Early Bird':
        return 'assets/svg/ticket/early-bird-chip.svg';
      case 'Sponsor':
        return 'assets/svg/ticket/sponsor-chip.svg';
      default:
        return 'assets/svg/ticket/regular-chip.svg';
    }
  }

  getTicketTypeClass() {
    if (this.ticket()?.ticket_type === 'Early Bird') {
      return 'ticket-type-early-bird';
    } else if (this.ticket()?.ticket_type === 'Sponsor') {
      return 'ticket-type-sponsor';
    } else {
      return 'ticket-type';
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  async downloadCSV(): Promise<void> {
    this.isDownloading.set(true);

    try {
      const csv = await this.eventService.downloadEventTicketAnalyticsCSV(this.ticket()?.id);

      // ✅ BOM for Excel
      const BOM = '\uFEFF';
      const content = BOM + csv;

      const ticketName = this.ticket()?.name || 'event-ticket';
      const sanitizedName = this.sanitizeFileName(ticketName);
      const fileName = `${sanitizedName}-${Date.now()}.csv`;

      // 🌐 WEB
      if (Capacitor.getPlatform() === 'web') {
        const blob = new Blob([content], {
          type: 'text/csv;charset=utf-8;'
        });

        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      // 📱 MOBILE (Android / iOS)
      const base64Data = btoa(unescape(encodeURIComponent(content)));

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents
      });

      // iOS → Share sheet
      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Event ticket analytics',
          url: savedFile.uri
        });
      } else {
        // Android → Success message (same as image)
        this.toasterService.showSuccess('CSV saved successfully!');
      }
    } catch (err) {
      console.error('CSV download failed', err);
      const message = BaseApiService.getErrorMessage(err, 'Failed to download CSV');
      this.toasterService.showError(message);
    } finally {
      this.isDownloading.set(false);
    }
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  getDiamondPath(points: number) {
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

  goToUser(user: any) {
    if (user.parent_user_id) {
      return;
    }
    this.navigationService.navigateForward(`/${user.username}`);
  }

  loadMoreUsers = async (event: Event): Promise<void> => {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);

      const nextPage = this.currentPage() + 1;

      const response = await this.eventService.getEventTicketAnalytics(this.ticket()?.id, nextPage, 20, this.searchQuery());
      this.currentPage.set(nextPage);
      this.totalPages.set(response?.pagination?.totalPages || 0);
      this.users.update((current) => [...current, ...response?.users]);
    } catch (error) {
      console.error('Error loading more users:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to load more users');
      this.toasterService.showError(message);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  };
}
