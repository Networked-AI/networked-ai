import {
  IonContent,
  IonFooter,
  IonToolbar,
  IonHeader,
  IonIcon,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  LoadingController
} from '@ionic/angular/standalone';
import { Subscription } from 'rxjs';
import { MenuModule } from 'primeng/menu';
import { IUser } from '@/interfaces/IUser';
import { Device } from '@capacitor/device';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { ActivatedRoute } from '@angular/router';
import { Button } from '@/components/form/button';
import { NgOptimizedImage } from '@angular/common';
import { OgService } from '@/services/og.service';
import { AuthService } from '@/services/auth.service';
import { EventService } from '@/services/event.service';
import { ModalService } from '@/services/modal.service';
import { MenuItem as PrimeMenuItem } from 'primeng/api';
import { ToasterService } from '@/services/toaster.service';
import { environment } from 'src/environments/environment';
import { EmptyState } from '@/components/common/empty-state';
import { EventDisplay } from '@/components/common/event-display';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { ManageEventService } from '@/services/manage-event.service';
import { OnInit, inject, signal, computed, Component, OnDestroy, ChangeDetectionStrategy, PLATFORM_ID } from '@angular/core';
import { BaseApiService } from '@/services/base-api.service';
import { MessagesService } from '@/services/messages.service';

@Component({
  selector: 'event',
  styleUrl: './event.scss',
  templateUrl: './event.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    IonIcon,
    IonFooter,
    IonHeader,
    IonContent,
    IonToolbar,
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    MenuModule,
    EventDisplay,
    NgOptimizedImage,
    EmptyState
  ]
})
export class Event implements OnInit, OnDestroy {
  route = inject(ActivatedRoute);
  authService = inject(AuthService);
  modalService = inject(ModalService);
  eventService = inject(EventService);
  toasterService = inject(ToasterService);
  manageService = inject(ManageEventService);
  navigationService = inject(NavigationService);
  platformId = inject(PLATFORM_ID);
  ogService = inject(OgService);
  loadingCtrl = inject(LoadingController);
  messagesService = inject(MessagesService);

  // subscriptions
  routeParamsSubscription?: Subscription;
  timerInterval?: any;

  // SIGNALS
  timerTrigger = signal(0);
  event = signal<any>(null);
  selectedDate = signal('');
  eventId = signal<string>('');
  isLoading = signal<boolean>(true);
  isLoadingChildEvent = signal<boolean>(false);
  isSendingRsvpRequest = signal<boolean>(false);
  selectedChildEventId = signal<string | null>(null);
  childEventData = signal<Map<string, any>>(new Map());
  isNativePlatform = computed(() => Capacitor.isNativePlatform());

  // Attendees data for Going and Maybe sections
  attendeesYes = signal<any[]>([]);
  attendeesMaybe = signal<any[]>([]);
  attendeesSummary = signal<{ total_yes_guest: number; total_maybe_guest: number } | null>(null);

  eventIdFromData = computed(() => {
    // If a child event is selected, return its ID, otherwise return parent event ID
    const selectedChildId = this.selectedChildEventId();
    if (selectedChildId) {
      return selectedChildId;
    }
    const eventData = this.event();
    return eventData?.id || null;
  });

  // Add new signals for caching attendees by event ID
  attendeesCache = signal<
    Map<
      string,
      {
        yes: any[];
        maybe: any[];
        summary: { total_yes_guest: number; total_maybe_guest: number } | null;
      }
    >
  >(new Map());

  currentUser = computed(() => this.authService.currentUser());
  subscriptionPlanType = computed<'event' | 'sponsor' | null>(() => {
    const eventData = this.currentEventData();
    if (!eventData) return null;
    if (eventData.is_subscription && eventData.subscription_plan === 'event') return 'event';
    if (eventData.is_subscription && eventData.subscription_plan === 'sponsor') return 'sponsor';
    return null;
  });

