import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '@/services/auth.service';
import { EventService } from '@/services/event.service';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { BaseApiService } from '@/services/base-api.service';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { AnalyticsTickets } from '@/pages/event/components/analytics-tickets';
import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { AnalyticsPromoCodes } from '@/pages/event/components/analytics-promo-codes';
import { IonContent, IonHeader, IonToolbar, IonIcon, IonRefresher, IonRefresherContent, IonSkeletonText, RefresherCustomEvent } from '@ionic/angular/standalone';

@Component({
  selector: 'event-analytics',
  styleUrl: './event-analytics.scss',
  templateUrl: './event-analytics.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader,
    IonToolbar,
    IonContent,
    IonRefresher,
    IonSkeletonText,
    IonRefresherContent,
    CommonModule,
    AnalyticsPromoCodes,
    AnalyticsTickets,
    IonIcon,
    NgOptimizedImage
  ]
})
export class EventAnalytics implements OnInit {
  navigationService = inject(NavigationService);

  authService = inject(AuthService);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);
  eventService = inject(EventService);
  route = inject(ActivatedRoute);

  isLoading = signal(true);
  summary = signal<any>(null);
  isDownloading = signal(false);
  eventData = signal<any>(null);
  promoCodes = signal<any>(null);
  isLoggedIn = computed(() => !!this.authService.currentUser());

  async ngOnInit(): Promise<void> {
    if (!this.isLoggedIn()) {
      const result = await this.modalService.openLoginModal();
      if (!result?.success) {
        this.navigationService.back();
        return;
      }
    }

    // Get route params
    const eventId = this.route.snapshot.paramMap.get('id');

    if (eventId) {
      await this.loadAnalytics(eventId);
    }
  }

  async loadAnalytics(eventId: string): Promise<void> {
    try {
      const response = await this.eventService.getEventAnalytics(eventId);
      const event = response?.event;
      this.eventData.set(event);
      this.promoCodes.set(response?.promo_codes);
      this.summary.set(response?.summary);
    } catch (error) {
      console.error('Error loading analytics:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to load analytics');
      this.toasterService.showError(message);
      this.navigationService.navigateForward(`/event/${eventId}`, true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      const eventId = this.route.snapshot.paramMap.get('id');
      if (eventId) await this.loadAnalytics(eventId);
    } finally {
      event.target.complete();
    }
  }

  downloadCSV() {
    this.isDownloading.set(true);
    setTimeout(() => {
      this.isDownloading.set(false);
    }, 2000);
  }

  onImageError(event: any): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }
}
