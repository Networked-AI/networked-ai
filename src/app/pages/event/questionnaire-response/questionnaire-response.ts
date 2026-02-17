import { Chip } from '@/components/common/chip';
import { Button } from '@/components/form/button';
import { ActivatedRoute } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { EventService } from '@/services/event.service';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { Searchbar } from '@/components/common/searchbar';
import { ViewResponse } from '../components/view-response';
import { ToasterService } from '@/services/toaster.service';
import { EmptyState } from '@/components/common/empty-state';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { SegmentButton } from '@/components/common/segment-button';
import { IonContent, IonToolbar, IonHeader } from '@ionic/angular/standalone';
import { QuestionnaireAnalytics } from '../components/questionnaire-analytics';
import { Component, computed, inject, signal, ChangeDetectionStrategy, effect, OnInit } from '@angular/core';
import { IonInfiniteScrollContent, IonInfiniteScroll, IonRefresher, IonRefresherContent, RefresherCustomEvent } from '@ionic/angular/standalone';
@Component({
  selector: 'questionnaire-response',
  styleUrl: './questionnaire-response.scss',
  templateUrl: './questionnaire-response.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonToolbar,
    IonContent,
    IonHeader,
    IonRefresher,
    IonRefresherContent,
    Chip,
    Searchbar,
    Button,
    ViewResponse,
    QuestionnaireAnalytics,
    EmptyState,
    NgOptimizedImage,
    SegmentButton
  ]
})
export class QuestionnaireResponse implements OnInit {
  navigationService = inject(NavigationService);
  route = inject(ActivatedRoute);
  eventService = inject(EventService);
  authService = inject(AuthService);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);

  isLoggedIn = computed(() => !!this.authService.currentUser());

  user = signal<any>(null);
  questions = signal<any>(null);
  isHost = signal<boolean>(true);
  isLoading = signal<boolean>(false);
  searchQuery = signal<string>('');
  isDownloading = signal<boolean>(false);
  isViewResponse = signal<boolean>(false);
  totalResponses = signal<number>(0);
  filter = signal<'responses' | 'analytics'>('responses');
  segmentValue = signal<string>('pre-event');
  isLoadingMore = signal<boolean>(false);
  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  analytics = signal<any[]>([]);
  eventId = signal<string>('');
  eventData = signal<any | null>(null);

  hasMore = computed(() => this.currentPage() < this.totalPages());
  isResponsesMode = computed(() => (this.segmentValue() === 'pre-event' || this.segmentValue() === 'post-event') && this.filter() === 'responses');
  segmentItems = computed(() => [
    { value: 'pre-event', label: 'Pre-Event' },
    { value: 'post-event', label: 'Post-Event' }
  ]);

  constructor() {
    effect(() => {
      const segment = this.segmentValue();
      const filter = this.filter();
      const eventId = this.eventId();

      // prevent firing before required data exists
      if (!segment || !filter || !eventId) return;

      this.loadData();
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.isLoggedIn()) {
      const result = await this.modalService.openLoginModal();
      if (!result?.success) {
        return;
      }
    }

    const eventId = this.route.snapshot.paramMap.get('id');
    if (eventId) {
      this.eventId.set(eventId);
      // Check host/cohost access before loading data
      await this.checkAccessAndLoadData();
    }
  }

  private async checkAccessAndLoadData(): Promise<void> {
    try {
      this.isLoading.set(true); // ✅ start loading
      const eventId = this.eventId();
      if (!eventId) return;

      const eventData = await this.eventService.getEventById(eventId);
      this.eventData.set(eventData);

      if (!this.eventService.checkHostOrCoHostAccess(eventData)) {
        this.isHost.set(false);
      }

      if (!this.isHost()) {
        this.filter.set('analytics');
      }
    } catch (error) {
      console.error('Error checking access:', error);
      this.navigationService.navigateForward(`/event/${this.eventId()}`, true);
    } finally {
      this.isLoading.set(false);
    }
  }

  loadData = async () => {
    const eventId = this.eventId() || '';
    const phase = this.segmentValue() === 'pre-event' ? 'PreEvent' : 'PostEvent';
    const search = this.searchQuery() || '';

    try {
      this.isLoading.set(true); // ✅ start loading

      let response: any;

      if (this.filter() === 'responses') {
        response = await this.eventService.getEventQuestionnaireResponses(eventId, phase, search);

        this.analytics.set(response?.users || []);
        this.totalResponses.set(response?.pagination?.totalCount || 0);
        this.totalPages.set(response?.pagination?.totalPages || 0);
      } else {
        response = await this.eventService.getEventQuestionAnalysis(eventId, phase);

        this.analytics.set(response?.questions || []);
        this.totalResponses.set(response?.total_responses || 0);
        this.totalPages.set(response?.pagination?.totalPages || 0);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.toasterService.showError('Failed to load data');
    } finally {
      this.isLoading.set(false);
    }
  };

  loadMoreUsers = async (event: Event): Promise<void> => {
    const infiniteScroll = event.target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);

      const nextPage = this.currentPage() + 1;
      const eventId = this.eventId() || '';
      const phase = this.segmentValue() === 'pre-event' ? 'PreEvent' : 'PostEvent';
      const search = this.searchQuery() || '';

      let response: any;

      if (this.filter() === 'responses') {
        response = await this.eventService.getEventQuestionnaireResponses(eventId, phase, search, nextPage, 20);

        this.analytics.update((current) => [...current, ...(response?.users || [])]);

        this.totalPages.set(response?.pagination?.totalPages || 0);
      } else {
        response = await this.eventService.getEventQuestionAnalysis(eventId, this.isHost() ? phase : '', nextPage, 20);

        this.analytics.update((current) => [...current, ...(response?.questions || [])]);

        this.totalPages.set(response?.pagination?.totalPages || 0);
      }

      this.currentPage.set(nextPage);
    } catch (error) {
      console.error('Error loading more data:', error);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  };

  goBack() {
    if (this.isViewResponse()) {
      this.isViewResponse.set(false);
    } else {
      this.navigationService.back();
    }
  }

  viewResponse = async (user: any) => {
    this.isViewResponse.set(true);
    const response = await this.eventService.getEventQuestionnaireResponsesByUserId(
      user.id,
      this.eventId() || '',
      this.segmentValue() === 'pre-event' ? 'PreEvent' : 'PostEvent'
    );
    this.user.set(user);
    this.questions.set(response?.questions);
  };

  downloadResponses() {
    this.isDownloading.set(true);
    setTimeout(() => {
      this.isDownloading.set(false);
    }, 2000);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  diamondPath = computed(() => {
    const points = this.user()?.total_gamification_points || 0;

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
  });

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      this.currentPage.set(1);
      await this.loadData();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete();
    }
  }
}