  currentEventData = computed(() => {
    const parentEvent = this.event();
    if (!parentEvent) return null;

    const selectedChildId = this.selectedChildEventId();
    if (!selectedChildId || !parentEvent.child_events || parentEvent.child_events.length === 0) {
      return parentEvent;
    }

    const childEventsMap = this.childEventData();
    const fetchedChildData = childEventsMap.get(selectedChildId);

    if (fetchedChildData) {
      return {
        ...parentEvent,
        ...fetchedChildData,
        child_events: parentEvent.child_events
      };
    }

    const selectedChild = parentEvent.child_events.find((child: any) => child.id === selectedChildId);
    if (!selectedChild) return parentEvent;

    return {
      ...parentEvent,
      start_date: selectedChild.start_date || parentEvent.start_date,
      end_date: selectedChild.end_date || parentEvent.end_date,
      latitude: selectedChild.latitude || parentEvent.latitude,
      longitude: selectedChild.longitude || parentEvent.longitude,
      address: selectedChild.address || parentEvent.address,
      city: selectedChild.city || parentEvent.city,
      state: selectedChild.state || parentEvent.state,
      country: selectedChild.country || parentEvent.country,
      child_events: parentEvent.child_events
    };
  });

  eventMenuItems = computed<PrimeMenuItem[]>(() => {
    const items: PrimeMenuItem[] = [
      {
        label: 'Report',
        icon: 'pi pi-flag',
        command: () => this.reportEvent()
      }
    ];

    if (this.eventDisplayData()?.isCurrentUserHost || this.eventDisplayData()?.isCurrentUserCoHost) {
      items.push({
        label: 'Dashboard View',
        icon: 'pi pi-th-large',
        command: () => this.goToDashboard()
      });
    }

    return items;
  });

  showEventAnalytics = computed(() => {
    const event = this.eventDisplayData();
    if (!event) return false;
    const hasPublicQuestions = event.questionnaire?.some(
      (q: any) => q.is_public === true && ['SingleChoice', 'MultipleChoice', 'Rating'].includes(q.question_type)
    );

    const showToUser = event.isCurrentUserHost || event.isCurrentUserAttendee || event.isCurrentUserCoHost;

    return hasPublicQuestions && showToUser;
  });

  isShowTimer = computed(() => {
    const eventData = this.currentEventData();
    return eventData?.settings?.is_show_timer === true;
  });

  isEventCompleted = computed(() => {
    const eventData = this.currentEventData();
    const now = Date.now();
    const eventStart = new Date(eventData.end_date).getTime();

    // event is completed if end date is in the past
    return eventStart < now;
  });

  countdownTimer = computed(() => {
    this.timerTrigger();
    const eventData = this.currentEventData();
    if (!eventData?.start_date) return null;

    const now = new Date().getTime();
    const eventStart = new Date(eventData.start_date).getTime();
    const difference = eventStart - now;

    if (difference <= 0) return null;

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const isLessThan24Hours = difference < 24 * 60 * 60 * 1000;

    if (isLessThan24Hours) {
      return {
        formatted: `${hours.toString().padStart(2, '0')} : ${minutes.toString().padStart(2, '0')} : ${seconds.toString().padStart(2, '0')}`,
        isLessThan24Hours: true
      };
    } else {
      return {
        formatted: `${days} d ${hours} h ${minutes.toString().padStart(2, '0')} m`,
        isLessThan24Hours: false
      };
    }
  });

  formatTimerDisplay(formatted: string, isLessThan24Hours: boolean): string {
    if (isLessThan24Hours) {
      const parts = formatted.split(' : ');
      return parts
        .map((part, index) => {
          if (index < parts.length - 1) {
            return `<span>${part}</span><span class="timer-colon"> : </span>`;
          }
          return `<span>${part}</span>`;
        })
        .join('');
    } else {
      return formatted.replace(/(\d+)\s*([dhm])/g, '<span>$1</span><span class="timer-unit">$2</span>');
    }
  }

  isEventLiked = computed(() => {
    const eventData = this.currentEventData();
    return eventData?.is_like || false;
  });

