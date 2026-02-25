import { Subscription } from 'rxjs';
import { IEvent } from '@/interfaces/event';
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
import { signal, computed, Component, ChangeDetectionStrategy, inject, OnInit, OnDestroy, effect, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

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
  imports: [CityCard, EventCard, UpcomingEventCard, HostFirstEventCard, NoUpcomingEventCard, UserRecommendations, IonSkeletonText]
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

  currentUser = this.authService.currentUser;
  isLoggedIn = computed(() => !!this.authService.currentUser());

  private previousUserId: string | null = null;
  private previousLoginState: boolean | null = null;

  myEvents = computed(() => this.eventService.myEvents());
  recommendedEvents = computed(() => this.eventService.recommendedEvents());
  publicEvents = computed(() => this.eventService.publicEvents());
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
      await this.eventService.getEvents({
        limit: 3,
        append: !reset,
        roles: 'Host,CoHost,Sponsor',
        is_my_events: true,
        user_id: this.currentUser()?.id,
        start_date: new Date().toString(),
        from_home: true
      });
    } catch (error) {
      console.error('Error loading my events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async handleAccountChangeAndLogin(): Promise<void> {
    this.eventService.resetAllEvents();
    this.eventService.cityCards.set([]);
    await this.loadAllEvents(true);
    await this.loadUpcomingEvents();
    await this.loadTopCities(true);
  }

  private async loadRecommendedEvents(reset: boolean = true): Promise<void> {
    // Don't call API if user is not logged in
    if (!this.isLoggedIn()) {
      return;
    }

    try {
      this.isLoading.set(true);
      await this.eventService.getEvents({
        limit: 3,
        append: !reset,
        is_recommended: true,
        start_date: new Date().toString(),
        from_home: true
      });
    } catch (error) {
      console.error('Error loading recommended events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadPublicEvents(reset: boolean = true): Promise<void> {
    try {
      this.isLoading.set(true);
      await this.eventService.getEvents({
        is_public: true,
        limit: 3,
        append: !reset,
        start_date: new Date().toString(),
        from_home: true
      });
    } catch (error) {
      console.error('Error loading public events:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadAllEvents(reset: boolean = true): Promise<void> {
    try {
      this.isLoading.set(true);
      const loggedIn = this.isLoggedIn();

      if (!loggedIn) {
        // When not logged in, only load public events
        await this.loadPublicEvents(reset);
      } else {
        // When logged in, load both recommended and public events
        await Promise.all([
          this.eventService.getEvents({
            limit: 3,
            append: !reset,
            is_recommended: true,
            start_date: new Date().toString(),
            from_home: true
          }),
          this.eventService.getEvents({
            limit: 3,
            is_public: true,
            append: !reset,
            start_date: new Date().toString(),
            from_home: true
          }),
          this.eventService.getEvents({
            limit: 3,
            append: !reset,
            roles: 'Host,CoHost,Sponsor',
            is_my_events: true,
            user_id: this.currentUser()?.id,
            start_date: new Date().toString(),
            from_home: true
          })
        ]);
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
      this.loadAllEvents(true);
      if (this.isLoggedIn()) {
        this.loadUpcomingEvents(true);
      }
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
}
