import { ModalService } from '@/services/modal.service';
import { EventService } from '@/services/event.service';
import { Searchbar } from '@/components/common/searchbar';
import { EmptyState } from '@/components/common/empty-state';
import {
  ModalController,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonContent,
  IonHeader,
  IonToolbar
} from '@ionic/angular/standalone';
import { PostEventCard } from '@/components/card/post-event-card';
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { IEvent } from '@/interfaces/event';
import { AuthService } from '@/services/auth.service';

@Component({
  selector: 'post-event-modal',
  imports: [Searchbar, PostEventCard, EmptyState, IonSpinner, IonInfiniteScroll, IonInfiniteScrollContent, IonContent, IonHeader, IonToolbar],
  styleUrl: './post-event-modal.scss',
  templateUrl: './post-event-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostEventModal implements OnInit {
  private modalCtrl = inject(ModalController);
  private modalService = inject(ModalService);
  private eventService = inject(EventService);
  private authService = inject(AuthService);

  searchQuery = signal<string>('');
  segmentValue = signal<'All Events' | 'My Events'>('All Events');

  // Cache events for both tabs
  allEvents = signal<IEvent[]>([]);
  myEvents = signal<IEvent[]>([]);

  // Loading states for each tab
  isLoadingAllEvents = signal<boolean>(false);
  isLoadingMyEvents = signal<boolean>(false);

  // Loading more states for infinite scroll
  isLoadingMoreAllEvents = signal<boolean>(false);
  isLoadingMoreMyEvents = signal<boolean>(false);

  // Pagination state for each tab
  private allEventsPage = signal<number>(1);
  private myEventsPage = signal<number>(1);
  private allEventsTotalPages = signal<number>(0);
  private myEventsTotalPages = signal<number>(0);

  private readonly pageLimit = 10;
  private searchTimeout?: ReturnType<typeof setTimeout>;

  currentUser = computed(() => this.authService.currentUser());

  // Computed to get current events based on selected tab
  events = computed(() => {
    return this.segmentValue() === 'All Events' ? this.allEvents() : this.myEvents();
  });

  // Computed to get current loading state
  isLoading = computed(() => {
    return this.segmentValue() === 'All Events' ? this.isLoadingAllEvents() : this.isLoadingMyEvents();
  });

  // Computed to get current loading more state
  isLoadingMore = computed(() => {
    return this.segmentValue() === 'All Events' ? this.isLoadingMoreAllEvents() : this.isLoadingMoreMyEvents();
  });

  hasMore = computed(() => {
    const includeParticipantEvents = this.segmentValue() === 'All Events';
    if (includeParticipantEvents) {
      return this.allEventsPage() < this.allEventsTotalPages();
    } else {
      return this.myEventsPage() < this.myEventsTotalPages();
    }
  });

  ngOnInit(): void {
    this.loadEvents();
  }

  private getRoles(): string {
    return this.segmentValue() === 'All Events'
      ? 'Host,CoHost,Sponsor,Speaker,Staff,Attendees'
      : 'Host,CoHost';
  }

  async loadEvents(reset: boolean = true): Promise<void> {
    const includeParticipantEvents = this.segmentValue() === 'All Events';
    const search = this.searchQuery() || undefined;

    try {
      // Set loading state for current tab
      if (includeParticipantEvents) {
        this.isLoadingAllEvents.set(true);
      } else {
        this.isLoadingMyEvents.set(true);
      }

      // Always reset pagination and events when resetting
      if (reset) {
        if (includeParticipantEvents) {
          this.allEventsPage.set(1);
          this.allEvents.set([]);
        } else {
          this.myEventsPage.set(1);
          this.myEvents.set([]);
        }
      }

      const currentPage = includeParticipantEvents ? this.allEventsPage() : this.myEventsPage();

      const response = await this.eventService.getEvents({
        page: currentPage,
        limit: this.pageLimit,
        search,
        user_id:this.currentUser()?.id,
        roles: this.getRoles()
      });

      const events = response?.data?.data || [];
      const pagination = response?.data?.pagination;

      // Store events in appropriate cache
      if (includeParticipantEvents) {
        if (reset) {
          this.allEvents.set(events);
        } else {
          this.allEvents.update((current) => [...current, ...events]);
        }
        this.allEventsTotalPages.set(pagination?.totalPages || 0);
      } else {
        if (reset) {
          this.myEvents.set(events);
        } else {
          this.myEvents.update((current) => [...current, ...events]);
        }
        this.myEventsTotalPages.set(pagination?.totalPages || 0);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      // Clear loading state for current tab
      if (includeParticipantEvents) {
        this.isLoadingAllEvents.set(false);
      } else {
        this.isLoadingMyEvents.set(false);
      }
    }
  }

  async loadMoreEvents(event: Event): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    const includeParticipantEvents = this.segmentValue() === 'All Events';
    const search = this.searchQuery() || undefined;

    try {
      // Set loading more state for current tab
      if (includeParticipantEvents) {
        this.isLoadingMoreAllEvents.set(true);
      } else {
        this.isLoadingMoreMyEvents.set(true);
      }

      // Get next page (don't update yet, wait for successful response)
      const currentPage = includeParticipantEvents ? this.allEventsPage() : this.myEventsPage();
      const nextPage = currentPage + 1;

      const response = await this.eventService.getEvents({
        page: nextPage,
        limit: this.pageLimit,
        search,
        user_id:this.currentUser()?.id,
        roles: this.getRoles()
      });

      const events = response?.data?.data || [];
      const pagination = response?.data?.pagination;

      // Only update if we got events
      if (events.length > 0) {
        // Update page number after successful response
        if (includeParticipantEvents) {
          this.allEventsPage.set(nextPage);
          this.allEvents.update((current) => [...current, ...events]);
          this.allEventsTotalPages.set(pagination?.totalPages || 0);
        } else {
          this.myEventsPage.set(nextPage);
          this.myEvents.update((current) => [...current, ...events]);
          this.myEventsTotalPages.set(pagination?.totalPages || 0);
        }
      } else {
        // No more events, update total pages to prevent further loads
        if (includeParticipantEvents) {
          this.allEventsTotalPages.set(currentPage);
        } else {
          this.myEventsTotalPages.set(currentPage);
        }
      }
    } catch (error) {
      console.error('Error loading more events:', error);
    } finally {
      if (includeParticipantEvents) {
        this.isLoadingMoreAllEvents.set(false);
      } else {
        this.isLoadingMoreMyEvents.set(false);
      }
      infiniteScroll.complete();
    }
  }

  onSearchChange(event: any) {
    this.searchQuery.set(event);
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.loadEvents(true);
    }, 500);
  }

  onSegmentChange(segment: 'All Events' | 'My Events'): void {
    this.segmentValue.set(segment);

    // Reset loading more states
    this.isLoadingMoreAllEvents.set(false);
    this.isLoadingMoreMyEvents.set(false);

    // Always reset and load fresh data when switching tabs
    this.loadEvents(true);
  }

  close() {
    this.modalCtrl.dismiss();
  }

  // Since API handles search filtering, we just return events directly
  filteredEvents = computed(() => {
    return this.events();
  });

  onAdd(event: IEvent) {
    this.modalCtrl.dismiss(event);
    this.modalService.close();
  }
}