  eventDisplayData = computed(() => {
    const eventData = this.currentEventData();
    if (!eventData) {
      return {
        id: '',
        thumbnail_url: '',
        image_url: '',
        title: '',
        description: '',
        images: [],
        displayMedias: [],
        total_views: '0',
        isPublic: true,
        location: '',
        hostName: 'Networked AI',
        mapCenter: null,
        admission: 'Free',
        formattedDateTime: '',
        userSections: [],
        isRepeatingEvent: false,
        dateItems: [],
        rsvpButtonLabel: 'RSVP Now for Free',
        isCurrentUserHost: false,
        isCurrentUserCoHost: false,
        isCurrentUserAttendee: false,
        isRsvpApprovalRequired: false,
        hasCurrentUserRsvpRequest: false,
        isCurrentUserRequestApproved: false,
        isCurrentUserRequestPending: false,
        isCurrentUserRequestRejected: false,
        tickets: [],
        questionnaire: [],
        promo_codes: [],
        subscriptionPlanType: null,
        has_plans: false,
        is_subscriber_exclusive: false,
        has_subscribed: false,
        plans: []
      };
    }
    const parentEvent = this.event();
    const currentUser = this.currentUser();

    const transformedData = this.eventService.transformEventDataForDisplay(eventData, parentEvent, currentUser);

    const dateItems = this.eventService.createDateItems(parentEvent || eventData);

    // Check if current user is an attendee
    const attendees = eventData?.attendees || [];
    const isCurrentUserAttendee = currentUser?.id ? attendees.some((attendee: any) => attendee.user?.id === currentUser.id) : false;
    // const isCurrentUserAttendee = currentUser?.id ? attendees.some((attendee: any) => attendee.id === currentUser.id) : false;

    // Check if current user has sent an RSVP request and its status
    const rsvpRequests = eventData?.rsvp_requests || [];
    const currentUserRequest = currentUser?.id ? rsvpRequests.find((request: any) => request.user_id === currentUser.id) : null;

    const hasCurrentUserRsvpRequest = !!currentUserRequest;
    const isCurrentUserRequestApproved = currentUserRequest?.status === 'Approved' || currentUserRequest?.status === 'approved';
    const isCurrentUserRequestPending = currentUserRequest?.status === 'Pending' || currentUserRequest?.status === 'pending';
    const isCurrentUserRequestRejected = currentUserRequest?.status === 'Rejected' || currentUserRequest?.status === 'rejected';

    // Map attendees to IUser format and add Going/Maybe sections
    const mapAttendeeToUser = (attendee: any): IUser | null => {
      return {
        id: attendee.id,
        username: attendee?.parent_user_id ? '' : attendee?.user?.username,
        thumbnail_url: attendee?.parent_user_id ? '' : attendee?.user?.thumbnail_url
      };
    };

    const summary = this.attendeesSummary();
    const attendeesYesUsers = this.attendeesYes()
      .map(mapAttendeeToUser)
      .filter((u): u is IUser => u !== null);
    const attendeesMaybeUsers = this.attendeesMaybe()
      .map(mapAttendeeToUser)
      .filter((u): u is IUser => u !== null);

    // Add Going and Maybe sections to userSections
    const userSections = [...(transformedData.userSections || [])];

    if (attendeesYesUsers.length > 0 || (summary && summary.total_yes_guest > 0)) {
      userSections.push({
        title: 'Going',
        users: attendeesYesUsers,
        totalCount: summary?.total_yes_guest
      });
    }

    if (attendeesMaybeUsers.length > 0 || (summary && summary.total_maybe_guest > 0)) {
      userSections.push({
        title: 'Maybe',
        users: attendeesMaybeUsers,
        totalCount: summary?.total_maybe_guest
      });
    }

    return {
      ...transformedData,
      userSections,
      dateItems,
      subscriptionPlanType: this.subscriptionPlanType(),
      isCurrentUserAttendee,
      hasCurrentUserRsvpRequest,
      isCurrentUserRequestApproved,
      isCurrentUserRequestPending,
      isCurrentUserRequestRejected,
      has_plans: eventData?.has_plans || false,
      is_subscriber_exclusive: eventData?.settings?.is_subscriber_exclusive ?? false,
      has_subscribed: eventData?.has_subscribed || false,
      participants: eventData?.participants || [],
      plans: eventData?.plans
    };
  });

