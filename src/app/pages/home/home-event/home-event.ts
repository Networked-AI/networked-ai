import { Subscription } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { EventService } from '@/services/event.service';
import { AuthService } from '@/services/auth.service';
import { EventCard } from '@/components/card/event-card';
import { ActivatedRoute, Router } from '@angular/router';
import { CityCard, ICity } from '@/components/card/city-card';
import { NavigationService } from '@/services/navigation.service';
import { UpcomingEventCard } from '@/components/card/upcoming-event-card';
import { HostFirstEventCard } from '@/components/card/host-first-event-card';
import { NoUpcomingEventCard } from '@/components/card/no-upcoming-event-card';
import { UserRecommendations } from '@/components/common/user-recommendations';
import { IonicSlides, IonSkeletonText } from '@ionic/angular/standalone';
import {
  signal,
  computed,
  Component,
  ChangeDetectionStrategy,
  inject,
  OnInit,
  OnDestroy,
  effect,
  CUSTOM_ELEMENTS_SCHEMA,
  ViewChild,
  ElementRef
} from '@angular/core';

interface NetworkSuggestion {
  id: string;
  name: string;
  location: string;
  distance: string;
  timeAgo: string;
  profileImage: string;
  mapImage: string;
}

@Component({
  selector: 'home-event',
  styleUrl: './home-event.scss',
  templateUrl: './home-event.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CityCard, EventCard, UpcomingEventCard, HostFirstEventCard, NoUpcomingEventCard, UserRecommendations, IonSkeletonText, NgTemplateOutlet]
})
export class HomeEvent implements OnInit, OnDestroy {
  // services
  navigationService = inject(NavigationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private eventService = inject(EventService);
  private authService = inject(AuthService);

  filter = signal<'browse' | 'upcoming'>('browse');
  isLoading = signal<boolean>(false);

  // variables
  swiperModules = [IonicSlides];
  private queryParamsSubscription?: Subscription;
  recommendedPage = signal(1);
  publicPage = signal(1);
  myEventsPage = signal(1);
  allEventsPage = signal(1);

  isLoadingMore = signal(false);
  hasMoreRecommended = signal(true);
  hasMorePublic = signal(true);
  hasMoreMyEvents = signal(true);
  hasMoreAllEvents = signal(true);
  @ViewChild('recommendedSwiper') recommendedSwiperRef?: ElementRef;
  @ViewChild('myEventsSwiper') myEventsSwiperRef?: ElementRef;
  @ViewChild('publicSwiper') publicSwiperRef?: ElementRef;
  @ViewChild('allEventsSwiper') allEventsSwiperRef?: ElementRef;
  readonly PAGE_LIMIT = 10;
  currentUser = this.authService.currentUser;
  isLoggedIn = computed(() => !!this.authService.currentUser());
  isAdmin = computed(() => !!this.currentUser()?.is_admin);

  private previousUserId: string | null = null;
  private previousLoginState: boolean | null = null;

  myEvents = computed(() => this.eventService.myEvents());
  recommendedEvents = computed(() => this.eventService.recommendedEvents());
  publicEvents = computed(() => this.eventService.publicEvents());
  allEvents = computed(() => this.eventService.allEvents());
  upcomingEvents = computed(() => this.eventService.upcomingEvents());

  cityCards = computed(() => this.eventService.cityCards());
  isLoadingCities = computed(() => this.eventService.isLoadingCities());

  networkSuggestions: NetworkSuggestion[] = [
    {
      id: '1',
      name: 'Alicia P.',
      location: 'Atlanta, GA',
      distance: '2.5 miles',
      timeAgo: '2m ago',
      profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
      mapImage: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=400&q=80'
    }
  ];

  isBrowseMode = computed(() => this.filter() === 'browse');
  isUpcomingMode = computed(() => this.filter() === 'upcoming');

  constructor() {
    effect(() => {
      const currentUser = this.currentUser();
      const currentUserId = currentUser?.id || null;
      const currentLoginState = this.isLoggedIn();

      if (this.previousLoginState === null) {
        this.previousUserId = currentUserId;
        this.previousLoginState = currentLoginState;

        this.loadEventsIfNeeded();
        this.loadTopCities();
        return;
      }

      const loginStateChanged = this.previousLoginState !== currentLoginState;
      const userIdChanged = this.previousUserId !== null && this.previousUserId !== currentUserId;

      if (userIdChanged) {
        this.handleAccountChangeAndLogin();
      } else if (loginStateChanged && currentLoginState && !this.previousLoginState) {
        this.handleAccountChangeAndLogin();
      } else if (loginStateChanged && !currentLoginState && this.previousLoginState) {
        // User logged out - reset filter to browse and reset cities
        this.filter.set('browse');
        this.eventService.cityCards.set([]);
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { eventFilter: 'browse' },
          queryParamsHandling: 'merge'
        });
      }

      this.previousUserId = currentUserId;
      this.previousLoginState = currentLoginState;
    });
  }

  ngOnInit(): void {
    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      const eventFilter = params['eventFilter'];
      const tab = params['tab'];

      if (eventFilter === 'browse' || eventFilter === 'upcoming') {
        this.filter.set(eventFilter as 'browse' | 'upcoming');
      } else {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { eventFilter: this.filter(), tab: tab || 'events' },
          queryParamsHandling: 'merge',
          replaceUrl: true
        });
      }
    });
  }

  private async loadEventsIfNeeded(): Promise<void> {
    const hasRecommendedEvents = this.eventService.recommendedEvents().length > 0;
    const hasPublicEvents = this.eventService.publicEvents().length > 0;
    const hasMyEvents = this.eventService.myEvents().length > 0;
    const hasUpcomingEvents = this.eventService.upcomingEvents().length > 0;
    const loggedIn = this.isLoggedIn();

    if (loggedIn && hasRecommendedEvents && hasPublicEvents && hasMyEvents) return;
    if (!loggedIn && hasPublicEvents) return;

    // Only load if events don't exist
    if (!loggedIn) {
      if (!hasPublicEvents) {
        await this.loadPublicEvents();
      }
    } else {
      if (this.isAdmin() && this.eventService.allEvents().length === 0) {
        this.loadAllEventsSection();
      }
      if (!hasRecommendedEvents && !hasPublicEvents && !hasMyEvents) {
        await this.loadAllEvents();
      } else if (!hasRecommendedEvents) {
        await this.loadRecommendedEvents();
      } else if (!hasPublicEvents) {
        await this.loadPublicEvents();
      } else if (!hasMyEvents) {
        await this.loadMyEvents();
      }

      // Load upcoming events if in upcoming mode and not already loaded
      if (!hasUpcomingEvents) {
        await this.loadUpcomingEvents();
      }
    }
  }

  private async loadMyEvents(reset: boolean = true): Promise<void> {
    if (!this.isLoggedIn()) return;

    try {
      this.isLoading.set(true);
      const res = await this.eventService.getEvents({
        limit: this.PAGE_LIMIT,
        append: !reset,
        roles: 'Host,CoHost,Sponsor',
        is_my_events: true,
        user_id: this.currentUser()?.id,
        start_date: new Date().toString(),
        from_home: true
      });
      const p = res?.data?.pagination;
      this.hasMoreMyEvents.set((p?.currentPage ?? 1) < (p?.totalPages ?? 1));
      if (reset) this.myEventsPage.set(1);
    } catch (error) {
      console.error('Error loading my events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async handleAccountChangeAndLogin(): Promise<void> {
    this.eventService.resetAllEvents();
    this.eventService.cityCards.set([]);
    this.resetPagination();
    if (this.isAdmin()) this.loadAllEventsSection(true);
    await this.loadAllEvents(true);
    await this.loadUpcomingEvents();
    await this.loadTopCities(true);
  }

  private async loadRecommendedEvents(reset: boolean = true): Promise<void> {
    if (!this.isLoggedIn()) return;

    try {
      this.isLoading.set(true);
      const res = await this.eventService.getEvents({
        limit: this.PAGE_LIMIT,
        append: !reset,
        is_recommended: true,
        start_date: new Date().toString(),
        from_home: true
      });
      const p = res?.data?.pagination;
      this.hasMoreRecommended.set((p?.currentPage ?? 1) < (p?.totalPages ?? 1));
      if (reset) this.recommendedPage.set(1);
    } catch (error) {
      console.error('Error loading recommended events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadPublicEvents(reset: boolean = true): Promise<void> {
    try {
      this.isLoading.set(true);
      const res = await this.eventService.getEvents({
        is_public: true,
        limit: this.PAGE_LIMIT,
        append: !reset,
        start_date: new Date().toString(),
        from_home: true
      });
      const p = res?.data?.pagination;
      this.hasMorePublic.set((p?.currentPage ?? 1) < (p?.totalPages ?? 1));
      if (reset) this.publicPage.set(1);
    } catch (error) {
      console.error('Error loading public events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadAllEventsSection(reset: boolean = true): Promise<void> {
    if (!this.isAdmin()) return;

    try {
      this.isLoading.set(true);
      const res = await this.eventService.getEvents({
        page: reset ? 1 : this.allEventsPage(),
        limit: this.PAGE_LIMIT,
        append: !reset,
        order_by: 'start_date',
        order_direction: 'DESC',
        from_home: true,
        is_all_events: true
      });
      const p = res?.data?.pagination;
      this.hasMoreAllEvents.set((p?.currentPage ?? 1) < (p?.totalPages ?? 1));
      if (reset) this.allEventsPage.set(1);
    } catch (error) {
      console.error('Error loading all events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadAllEvents(reset: boolean = true): Promise<void> {
    try {
      this.isLoading.set(true);
      const loggedIn = this.isLoggedIn();

      if (!loggedIn) {
        const res = await this.eventService.getEvents({
          is_public: true,
          limit: this.PAGE_LIMIT,
          append: !reset,
          start_date: new Date().toString(),
          from_home: true
        });
        const p = res?.data?.pagination;
        this.hasMorePublic.set((p?.currentPage ?? 1) < (p?.totalPages ?? 1));
      } else {
        const [rec, pub, mine] = await Promise.all([
          this.eventService.getEvents({
            limit: this.PAGE_LIMIT,
            append: !reset,
            is_recommended: true,
            start_date: new Date().toString(),
            from_home: true
          }),
          this.eventService.getEvents({
            limit: this.PAGE_LIMIT,
            is_public: true,
            append: !reset,
            start_date: new Date().toString(),
            from_home: true
          }),
          this.eventService.getEvents({
            limit: this.PAGE_LIMIT,
            append: !reset,
            roles: 'Host,CoHost,Sponsor',
            is_my_events: true,
            user_id: this.currentUser()?.id,
            start_date: new Date().toString(),
            from_home: true
          })
        ]);

        // ✅ set hasMore from page 1 response
        const rp = rec?.data?.pagination;
        const pp = pub?.data?.pagination;
        const mp = mine?.data?.pagination;
        this.hasMoreRecommended.set((rp?.currentPage ?? 1) < (rp?.totalPages ?? 1));
        this.hasMorePublic.set((pp?.currentPage ?? 1) < (pp?.totalPages ?? 1));
        this.hasMoreMyEvents.set((mp?.currentPage ?? 1) < (mp?.totalPages ?? 1));
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
  ngOnDestroy(): void {
    this.queryParamsSubscription?.unsubscribe();
  }

  onFilterChange(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { eventFilter: this.filter() },
      queryParamsHandling: 'merge'
    });
  }

  async refresh(): Promise<void> {
    try {
      this.eventService.resetAllEvents();
      this.resetPagination();
      this.loadAllEvents(true);
      if (this.isLoggedIn()) this.loadUpcomingEvents(true);
      if (this.isAdmin()) this.loadAllEventsSection(true);
      this.loadTopCities(true);
    } catch (error) {
      console.error('Error refreshing events:', error);
    }
  }

  private async loadTopCities(reset: boolean = false): Promise<void> {
    if (!reset && this.eventService.cityCards().length > 0) return;

    try {
      this.eventService.isLoadingCities.set(true);
      const cities = await this.eventService.getTopCities();
      this.eventService.cityCards.set(cities);
    } catch (error) {
      console.error('Error loading top cities:', error);
    } finally {
      this.eventService.isLoadingCities.set(false);
    }
  }

  onCityClick(city: ICity): void {
    this.navigationService.navigateForward(`/event/city?city=${encodeURIComponent(city.city || '')}&state=${encodeURIComponent(city.state)}`, false, {
      city: city
    });
  }

  private async loadUpcomingEvents(reset: boolean = true): Promise<void> {
    if (!this.isLoggedIn()) return;

    const currentUser = this.currentUser();
    if (!currentUser?.id) return;

    try {
      this.isLoading.set(true);
      await this.eventService.getEvents({
        page: 1,
        limit: 3,
        roles: 'Host,CoHost,Sponsor,Speaker,Staff,Attendees',
        user_id: currentUser.id,
        is_upcoming_event: true,
        append: !reset,
        from_home: true
      });
    } catch (error) {
      console.error('Error loading upcoming events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }
  onReachEnd(event: any, type: 'recommended' | 'public' | 'myEvents' | 'allEvents'): void {
    const swiper = event?.detail?.[0];
    if (!swiper?.isEnd) return;

    switch (type) {
      case 'recommended':
        this.onRecommendedSlideEnd();
        break;
      case 'public':
        this.onPublicSlideEnd();
        break;
      case 'myEvents':
        this.onMyEventsSlideEnd();
        break;
      case 'allEvents':
        this.onAllEventsSlideEnd();
        break;
    }
  }
  
  private updateSwiper(ref?: ElementRef, previousSlideIndex?: number): void {
    setTimeout(() => {
      const swiper = ref?.nativeElement?.swiper;
      if (!swiper) return;
      swiper.update();
      if (previousSlideIndex !== undefined) {
        swiper.slideTo(previousSlideIndex, 0, false);
      }
    }, 100);
  }
  async onRecommendedSlideEnd(): Promise<void> {
    if (this.isLoadingMore() || !this.hasMoreRecommended()) return;
    const nextPage = this.recommendedPage() + 1;
    // ✅ capture current index BEFORE loading
    const currentIndex = this.recommendedSwiperRef?.nativeElement?.swiper?.activeIndex ?? 0;
    try {
      this.isLoadingMore.set(true);
      const response = await this.eventService.getEvents({
        page: nextPage,
        limit: this.PAGE_LIMIT,
        append: true,
        is_recommended: true,
        start_date: new Date().toString(),
        from_home: true
      });
      const pagination = response?.data?.pagination;
      this.hasMoreRecommended.set((pagination?.currentPage ?? nextPage) < (pagination?.totalPages ?? 1));
      this.recommendedPage.set(nextPage);
      this.updateSwiper(this.recommendedSwiperRef, currentIndex); // ✅ restore position
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  async onPublicSlideEnd(): Promise<void> {
    if (this.isLoadingMore() || !this.hasMorePublic()) return;
    const nextPage = this.publicPage() + 1;
    const currentIndex = this.publicSwiperRef?.nativeElement?.swiper?.activeIndex ?? 0;
    try {
      this.isLoadingMore.set(true);
      const response = await this.eventService.getEvents({
        page: nextPage,
        limit: this.PAGE_LIMIT,
        append: true,
        is_public: true,
        start_date: new Date().toString(),
        from_home: true
      });
      const pagination = response?.data?.pagination;
      this.hasMorePublic.set((pagination?.currentPage ?? nextPage) < (pagination?.totalPages ?? 1));
      this.publicPage.set(nextPage);
      this.updateSwiper(this.publicSwiperRef, currentIndex);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  async onMyEventsSlideEnd(): Promise<void> {
    if (this.isLoadingMore() || !this.hasMoreMyEvents()) return;
    const nextPage = this.myEventsPage() + 1;
    const currentIndex = this.myEventsSwiperRef?.nativeElement?.swiper?.activeIndex ?? 0;
    try {
      this.isLoadingMore.set(true);
      const response = await this.eventService.getEvents({
        page: nextPage,
        limit: this.PAGE_LIMIT,
        append: true,
        roles: 'Host,CoHost,Sponsor',
        is_my_events: true,
        user_id: this.currentUser()?.id,
        start_date: new Date().toString(),
        from_home: true
      });
      const pagination = response?.data?.pagination;
      this.hasMoreMyEvents.set((pagination?.currentPage ?? nextPage) < (pagination?.totalPages ?? 1));
      this.myEventsPage.set(nextPage);
      this.updateSwiper(this.myEventsSwiperRef, currentIndex);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  async onAllEventsSlideEnd(): Promise<void> {
    if (!this.isAdmin() || this.isLoadingMore() || !this.hasMoreAllEvents()) return;
    const nextPage = this.allEventsPage() + 1;
    const currentIndex = this.allEventsSwiperRef?.nativeElement?.swiper?.activeIndex ?? 0;
    try {
      this.isLoadingMore.set(true);
      const response = await this.eventService.getEvents({
        page: nextPage,
        limit: this.PAGE_LIMIT,
        append: true,
        order_by: 'start_date',
        order_direction: 'DESC',
        from_home: true,
        is_all_events: true
      });
      const pagination = response?.data?.pagination;
      this.hasMoreAllEvents.set((pagination?.currentPage ?? nextPage) < (pagination?.totalPages ?? 1));
      this.allEventsPage.set(nextPage);
      this.updateSwiper(this.allEventsSwiperRef, currentIndex);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  private resetPagination(): void {
    this.recommendedPage.set(1);
    this.publicPage.set(1);
    this.myEventsPage.set(1);
    this.allEventsPage.set(1);
    this.hasMoreRecommended.set(true);
    this.hasMorePublic.set(true);
    this.hasMoreMyEvents.set(true);
    this.hasMoreAllEvents.set(true);
  }
}
