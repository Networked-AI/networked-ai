import { IEvent } from '@/interfaces/event';
import { ActivatedRoute } from '@angular/router';
import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { EventService } from '@/services/event.service';
import { ModalService } from '@/services/modal.service';
import { CommonModule, DatePipe } from '@angular/common';
import { ToasterService } from '@/services/toaster.service';
import { EmptyState } from '@/components/common/empty-state';
import { NavigationService } from '@/services/navigation.service';
import { SubscriptionService } from '@/services/subscription.service';
import { SubscriptionEventCard } from '@/components/card/subscription-event-card';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import { Component, inject, ChangeDetectionStrategy, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { IonHeader, IonToolbar, IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonFooter } from '@ionic/angular/standalone';

interface Event {
  id: string;
  title: string;
  date: string;
  dayOfWeek: string;
  day: string;
  address: string;
  time: string;
  organization: string;
  image_url?: string;
  startDate?: Date; // Store original start date for filtering
}

@Component({
  selector: 'plan-events',
  templateUrl: './plan-events.html',
  styleUrl: './plan-events.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonFooter,
    Button,
    IonIcon,
    IonHeader,
    IonToolbar,
    IonContent,
    CommonModule,
    SubscriptionEventCard,
    SegmentButton,
    EmptyState,
    IonInfiniteScroll,
    IonInfiniteScrollContent
  ],
  providers: [DatePipe]
})
export class PlanEvents implements OnInit, OnDestroy {
  SPONSOR_GRADIENT =
    'radial-gradient(161.73% 107.14% at 9.38% -7.14%, #F9F2E6 13.46%, #F4D7A9 38.63%, rgba(201, 164, 105, 0.94) 69.52%, #BF9E69 88.87%, rgba(195, 167, 121, 0.9) 100%)';

  private route = inject(ActivatedRoute);
  private navigationService = inject(NavigationService);
  private eventService = inject(EventService);
  private subscriptionService = inject(SubscriptionService);
  private toasterService = inject(ToasterService);
  private modalService = inject(ModalService);
  private authService = inject(AuthService);
  private datePipe = new DatePipe('en-US');

  planId = signal<string | null>(null);
  planData = signal<any>(null);
  planName = signal<string>('');

  viewMode = signal<'included' | 'add'>('included');

  tabValue = signal<'upcoming' | 'completed'>('upcoming');

  includedEvents = signal<Event[]>([]);
  availableEvents = signal<Event[]>([]);
  selectedEventIds = signal<string[]>([]);

  isLoading = signal<boolean>(false);
  isLoadingEvents = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  isAddingEvents = signal<boolean>(false);

  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  pageLimit = 20;

  hasMore = computed(() => {
    return this.currentPage() < this.totalPages();
  });