  ngOnInit(): void {
    this.routeParamsSubscription = this.route.paramMap.subscribe((params) => {
      const eventSlug = params.get('slug');
      if (eventSlug) {
        this.eventId.set(eventSlug);
        if (eventSlug != this.event()?.slug) {
          this.loadEvent();
        }
      }
    });

    this.timerInterval = setInterval(() => {
      if (this.isShowTimer() && this.countdownTimer()) {
        this.timerTrigger.update((v) => v + 1);
      }
    }, 1000);
  }

  async trackEventView(eventId: string): Promise<void> {
    try {
      const deviceInfo = await Device.getId();
      if (deviceInfo?.identifier) {
        await this.eventService.addView(eventId, deviceInfo.identifier);
      }
    } catch (deviceError) {
      console.error('Error tracking event view:', deviceError);
    }
  }

  async loadEvent(): Promise<void> {
    const eventId = this.eventId();
    if (!eventId) return;

    try {
      this.isLoading.set(true);

      // Check if attendees are cached for parent event
      const cache = this.attendeesCache();
      const cachedAttendees = cache.get(eventId);

      let attendeesYes, attendeesMaybe;

      if (cachedAttendees) {
        // Use cached data
        attendeesYes = { data: cachedAttendees.yes, summary: cachedAttendees.summary };
        attendeesMaybe = { data: cachedAttendees.maybe, summary: cachedAttendees.summary };
      } else {
        // Fetch from API
        [attendeesYes, attendeesMaybe] = await Promise.all([this.getAttendeesList(eventId, 'Yes'), this.getAttendeesList(eventId, 'Maybe')]);
      }

      const eventData = await this.eventService.getEventById(eventId);

      if (eventData) {
        this.event.set(eventData);
        this.ogService.setOgTagInEvent(eventData);
        this.resetChildEventState();
        this.setInitialDate(eventData);
        await this.trackEventView(eventData.id);
      }

      this.updateAttendeesData(attendeesYes, attendeesMaybe, eventData?.id);
    } catch (error) {
      console.error('Error loading event:', error);
      this.toasterService.showError('Failed to load event');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      // Clear attendees cache to force fresh data
      this.attendeesCache.set(new Map());
      await this.loadEvent();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete();
    }
  }

  async onDateChange(date: string): Promise<void> {
    this.selectedDate.set(date);
    this.handleDateChange(date);
  }

  async handleDateChange(date: string): Promise<void> {
    const eventData = this.event();
    if (!eventData) return;
    const matchingChild = this.findMatchingChildEvent(eventData, date);
    if (matchingChild && matchingChild?.id != this.event()?.id) {
      this.selectedChildEventId.set(matchingChild.id);
      await this.loadChildEvent(matchingChild.id);
    } else if (this.isParentEventDate(eventData, date)) {
      this.selectedChildEventId.set(null);
      this.loadCachedAttendees(this.event()?.id);
    }
  }

  resetChildEventState(): void {
    this.selectedChildEventId.set(null);
    this.childEventData.set(new Map());
  }

  setInitialDate(eventData: any): void {
    if (eventData.start_date) {
      this.selectedDate.set(this.eventService.formatDateKey(eventData.start_date));
      return;
    }

    // Fallback to first date item if available
    const dateItems = this.eventService.createDateItems(eventData);
    if (dateItems.length > 0) {
      this.selectedDate.set(dateItems[0].value);
    }
  }

  findMatchingChildEvent(eventData: any, date: string): any {
    if (!eventData.child_events?.length) return null;

    return eventData.child_events.find((child: any) => {
      if (!child.start_date) return false;
      const childDateKey = this.eventService.formatDateKey(child.start_date);
      return childDateKey === date;
    });
  }

  isParentEventDate(eventData: any, date: string): boolean {
    const parentDateKey = this.eventService.formatDateKey(eventData.start_date);
    return parentDateKey === date;
  }

  cacheChildEventData(childEventId: string, childEventData: any): void {
    const updatedMap = new Map(this.childEventData());
    updatedMap.set(childEventId, childEventData);
    this.childEventData.set(updatedMap);
  }

