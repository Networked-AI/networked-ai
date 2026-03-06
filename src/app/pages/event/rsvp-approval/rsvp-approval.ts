import { Button } from '@/components/form/button';
import { EventService } from '@/services/event.service';
import { ModalService } from '@/services/modal.service';
import { AuthService } from '@/services/auth.service';
import { ActivatedRoute } from '@angular/router';
import { Searchbar } from '@/components/common/searchbar';
import { ToasterService } from '@/services/toaster.service';
import { EmptyState } from '@/components/common/empty-state';
import { BaseApiService } from '@/services/base-api.service';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import { Component, inject, signal, ChangeDetectionStrategy, OnInit, computed, effect } from '@angular/core';
import { IonHeader, IonToolbar, IonContent, IonRefresher, IonRefresherContent, RefresherCustomEvent } from '@ionic/angular/standalone';

@Component({
  selector: 'rsvp-approval',
  styleUrl: './rsvp-approval.scss',
  templateUrl: './rsvp-approval.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    Button,
    CommonModule,
    SegmentButton,
    EmptyState,
    Searchbar,
    NgOptimizedImage,
    IonRefresher,
    IonRefresherContent
  ]
})
export class RsvpApproval implements OnInit {
  private route = inject(ActivatedRoute);
  navigationService = inject(NavigationService);
  private eventService = inject(EventService);
  private toasterService = inject(ToasterService);
  private modalService = inject(ModalService);
  private authService = inject(AuthService);

  isLoggedIn = computed(() => !!this.authService.currentUser());

  pendingRequests = signal<any[]>([]);
  processedRequests = signal<any[]>([]);
  selectedTab = signal<string>('pending');
  processingRequestId = signal<string | null>(null);
  searchQuery = signal<string>('');
  isLoading = signal<boolean>(false);
  eventId = signal<string>('');

  segmentItems: SegmentButtonItem[] = [
    { value: 'pending', label: 'Pending Actions' },
    { value: 'processed', label: 'Processed' }
  ];

  currentRequests = computed(() => {
    return this.selectedTab() === 'pending' ? this.pendingRequests() : this.processedRequests();
  });

  filteredRequests = computed(() => {
    const requests = this.currentRequests();
    const query = this.searchQuery().toLowerCase().trim();

    if (!query) {
      return requests;
    }

    return requests.filter((request) => {
      const userName = (request.user?.name || '').toLowerCase();
      const userEmail = (request.user?.email || '').toLowerCase();
      return userName.includes(query) || userEmail.includes(query);
    });
  });

  isProcessing = computed(() => this.processingRequestId() !== null);

  private isInitialLoad = true;

  constructor() {
    effect(() => {
      const tab = this.selectedTab();
      const eventId = this.eventId();
      // Skip effect on initial load (handled in ngOnInit)
      if (this.isInitialLoad) return;
      // Load requests when tab changes
      if (eventId) {
        this.loadRequests(tab);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.isLoggedIn()) {
      const result = await this.modalService.openLoginModal();
      if (!result?.success) {
        this.navigationService.back();
        return;
      }
    }

    const eventId = this.route.snapshot.paramMap.get('eventId');
    if (eventId) {
      this.eventId.set(eventId);
      // Check host/cohost access before loading requests
      await this.checkAccessAndLoadRequests();
    }
  }

  private async checkAccessAndLoadRequests(): Promise<void> {
    try {
      if (!this.eventId()) return;

      const eventData = await this.eventService.getEventById(this.eventId());
      if (!eventData) {
        this.navigationService.navigateForward(`/event/${this.eventId()}`);
        return;
      }

      // Check if user is host or cohost
      if (!this.eventService.checkHostOrCoHostAccess(eventData)) {
        this.toasterService.showError('You do not have permission to view this page');
        this.navigationService.navigateForward(`/event/${this.eventId()}`);
        return;
      }

      await this.loadRequests('pending');
      this.isInitialLoad = false;
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Error checking access.');
      this.toasterService.showError(message);
    }
  }

  async loadRequests(tab: string): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;

    this.isLoading.set(true);
    try {
      if (tab === 'pending') {
        const response = await this.eventService.getPendingRsvpRequests(eventId, 1, 20);
        this.pendingRequests.set(response?.data?.data || response?.data || []);
      } else {
        const response = await this.eventService.getProcessedRsvpRequests(eventId, 1, 20);
        this.processedRequests.set(response?.data?.data || response?.data || []);
      }
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to load RSVP requests');
      this.toasterService.showError(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  onTabChange(tab: string): void {
    this.selectedTab.set(tab);
    // loadRequests will be called by the effect
  }

  goBack(): void {
    this.navigationService.back();
  }

  async approveRequest(requestId: string): Promise<void> {
    if (this.processingRequestId()) return;

    this.processingRequestId.set(requestId);
    const loadingModal = await this.modalService.openLoadingModal('Processing approval...');

    try {
      await this.eventService.approveOrRejectRsvpRequest(this.eventId(), requestId, 'Approved');

      // Remove from pending and add to processed
      const pending = this.pendingRequests();
      const request = pending.find((req) => req.id === requestId);
      if (request) {
        this.pendingRequests.set(pending.filter((req) => req.id !== requestId));
        this.processedRequests.update((processed) => [...processed, { ...request, status: 'Approved' }]);
      }

      this.toasterService.showSuccess('RSVP request approved successfully');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to approve RSVP request.');
      this.toasterService.showError(message);
    } finally {
      await loadingModal.dismiss();
      this.processingRequestId.set(null);
    }
  }

  async rejectRequest(requestId: string): Promise<void> {
    if (this.processingRequestId()) return;

    this.processingRequestId.set(requestId);
    const loadingModal = await this.modalService.openLoadingModal('Processing rejection...');

    try {
      await this.eventService.approveOrRejectRsvpRequest(this.eventId(), requestId, 'Rejected');

      // Remove from pending and add to processed
      const pending = this.pendingRequests();
      const request = pending.find((req) => req.id === requestId);
      if (request) {
        this.pendingRequests.set(pending.filter((req) => req.id !== requestId));
        this.processedRequests.update((processed) => [...processed, { ...request, status: 'Rejected' }]);
      }

      this.toasterService.showSuccess('RSVP request rejected successfully');
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to reject RSVP request.');
      this.toasterService.showError(message);
    } finally {
      await loadingModal.dismiss();
      this.processingRequestId.set(null);
    }
  }

  getImageUrl(thumbnailUrl: string | null | undefined): string {
    return getImageUrlOrDefault(thumbnailUrl || undefined, 'assets/images/profile.jpeg');
  }

  getDiamondPathForPoints(points: number | null | undefined): string {
    const p = points ?? 0;
    if (p >= 50000) return '/assets/svg/gamification/diamond-50k.svg';
    if (p >= 40000) return '/assets/svg/gamification/diamond-40k.svg';
    if (p >= 30000) return '/assets/svg/gamification/diamond-30k.svg';
    if (p >= 20000) return '/assets/svg/gamification/diamond-20k.svg';
    if (p >= 10000) return '/assets/svg/gamification/diamond-10k.svg';
    if (p >= 5000) return '/assets/svg/gamification/diamond-5k.svg';
    return '/assets/svg/gamification/diamond-1k.svg';
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.loadRequests(this.selectedTab());
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete();
    }
  }
}