  // Segment items for tabs
  tabItems: SegmentButtonItem[] = [
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'completed', label: 'Completed' }
  ];

  // Filtered included events based on tab
  filteredIncludedEvents = computed(() => {
    const events = this.includedEvents();
    const tab = this.tabValue();
    const now = new Date();

    return events.filter((event) => {
      const eventDateTime = event.startDate || (event.date ? new Date(event.date) : null);

      if (!eventDateTime || isNaN(eventDateTime.getTime())) return false;

      if (tab === 'upcoming') {
        return eventDateTime.getTime() > now.getTime();
      } else {
        return eventDateTime.getTime() < now.getTime();
      }
    });
  });

  groupedIncludedEvents = computed(() => {
    return this.groupEventsByMonth(this.filteredIncludedEvents());
  });

  filteredAvailableEvents = computed(() => {
    const events = this.availableEvents();
    const tab = this.tabValue();
    const now = new Date();

    return events.filter((event) => {
      const eventDateTime = event.startDate || (event.date ? new Date(event.date) : null);

      if (!eventDateTime || isNaN(eventDateTime.getTime())) return false;

      if (tab === 'upcoming') {
        return eventDateTime.getTime() > now.getTime();
      } else {
        return eventDateTime.getTime() < now.getTime();
      }
    });
  });

  groupedAvailableEvents = computed(() => {
    return this.groupEventsByMonth(this.filteredAvailableEvents());
  });

  groupedIncludedEventsKeys = computed(() => {
    const grouped = this.groupedIncludedEvents();
    return this.sortMonthKeys(Object.keys(grouped));
  });

  groupedAvailableEventsKeys = computed(() => {
    const grouped = this.groupedAvailableEvents();
    return this.sortMonthKeys(Object.keys(grouped));
  });

  selectedCount = computed(() => {
    return this.selectedEventIds().length;
  });

  buttonColor = computed(() => {
    const isSponsor = this.route.snapshot.queryParams['is_sponsor'] === 'true';
    return !isSponsor ? '#2B5BDE' : undefined;
  });

  headerTitle = computed(() => {
    return this.viewMode() === 'included' ? 'Events Included' : 'Add Event(s)';
  });

  headerDescription = computed(() => {
    const mode = this.viewMode();
    return mode === 'included' ? 'Events Included for' : 'Add event(s) to be part of';
  });

  showTabs = computed(() => {
    if (this.viewMode() === 'included') {
      return this.hasAnyIncludedEvents();
    }
    return true;
  });

  showIncludedEventsList = computed(() => {
    if (this.isLoading()) return false;
    const filteredEvents = this.filteredIncludedEvents();
    return filteredEvents.length > 0;
  });

  showAvailableEventsList = computed(() => {
    if (this.isLoadingEvents()) return false;
    const filteredEvents = this.filteredAvailableEvents();
    return filteredEvents.length > 0;
  });

  showIncludedEmptyState = computed(() => {
    if (this.isLoading()) return false;
    const filteredEvents = this.filteredIncludedEvents();
    return filteredEvents.length === 0;
  });

  showAvailableEmptyState = computed(() => {
    if (this.isLoadingEvents()) return false;
    const filteredEvents = this.filteredAvailableEvents();
    return filteredEvents.length === 0;
  });

  currentGroupedEvents = computed(() => {
    return this.viewMode() === 'included' ? this.groupedIncludedEvents() : this.groupedAvailableEvents();
  });

  currentGroupedEventsKeys = computed(() => {
    return this.viewMode() === 'included' ? this.groupedIncludedEventsKeys() : this.groupedAvailableEventsKeys();
  });

  showDeleteIcon = computed(() => {
    return this.viewMode() === 'included';
  });

  isEventCompleted(event: Event): boolean {
    if (!event) return false;
    const eventDateTime = event.startDate || (event.date ? new Date(event.date) : null);
    if (!eventDateTime || isNaN(eventDateTime.getTime())) return false;
    const now = new Date();
    return eventDateTime.getTime() < now.getTime();
  }

  showCheckbox = computed(() => {
    return this.viewMode() === 'add';
  });

  footerButtonConfig = computed(() => {
    const mode = this.viewMode();
    if (mode === 'included') {
      return {
        type: 'single' as const,
        label: '+ Add Event',
        color: this.buttonColor(),
        action: () => this.switchToAddMode()
      };
    } else {
      const selectedCount = this.selectedCount();
      return {
        type: 'dual' as const,
        cancelLabel: 'Cancel',
        confirmLabel: selectedCount > 0 ? `Add ${selectedCount} Event${selectedCount > 1 ? 's' : ''}` : 'Add Event',
        color: this.buttonColor(),
        disabled: selectedCount === 0 || this.isAddingEvents(),
        isLoading: this.isAddingEvents(),
        onCancel: () => this.cancelAddMode(),
        onConfirm: () => this.addSelectedEvents()
      };
    }
  });

  hasAnyIncludedEvents = computed(() => {
    const upcomingEvents = this.includedEvents().filter((event) => {
      const eventDateTime = event.startDate || (event.date ? new Date(event.date) : null);
      if (!eventDateTime || isNaN(eventDateTime.getTime())) return false;
      return eventDateTime.getTime() > new Date().getTime();
    });

    const completedEvents = this.includedEvents().filter((event) => {
      const eventDateTime = event.startDate || (event.date ? new Date(event.date) : null);
      if (!eventDateTime || isNaN(eventDateTime.getTime())) return false;
      return eventDateTime.getTime() < new Date().getTime();
    });

    return upcomingEvents.length > 0 || completedEvents.length > 0;
  });

  ngOnInit(): void {
    const planId = this.route.snapshot.paramMap.get('planId');
    if (planId) {
      this.planId.set(planId);
      this.loadPlanData();
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  async loadPlanData(): Promise<void> {
    const planId = this.planId();
    if (!planId) return;

    try {
      this.isLoading.set(true);
      const planData = await this.subscriptionService.getPlanById(planId);
      if (planData) {
        this.planData.set(planData);
        this.planName.set(planData.name || '');
        // Load included events - check if events are already in planData or use event_ids
        if (planData.events && planData.events.length > 0) {
          // Events are already included in the response
          const transformedEvents = planData.events.map((event: IEvent) => this.transformEventToSubscriptionEvent(event));
          this.includedEvents.set(transformedEvents);
        } else if (planData.event_ids && planData.event_ids.length > 0) {
          // Need to fetch events by IDs
          await this.loadIncludedEvents(planData.event_ids);
        } else {
          this.includedEvents.set([]);
        }
      }
    } catch (error) {
      console.error('Error loading plan data:', error);
      this.toasterService.showError('Failed to load plan data');
      this.navigationService.back();
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadIncludedEvents(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) {
      this.includedEvents.set([]);
      return;
    }

    try {
      this.isLoadingEvents.set(true);

      // Fetch events by getting all user's events and filtering by IDs
      const currentUser = this.authService.currentUser();
      const userId = currentUser?.id;

      if (!userId) {
        this.includedEvents.set([]);
        return;
      }

      const response = await this.eventService.getEvents({
        page: 1,
        limit: 100,
        order_by: 'start_date',
        order_direction: 'DESC',
        roles: 'Host',
        user_id: userId
      });

      const allEvents = response?.data?.data || [];
      const includedEventsData = allEvents.filter((event: IEvent) => event.id && eventIds.includes(event.id));

      const transformedEvents = includedEventsData.map((event: IEvent) => this.transformEventToSubscriptionEvent(event));

      this.includedEvents.set(transformedEvents);
    } catch (error) {
      console.error('Error loading included events:', error);
      this.toasterService.showError('Failed to load events');
    } finally {
      this.isLoadingEvents.set(false);
    }
  }

  private async fetchAvailableEvents(page: number): Promise<any> {
    const currentUser = this.authService.currentUser();
    const userId = currentUser?.id;

    if (!userId) {
      return { data: { data: [], pagination: {} } };
    }

    const isUpcoming = this.tabValue() === 'upcoming';
    const includedEventIds = this.planData()?.event_ids || [];

    return await this.eventService.getEvents({
      page,
      limit: this.pageLimit,
      order_by: 'start_date',
      order_direction: 'DESC',
      roles: 'Host',
      user_id: userId,
      ...(isUpcoming ? { is_upcoming_event: true } : {})
    });
  }

  private handleEventsResponse(response: any, reset: boolean, page: number): void {
    if (!response?.data?.data) return;

    const events = Array.isArray(response.data.data) ? response.data.data : [];
    const pagination = response?.data?.pagination || {};
    const totalPages = pagination.totalPages || pagination.total_pages || 0;
    const currentPageNum = pagination.currentPage || page;

    const includedEventIds = this.planData()?.event_ids || [];
    const filteredEvents = events.filter((event: IEvent) => !includedEventIds.includes(event.id || ''));

    const transformedEvents = filteredEvents.map((event: IEvent) => this.transformEventToSubscriptionEvent(event));

    if (reset) {
      this.availableEvents.set(transformedEvents);
    } else {
      this.availableEvents.update((existing) => [...existing, ...transformedEvents]);
    }

    this.currentPage.set(currentPageNum);
    this.totalPages.set(totalPages || Math.ceil((pagination.totalCount || 0) / this.pageLimit));
  }

  async loadAvailableEvents(reset: boolean = false): Promise<void> {
    try {
      if (reset) {
        this.isLoadingEvents.set(true);
      }

      const page = reset ? 1 : this.currentPage();
      const response = await this.fetchAvailableEvents(page);
      this.handleEventsResponse(response, reset, page);
    } catch (error) {
      console.error('Error loading available events:', error);
      if (reset) {
        this.availableEvents.set([]);
      }
    } finally {
      this.isLoadingEvents.set(false);
    }
  }

  async loadMoreEvents(event: any): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);
      const nextPage = this.currentPage() + 1;
      const response = await this.fetchAvailableEvents(nextPage);
      this.handleEventsResponse(response, false, nextPage);
    } catch (error) {
      console.error('Error loading more events:', error);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  }

  onTabChange(value: string): void {
    if (value === 'upcoming' || value === 'completed') {
      this.tabValue.set(value);
      this.currentPage.set(1);
      this.availableEvents.set([]);
      this.selectedEventIds.set([]);
      if (this.viewMode() === 'add') {
        this.loadAvailableEvents(true);
      }
    }
  }

  switchToAddMode(): void {
    this.viewMode.set('add');
    this.selectedEventIds.set([]);
    this.currentPage.set(1);
    this.availableEvents.set([]);
    this.loadAvailableEvents(true);
  }

  switchToIncludedMode(): void {
    this.viewMode.set('included');
  }

  toggleEventSelection(eventId: string): void {
    this.selectedEventIds.update((ids) => {
      if (ids.includes(eventId)) {
        return ids.filter((id) => id !== eventId);
      } else {
        return [...ids, eventId];
      }
    });
  }

  isEventSelected(eventId: string): boolean {
    return this.selectedEventIds().includes(eventId);
  }

  async removeEvent(eventId: string): Promise<void> {
    const planData = this.planData();
    if (!planData) return;

    const event = this.includedEvents().find((e) => e.id === eventId);
    const eventTitle = event?.title || 'this event';

    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/deleteWhiteIcon.svg',
      iconBgColor: '#C73838',
      title: 'Remove Event from This Plan?',
      description: `Are you sure you want to remove ${eventTitle} from this subscription plan?`,
      confirmButtonLabel: 'Remove',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left',
      onConfirm: async () => {
        try {
          const currentEventIds = planData.event_ids || [];
          const updatedEventIds = currentEventIds.filter((id: string) => id !== eventId);

          const payload = {
            name: planData.name,
            description: planData.description || '',
            prices: (planData.prices || []).map((price: any) => {
              const priceObj: any = {
                amount: Number(price.amount),
                interval: price.interval
              };
              if (price.interval === 'year') {
                const discountPercentage = price.discount_percentage;
                priceObj.discount_percentage = discountPercentage !== null && discountPercentage !== undefined ? Number(discountPercentage) : null;
                priceObj.banner_display_type = price.banner_display_type ?? null;
              }
              return priceObj;
            }),
            is_sponsor: planData.is_sponsor || false,
            plan_benefits: planData.plan_benefits || [],
            event_ids: updatedEventIds
          };

          const response = await this.subscriptionService.updatePlan(planData.id, payload);
          this.toasterService.showSuccess('Event removed successfully');

          await this.loadPlanData();
          return response;
        } catch (error) {
          console.error('Error removing event:', error);
          throw error;
        }
      }
    });

    if (result && result.role === 'error') {
      this.toasterService.showError('Failed to remove event. Please try again.');
    }
  }

  async addSelectedEvents(): Promise<void> {
    const planData = this.planData();
    if (!planData) return;

    const selectedIds = this.selectedEventIds();
    if (selectedIds.length === 0) {
      this.toasterService.showError('Please select at least one event');
      return;
    }

    this.isAddingEvents.set(true);
    try {
      const currentEventIds = planData.event_ids || [];
      const updatedEventIds = [...currentEventIds, ...selectedIds];

      const payload = {
        name: planData.name,
        description: planData.description || '',
        prices: (planData.prices || []).map((price: any) => {
          const priceObj: any = {
            amount: Number(price.amount),
            interval: price.interval
          };
          if (price.interval === 'year') {
            const discountPercentage = price.discount_percentage;
            priceObj.discount_percentage = discountPercentage !== null && discountPercentage !== undefined ? Number(discountPercentage) : null;
            priceObj.banner_display_type = price.banner_display_type ?? null;
          }
          return priceObj;
        }),
        is_sponsor: planData.is_sponsor || false,
        plan_benefits: planData.plan_benefits || [],
        event_ids: updatedEventIds
      };

      const response = await this.subscriptionService.updatePlan(planData.id, payload);

      const isSponsorValue = planData.is_sponsor ?? false;
      const color = !isSponsorValue ? '#2B5BDE' : '';
      const iconBgColor = isSponsorValue ? this.SPONSOR_GRADIENT : color;
      const icon = isSponsorValue ? 'assets/svg/subscription/calendar-check-sponsor.svg' : 'assets/svg/subscription/calendar-check-white.svg';
      const eventCount = selectedIds.length;
      const eventText = eventCount === 1 ? 'event' : 'events';

      await this.modalService.openConfirmModal({
        title: `${eventCount} ${eventCount === 1 ? 'Event' : 'Events'} Added`,
        description: `You've successfully added ${eventCount} ${eventText} as part of ${planData.name} subscription plan.`,
        confirmButtonLabel: 'Done',
        shareButtonLabel: 'Share',
        confirmButtonColor: 'primary',
        icon: icon,
        iconBgColor: iconBgColor,
        customColor: color,
        iconPosition: 'center',
        onShare: async () => {
          await this.modalService.openShareModal(response?.data?.id, 'Plan');
        }
      });

      this.viewMode.set('included');
      this.selectedEventIds.set([]);
      await this.loadPlanData();
    } catch (error) {
      console.error('Error adding events:', error);
      this.toasterService.showError('Failed to add events. Please try again.');
    } finally {
      this.isAddingEvents.set(false);
    }
  }

  cancelAddMode(): void {
    this.viewMode.set('included');
    this.selectedEventIds.set([]);
  }

  back(): void {
    this.navigationService.back();
  }

  private groupEventsByMonth(events: Event[]): { [key: string]: Event[] } {
    const grouped: { [key: string]: Event[] } = {};

    events.forEach((event) => {
      if (!event.date) return;

      const date = new Date(event.date);
      if (isNaN(date.getTime())) return;

      const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push(event);
    });

    Object.keys(grouped).forEach((month) => {
      grouped[month].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    });

    return grouped;
  }

  private sortMonthKeys(keys: string[]): string[] {
    return keys.sort((a, b) => {
      const dateA = this.parseMonthYear(a);
      const dateB = this.parseMonthYear(b);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });
  }

  private parseMonthYear(monthYear: string): Date | null {
    try {
      const date = new Date(monthYear + ' 1');
      if (isNaN(date.getTime())) {
        const date2 = new Date(monthYear + ' 1, ' + new Date().getFullYear());
        return isNaN(date2.getTime()) ? null : date2;
      }
      return date;
    } catch {
      return null;
    }
  }

  private transformEventToSubscriptionEvent(event: IEvent): Event {
    if (!event.start_date) {
      return {
        id: event.id || '',
        title: event.title || '',
        date: '',
        dayOfWeek: '',
        day: '',
        address: event.address || '',
        time: '',
        organization: this.getOrganization(event),
        image_url: event.image_url || ''
      };
    }

    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : null;

    const dayOfWeek = this.datePipe.transform(startDate, 'EEE') || '';
    const day = startDate.getDate().toString();
    const dateStr = this.datePipe.transform(startDate, 'yyyy-MM-dd') ?? '';

    const startTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    let timeStr = startTime;
    if (endDate) {
      const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      timeStr = `${startTime} - ${endTime}`;
    }

    return {
      id: event.id || '',
      title: event.title || '',
      date: dateStr,
      dayOfWeek,
      day,
      address: event.address || '',
      time: timeStr,
      organization: this.getOrganization(event),
      image_url: event.image_url || '',
      startDate: startDate
    };
  }

  private getOrganization(event: IEvent): string {
    const hostParticipant = event.participants?.find((p: any) => p.role === 'Host');
    return hostParticipant?.user?.name || 'Networked AI';
  }
}