  async loadChildEvent(childEventId: string): Promise<void> {
    const childEventsMap = this.childEventData();
    const cache = this.attendeesCache();
    const cachedAttendees = cache.get(childEventId);

    // If both event data and attendees are cached, just load from cache
    if (childEventsMap.has(childEventId) && cachedAttendees) {
      this.loadCachedAttendees(childEventId);
      return;
    }

    // If only event data is cached, just load attendees
    if (childEventsMap.has(childEventId) && !cachedAttendees) {
      await this.loadAndCacheAttendees(childEventId);
      return;
    }

    const loading = await this.loadingCtrl.create({
      mode: 'md'
    });
    await loading.present();

    try {
      const [childEventData, attendeesYes, attendeesMaybe] = await Promise.all([
        this.eventService.getEventById(childEventId),
        this.getAttendeesList(childEventId, 'Yes'),
        this.getAttendeesList(childEventId, 'Maybe')
      ]);

      if (childEventData) {
        this.cacheChildEventData(childEventId, childEventData);
        await this.trackEventView(childEventData.id);
      }

      this.updateAttendeesData(attendeesYes, attendeesMaybe, childEventId);
    } catch (error) {
      console.error('Error loading child event:', error);
      this.toasterService.showError('Failed to load event details');
    } finally {
      await loading.dismiss();
    }
  }

  async getAttendeesList(eventId: string, rsvpStatus: 'Yes' | 'Maybe') {
    return this.eventService.getEventAttendeesList(eventId, {
      rsvp_status: rsvpStatus,
      page: 1,
      limit: 4
    });
  }
  // New helper method to load cached attendees
  loadCachedAttendees(eventId: string): void {
    const cache = this.attendeesCache();
    const cachedData = cache.get(eventId);

    if (cachedData) {
      this.attendeesYes.set(cachedData.yes);
      this.attendeesMaybe.set(cachedData.maybe);
      this.attendeesSummary.set(cachedData.summary);
    }
  }
  async loadAndCacheAttendees(eventId: string): Promise<void> {
    try {
      const [attendeesYes, attendeesMaybe] = await Promise.all([this.getAttendeesList(eventId, 'Yes'), this.getAttendeesList(eventId, 'Maybe')]);

      this.updateAttendeesData(attendeesYes, attendeesMaybe, eventId);
    } catch (error) {
      console.error('Error loading attendees:', error);
    }
  }

  updateAttendeesData(attendeesYes: any, attendeesMaybe: any, eventId: string): void {
    const yesData = attendeesYes.data || [];
    const maybeData = attendeesMaybe.data || [];
    const summary = attendeesYes.summary || attendeesMaybe.summary;

    // Update current signals
    this.attendeesYes.set(yesData);
    this.attendeesMaybe.set(maybeData);

    const summaryData = summary
      ? {
          total_yes_guest: summary.total_yes_guest || 0,
          total_maybe_guest: summary.total_maybe_guest || 0
        }
      : null;

    this.attendeesSummary.set(summaryData);

    // Cache the data
    const cache = new Map(this.attendeesCache());
    cache.set(eventId, {
      yes: yesData,
      maybe: maybeData,
      summary: summaryData
    });

    this.attendeesCache.set(cache);
  }

  // Update loadParentEventAttendees to show loading
  async loadParentEventAttendees(): Promise<void> {
    const eventData = this.event();
    if (!eventData?.id) return;

    try {
      this.isLoading.set(true); // Show spinner

      const [attendeesYesResult, attendeesMaybeResult] = await Promise.all([
        this.eventService.getEventAttendeesList(eventData.id, {
          rsvp_status: 'Yes',
          page: 1,
          limit: 4
        }),

        this.eventService.getEventAttendeesList(eventData.id, {
          rsvp_status: 'Maybe',
          page: 1,
          limit: 4
        })
      ]);

      this.attendeesYes.set(attendeesYesResult.data || []);
      this.attendeesMaybe.set(attendeesMaybeResult.data || []);

      if (attendeesYesResult.summary || attendeesMaybeResult.summary) {
        const summary = attendeesYesResult.summary || attendeesMaybeResult.summary;
        this.attendeesSummary.set({
          total_yes_guest: summary?.total_yes_guest || 0,
          total_maybe_guest: summary?.total_maybe_guest || 0
        });
      }
    } catch (error) {
      console.error('Error loading parent event attendees:', error);
    } finally {
      this.isLoading.set(false); // Hide spinner
    }
  }

