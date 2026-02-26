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
import { QuestionnaireAnalytics } from '../components/questionnaire-analytics';
import { IonContent, IonToolbar, IonHeader, IonSpinner } from '@ionic/angular/standalone';
import { Subject, debounceTime, distinctUntilChanged, from, switchMap, takeUntil } from 'rxjs';
import { Component, computed, inject, signal, ChangeDetectionStrategy, effect, OnInit, untracked, OnDestroy } from '@angular/core';
import { IonInfiniteScrollContent, IonInfiniteScroll, IonRefresher, IonRefresherContent, RefresherCustomEvent } from '@ionic/angular/standalone';
@Component({
  selector: 'questionnaire-response',
  styleUrl: './questionnaire-response.scss',
  templateUrl: './questionnaire-response.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonSpinner,
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
export class QuestionnaireResponse implements OnInit, OnDestroy {
  searchSubject = new Subject<string>();
  destroy$ = new Subject<void>();

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
  isInitialLoading = signal(true);
  isDataLoading = signal(false);
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

  async ngOnInit(): Promise<void> {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((searchValue) => {
          this.searchQuery.set(searchValue);
          this.currentPage.set(1);
          this.analytics.set([]);
          return from(this.loadData());
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();

    try {
      this.isInitialLoading.set(true);

      if (!this.isLoggedIn()) {
        const result = await this.modalService.openLoginModal();
        if (!result?.success) return;
      }

      const id = this.route.snapshot.paramMap.get('id');
      if (!id) return;

      this.eventId.set(id);
      await this.checkAccessAndLoadData();
    } finally {
      this.isInitialLoading.set(false);
    }
  }

  async reloadData(): Promise<void> {
    this.searchQuery.set('');
    this.searchSubject.next('');
    this.currentPage.set(1);
    this.analytics.set([]);
    await this.loadData();
  }

  async onSegmentChange(value: string) {
    if (this.segmentValue() === value) return; 
    this.segmentValue.set(value);
    await this.reloadData();
  }

  async onFilterChange(value: 'responses' | 'analytics') {
    if (this.filter() === value) return; 

    this.filter.set(value);
    await this.reloadData();
  }

  async checkAccessAndLoadData(): Promise<void> {
    try {
      const eventId = this.eventId();
      if (!eventId) return;

      const eventData = await this.eventService.getEventById(eventId);

      this.eventData.set(eventData);

      if (!this.eventService.checkHostOrCoHostAccess(eventData)) {
        this.isHost.set(false);
        this.onFilterChange('analytics');
      }else{
        this.loadData();
      }
    } catch (error) {
      console.error('Error checking access:', error);
      this.navigationService.navigateForward(`/event/${this.eventId()}`, true);
    }
  }

  loadData = async (): Promise<void> => {
    if (this.isDataLoading()) return;

    try {
      this.isDataLoading.set(true);

      const eventId = this.eventId() || '';
      const phase = this.segmentValue() === 'pre-event' ? 'PreEvent' : 'PostEvent';
      const search = this.searchQuery() || '';

      let response;

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
      this.toasterService.showError('Failed to load data');
    } finally {
      this.isDataLoading.set(false);
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
        response = await this.eventService.getEventQuestionAnalysis(eventId, this.isHost() ? phase : '');

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

  async onRefresh(event: RefresherCustomEvent) {
    try {
      await this.reloadData();
    } finally {
      event.target.complete();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