  openUserList(title: string, eventTitle: string): void {
    const eventId = this.eventIdFromData();
    if (!eventId) return;

    const sectionParam = encodeURIComponent(title);
    const route = `/event/guests/${eventId}/${sectionParam.toLowerCase()}`;

    this.navigationService.navigateForward(route, false, {
      eventTitle
    });
  }

  async openRsvpModal(): Promise<void> {
    const displayData = this.eventDisplayData();
    const eventData = this.currentEventData();
    const hostPaysFees = eventData?.settings?.host_pays_platform_fee ?? false;
    const additionalFees = eventData?.settings?.additional_fees ?? null;
    const maxAttendeesPerUser = eventData?.settings?.max_attendees_per_user ?? 0;
    const date = displayData.formattedDateTime;
    const location = eventData?.address || '';
    const hostName = eventData?.participants?.find((p: any) => p.role === 'Host')?.user?.name || 'Networked AI';
    const hasPlans = eventData?.has_plans || false;
    const hasSubscribed = eventData?.has_subscribed || false;
    const isSubscriberExclusive = eventData?.settings?.is_subscriber_exclusive ?? false;
    const plans = eventData?.plans || [];

    const result = await this.modalService.openRsvpModal(
      displayData.tickets || [],
      displayData.title || '',
      displayData.questionnaire || [],
      displayData.promo_codes || [],
      hostPaysFees,
      additionalFees,
      maxAttendeesPerUser,
      hostName,
      this.eventIdFromData() || '',
      hasPlans,
      hasSubscribed,
      isSubscriberExclusive,
      plans,
      date,
      location,
      eventData?.participants
    );
    if (result) {
      const loadingModal = await this.modalService.openLoadingModal('Processing your RSVP...');

      try {
        const feedbackSaved = await this.saveEventFeedback(result);
        if (feedbackSaved) {
          try {
            await this.saveRsvpAttendees(result, result?.stripe_payment_intent_id || '');
            await loadingModal.dismiss();
            const roomParams = {
              is_personal: false,
              event_id: this.eventIdFromData() || ''
            };
            this.messagesService.createOrGetChatRoom(roomParams).then((result: any) => {
              if (result.room_id) {
                this.messagesService.joinRoom(result.room_id, [this.authService.currentUser()?.id || '']);
              }
            });
            await this.modalService.openRsvpConfirmModal(displayData, {
              showFinishProfileSetup: result.isNewUser === true
            });
          } catch (attendeeError) {
            await loadingModal.dismiss();
            console.error('Error saving RSVP attendees:', attendeeError);
            const message = BaseApiService.getErrorMessage(attendeeError, 'Failed to save RSVP. Please try again.');
            this.toasterService.showError(message);
            return;
          } finally {
            await this.loadEvent();
          }
        } else {
          await loadingModal.dismiss();
        }
      } catch (error) {
        await loadingModal.dismiss();
        console.error('Error processing RSVP:', error);
        this.toasterService.showError('Failed to process RSVP. Please try again.');
      }
    }
  }

  async sendRsvpRequest(): Promise<void> {
    const isLoggedIn = await this.eventService.checkIsLoggin();
    if (!isLoggedIn) return;

    const eventId = this.eventIdFromData();
    if (!eventId) {
      console.error('Event ID not found');
      return;
    }

    this.isSendingRsvpRequest.set(true);

    try {
      await this.eventService.sendRsvpRequest(eventId);
      this.toasterService.showSuccess('RSVP request sent successfully');
      await this.loadEvent();
    } catch (error) {
      console.error('Error sending RSVP request:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to send RSVP request. Please try again.');
      this.toasterService.showError(message);
    } finally {
      this.isSendingRsvpRequest.set(false);
    }
  }

  async saveEventFeedback(rsvpResult: any): Promise<boolean> {
    try {
      const eventId = this.eventIdFromData();
      if (!eventId) {
        console.error('Event ID not found');
        return false;
      }

      const questionnaireResult = rsvpResult?.questionnaireResult;
      if (!questionnaireResult || !questionnaireResult.responses || questionnaireResult.responses.length === 0) {
        return true;
      }

      const feedback: any[] = [];

      questionnaireResult.responses.forEach((response: any) => {
        if (!response.question_id) {
          return;
        }

        const questionType = response.type || '';
        let answer: string | number | string[] = '';

        if (questionType === 'SingleChoice') {
          let answerValue: string = '';
          let optionId: string | undefined = undefined;

          if (typeof response.answer === 'object' && response.answer !== null) {
            answerValue = response.answer.option || '';
            optionId = response.answer.id || undefined;
          } else {
            answerValue = response.answer || '';
            const selectedOption = response.options?.find((opt: any) => {
              const optionText = typeof opt === 'object' ? opt.option : opt;
              return optionText === answerValue;
            });
            optionId = selectedOption?.id || undefined;
          }

          feedback.push({
            question_id: response.question_id,
            answer_option_id: optionId,
            answer: answerValue
          });
        } else if (questionType === 'MultipleChoice') {
          const selectedOptions = Array.isArray(response.answer) ? response.answer : [response.answer];
          selectedOptions.forEach((selectedAnswer: any) => {
            let answerValue: string = '';
            let optionId: string | undefined = undefined;

            if (typeof selectedAnswer === 'object' && selectedAnswer !== null) {
              answerValue = selectedAnswer.option || '';
              optionId = selectedAnswer.id || undefined;
            } else {
              answerValue = selectedAnswer || '';
              const selectedOption = response.options?.find((opt: any) => {
                const optionText = typeof opt === 'object' ? opt.option : opt;
                return optionText === answerValue;
              });
              optionId = selectedOption?.id || undefined;
            }

            feedback.push({
              question_id: response.question_id,
              answer_option_id: optionId,
              answer: answerValue
            });
          });
        } else {
          answer = response.answer || '';
          feedback.push({
            question_id: response.question_id,
            answer_option_id: undefined,
            answer: String(answer)
          });
        }
      });

      if (feedback.length > 0) {
        const payload = {
          feedback: feedback
        };

        await this.eventService.saveEventFeedback(eventId, payload);
        return true;
      }
      return true;
    } catch (error) {
      console.error('Error saving event feedback:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to save questionnaire responses. Please try again.');
      this.toasterService.showError(message);
      return false;
    }
  }

  async saveRsvpAttendees(rsvpResult: any, stripe_payment_intent_id: string): Promise<void> {
    const eventId = rsvpResult?.event_id || this.eventIdFromData();
    if (!eventId) {
      throw new Error('Event ID not found');
    }

    const attendees = rsvpResult?.attendees || [];

    if (attendees.length === 0) {
      console.warn('No attendees to save');
      return;
    }

    const payload: any = {
      event_id: eventId,
      attendees: attendees
    };

    if (stripe_payment_intent_id) {
      payload.stripe_payment_intent_id = stripe_payment_intent_id;
    }

    await this.eventService.saveEventAttendees(payload);
  }

  goBack(): void {
    this.navigationService.back();
  }

  async openMenu() {
    this.manageService.openMenu(this.currentEventData());
  }

  openEventChat(): void {
    const eventId = this.eventIdFromData();
    const currentUserId = this.authService.currentUser()?.id;
    const eventData = this.currentEventData();

    if (eventId && currentUserId) {
      this.navigationService.navigateForward('/chat-room', false, {
        event_id: eventId,
        is_personal: false,
        name: eventData?.title || null,
        event_image: eventData?.image_url?.[0] || null,
        user_ids: []
      });
    }
  }

  async openTicketsModal(): Promise<void> {
    const currentEventData = this.currentEventData();
    if (currentEventData) {
      const result = await this.modalService.openMyTicketsModal(currentEventData);
    }
  }

  async shareEvent() {
    const eventId = this.eventIdFromData();
    if (!eventId) return;

    const isLoggedIn = await this.eventService.checkIsLoggin();
    if (!isLoggedIn) return;

    const result = await this.modalService.openShareModal(eventId, 'Event', this.currentEventData()?.image_url);
    if (result) {
      this.toasterService.showSuccess('Event shared');
    }
  }

  async likeEvent(): Promise<void> {
    const eventId = this.eventIdFromData();
    const currentEventData = this.currentEventData();
    if (!eventId || !currentEventData) return;
    const isLoggedIn = await this.eventService.checkIsLoggin();
    if (!isLoggedIn) return;

    const currentIsLiked = currentEventData.is_like || false;
    const newIsLiked = !currentIsLiked;

    // Check if we're dealing with a child event
    const selectedChildId = this.selectedChildEventId();
    if (selectedChildId) {
      // Update child event data
      const childEventsMap = this.childEventData();
      const childEvent = childEventsMap.get(selectedChildId);

      if (childEvent) {
        const updatedChildEvent = {
          ...childEvent,
          is_like: newIsLiked,
          total_likes: newIsLiked ? (childEvent.total_likes || 0) + 1 : Math.max((childEvent.total_likes || 0) - 1, 0)
        };

        const updatedMap = new Map(childEventsMap);
        updatedMap.set(selectedChildId, updatedChildEvent);
        this.childEventData.set(updatedMap);
      }
    } else {
      // Update parent event
      this.event.update((e) => ({
        ...e,
        is_like: newIsLiked,
        total_likes: newIsLiked ? (e.total_likes || 0) + 1 : Math.max((e.total_likes || 0) - 1, 0)
      }));
    }

    try {
      await this.eventService.likeEvent(eventId);
    } catch (error) {
      console.error('Error toggling event like:', error);
      this.toasterService.showError('Failed to like event. Please try again.');
    }
  }

  async goToDashboard() {
    const displayData = this.eventDisplayData();
    const token = this.authService.getCurrentToken();
    const eventId = displayData?.id;
    const url = `${environment.dashboardUrl}?token=${token}&goto=event&eventId=${eventId}`;
    await Browser.open({ url });
  }

  async reportEvent() {
    const isLoggedIn = await this.eventService.checkIsLoggin();
    if (!isLoggedIn) return;

    const result = await this.modalService.openReportModal('Event');
    if (!result || !result.reason_id) return;

    const eventId = this.eventIdFromData();
    if (!eventId) return;

    try {
      const reasonText = result.reason || 'Inappropriate content';

      await this.eventService.reportEvent(eventId, {
        report_reason_id: result.reason_id,
        reason: reasonText
      });

      const resultModal = await this.modalService.openConfirmModal({
        iconName: 'pi pi-check',
        iconBgColor: 'linear-gradient(138.06deg, #F5BC61 8.51%, #C89034 48.28%, #9E660A 85.69%)',
        title: 'Report Submitted',
        description: 'We use these reports to show you less of this kind of content in the future.',
        confirmButtonLabel: 'Done'
      });

      if (resultModal && resultModal.role === 'confirm') {
        this.toasterService.showSuccess('Event reported');
      }
    } catch (error) {
      console.error('Error reporting event:', error);
      this.toasterService.showError('Failed to report event. Please try again.');
    }
  }

  async navigateToSubscriptionPlans(): Promise<void> {
    const isLoggedIn = await this.eventService.checkIsLoggin();
    if (!isLoggedIn) return;

    const eventData = this.currentEventData();
    const planIds = eventData?.plan_ids;

    if (planIds && planIds.length > 0) {
      const planId = planIds[0];
      this.navigationService.navigateForward(`/subscription/${planId}`);
    }
  }

  ngOnDestroy(): void {
    this.routeParamsSubscription?.unsubscribe();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: any): void {
    onImageError(event);
  }

  navigateToNetwork() {
    this.navigationService.navigateForward(`/event/questionnaire-response/${this.eventDisplayData().id}`);
  }
}
