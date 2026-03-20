import {
  IEvent,
  MediaItem,
  UserSection,
  EventCategory,
  EventAttendee,
  EventAttendeesPayload,
  EventResponse,
  EventsResponse,
  EventDisplayData,
  EventFeedbackPayload,
  EventCategoriesResponse
} from '@/interfaces/event';
import { DatePipe } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Injectable, signal, inject, computed } from '@angular/core';
import { ICity } from '@/components/card/city-card';
import { BaseApiService } from '@/services/base-api.service';
import { SegmentButtonItem } from '@/components/common/segment-button';
import { ModalService } from './modal.service';
import { NavigationService } from './navigation.service';
import {
  IEventAttendee,
  IAddGuestPayload,
  IEventAttendeesCounts,
  IGetEventAttendeesListParams,
  IGetEventAttendeesListResult,
  IGetEventAttendeesParams,
  IGetEventAttendeesResult,
  IGetEventParticipantsListResult,
  IGetEventParticipantsListParams,
  IPagination,
  IRefundAttendeeResponse,
  IAddGuestResponse,
  IMarkAsPaidResponse
} from '@/interfaces/IEventAttendee';
import { ICsvBroadcastResponse } from '@/interfaces/IFeed';
import { IEventViewer, IEventViewersResponse, IUser } from '@/interfaces/IUser';

@Injectable({ providedIn: 'root' })
export class EventService extends BaseApiService {
  private authService = inject(AuthService);
  private modalService = inject(ModalService);
  private navigationService = inject(NavigationService);

  datePipe = new DatePipe('en-US');
  myEvents = signal<IEvent[]>([]);
  recommendedEvents = signal<IEvent[]>([]);
  publicEvents = signal<IEvent[]>([]);
  allEvents = signal<IEvent[]>([]);
  upcomingEvents = signal<IEvent[]>([]);
  cityCards = signal<ICity[]>([]);
  isLoadingCities = signal<boolean>(false);
  isLoggedIn = computed(() => !!this.authService.currentUser());

  async createEvents(eventsPayload: any[]): Promise<EventResponse> {
    try {
      const response = await this.post<EventResponse>('/events', eventsPayload);
      return response;
    } catch (error) {
      console.error('Error creating events:', error);
      throw error;
    }
  }

  // get event categories
  async getEventCategories(): Promise<EventCategory[]> {
    try {
      const response = await this.get<EventCategoriesResponse>('/event-categories');
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching event categories:', error);
      throw error;
    }
  }

  async getEventAttendees(eventId: string, params: IGetEventAttendeesParams = {}): Promise<IGetEventAttendeesResult> {
    try {
      let httpParams = new HttpParams()
        .set('event_id', eventId)
        .set('page', String(params.page ?? 1))
        .set('limit', String(params.limit ?? 50));
      if (params.search?.trim()) httpParams = httpParams.set('search', params.search.trim());
      if (params.rsvp_status) httpParams = httpParams.set('rsvp_status', params.rsvp_status);
      if (params.is_checked_in !== undefined) httpParams = httpParams.set('is_checked_in', params.is_checked_in ? 'true' : 'false');
      if (params.ticket_type) httpParams = httpParams.set('ticket_type', params.ticket_type);
      if (params.is_connected !== undefined) httpParams = httpParams.set('is_connected', params.is_connected ? 'true' : 'false');

      const response = await this.get<any>('/event-attendees', { params: httpParams });
      const payload = response?.data ?? response;
      return {
        data: (payload?.data ?? []) as IEventAttendee[],
        pagination: (payload?.pagination ?? { totalCount: 0, currentPage: 1, totalPages: 0 }) as IPagination,
        counts: payload?.counts as IEventAttendeesCounts | undefined
      };
    } catch (error) {
      console.error('Error fetching event attendees:', error);
      throw error;
    }
  }

  async getEventAttendeesList(eventIdOrSlug: string, params: IGetEventAttendeesListParams = {}): Promise<IGetEventAttendeesListResult> {
    try {
      let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('limit', String(params.limit ?? 20));

      if (params.rsvp_status) {
        httpParams = httpParams.set('rsvp_status', params.rsvp_status);
      }

      if (params.search?.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }

      if (params.order_by) {
        httpParams = httpParams.set('order_by', params.order_by);
      }

      if (params.order_direction) {
        httpParams = httpParams.set('order_direction', params.order_direction);
      }

      const response = await this.get<any>(`/events/attendees/${eventIdOrSlug}`, { params: httpParams });

      const payload = response?.data ?? response;

      return {
        data: payload?.data ?? [],
        pagination: payload?.pagination ?? {
          totalCount: 0,
          currentPage: 1,
          totalPages: 0
        },
        summary: payload?.summary
      };
    } catch (error) {
      console.error('Error fetching event attendees list:', error);
      throw error;
    }
  }

  async getEventParticipantsList(eventIdOrSlug: string, params: IGetEventParticipantsListParams = {}): Promise<IGetEventParticipantsListResult> {
    try {
      let httpParams = new HttpParams().set('page', String(params.page ?? 1)).set('limit', String(params.limit ?? 20));

      if (params.search?.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }

      if (params.role) {
        // API supports multiple roles comma separated
        httpParams = httpParams.set('role', params.role);
      }

      if (params.order_by) {
        httpParams = httpParams.set('order_by', params.order_by);
      }

      if (params.order_direction) {
        httpParams = httpParams.set('order_direction', params.order_direction);
      }

      const response = await this.get<any>(`/events/participants/${eventIdOrSlug}`, { params: httpParams });

      const payload = response?.data ?? response;

      return {
        data: payload?.data ?? [],
        pagination: payload?.pagination ?? {
          totalCount: 0,
          currentPage: 1,
          totalPages: 0
        }
      };
    } catch (error) {
      console.error('Error fetching event participants list:', error);
      throw error;
    }
  }

  // get event by id
  async getEventById(eventId: string): Promise<any> {
    try {
      const response = await this.get<any>(`/events/${eventId}?include_details=true`);
      return response?.data?.content || null;
    } catch (error) {
      console.error('Error fetching event:', error);
      throw error;
    }
  }

  // track event view
  async addView(eventId: string, deviceId: string): Promise<void> {
    try {
      await this.post(`/events/${eventId}/view`, { device_id: deviceId });
    } catch (error) {
      console.error('Error tracking event view:', error);
    }
  }

  // update event
  async updateEvent(eventId: string, eventPayload: any): Promise<EventResponse> {
    try {
      const response = await this.put<EventResponse>(`/events/${eventId}`, eventPayload);
      return response;
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  formatDateTime(startDateString: any, endDateString?: any): string {
    if (!startDateString) return '';
    const startDate = new Date(startDateString);
    const dayOfWeek = this.datePipe.transform(startDate, 'EEE') || '';
    const month = startDate.getMonth() + 1;
    const day = startDate.getDate();

    const startTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    let timeStr = startTime;

    if (endDateString) {
      const endDate = new Date(endDateString);
      const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      timeStr += ` - ${endTime}`;
    }

    return `${dayOfWeek} ${month}/${day}, ${timeStr}`;
  }

  formatDateKey(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  }

  formatLocation(address?: string, city?: string, state?: string, country?: string): string {
    const parts = [address, city, state, country].filter(Boolean);
    return parts.join(', ') || 'Location not specified';
  }

  formatAdmission(tickets: any[]): string {
    if (!tickets || tickets.length === 0) return 'Free';

    const availableTickets = tickets
      .filter((t: any) => t.quantity != null && t.quantity > 0)
      .map((t: any) => ({
        ...t,
        price: typeof t.price === 'string' ? parseFloat(t.price) : t.price || 0
      }));

    if (availableTickets.length === 0) return 'Free';

    // If there's only one ticket, show the direct price
    if (availableTickets.length === 1) {
      const price = availableTickets[0].price || 0;
      if (price > 0) {
        return `$${price.toFixed(2)}`;
      }
      return 'Free';
    }

    // If there are multiple tickets, show "from $X.00"
    const minPrice = Math.min(...availableTickets.map((t: any) => t.price || 0));
    if (minPrice > 0) {
      return `from $${minPrice.toFixed(2)}`;
    }
    return 'Free';
  }

  processMediaItems(medias: any[]): { displayMedias: MediaItem[]; allMedias: MediaItem[] } {
    const defaultImage: MediaItem = {
      url: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=800&q=80',
      type: 'Image',
      order: 1
    };

    if (!Array.isArray(medias) || medias.length === 0) {
      return { displayMedias: [], allMedias: [defaultImage] };
    }

    const processedMedias: MediaItem[] = medias
      .filter((media: any) => {
        if (!media) return false;
        return media.url || media.media_url || (media.file && media.file instanceof File);
      })
      .map((media: any, index: number) => {
        let url = media.url || media.media_url || '';
        if (!url && media.file && media.file instanceof File) {
          try {
            url = URL.createObjectURL(media.file);
          } catch (e) {
            console.warn('Failed to create object URL for media file', e);
          }
        }

        let type = media.type || media.media_type || '';
        if (!type && media.file) {
          const fileType = media.file.type || '';
          if (fileType.startsWith('video/')) {
            type = 'Video';
          } else if (fileType.startsWith('image/') || fileType === 'gif') {
            type = 'Image';
          }
        }

        const normalizedType = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Image';
        const validType: 'Image' | 'Video' | 'image' | 'video' | 'gif' = (
          normalizedType === 'Image' || normalizedType === 'Video' || normalizedType === 'Gif'
            ? normalizedType
            : normalizedType.toLowerCase() === 'video'
              ? 'Video'
              : 'Image'
        ) as 'Image' | 'Video' | 'image' | 'video' | 'gif';

        return {
          id: media.id || `media-${index}`,
          url: url,
          type: validType,
          order: media.order ?? index + 1
        };
      })
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    const allMedias = processedMedias.length > 0 ? processedMedias : [defaultImage];
    const displayMedias = allMedias;

    return { displayMedias, allMedias };
  }

  formatMedias(medias: any[]): MediaItem[] {
    const { allMedias } = this.processMediaItems(medias);
    return allMedias;
  }

  getCurrentTime(): string {
    const now = new Date();
    return this.datePipe.transform(now, 'HH:mm') ?? '';
  }

  addMinutesToTime(time: string, minutes: number): string {
    const [hours, mins] = time.split(':').map(Number);

    const date = new Date();
    date.setHours(hours, mins, 0, 0);
    date.setMinutes(date.getMinutes() + minutes);

    return this.datePipe.transform(date, 'HH:mm') ?? '';
  }

  isTimeAfter(time1: string, time2: string): boolean {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);

    return h1 * 60 + m1 > h2 * 60 + m2;
  }

  isToday(dateString: string): boolean {
    if (!dateString) return false;

    const today = new Date();

    // parse YYYY-MM-DD as local date
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  }

  /** Combines date (YYYY-MM-DD) and time (HH:mm) into a Date for display/formatting. */
  combineDateAndTimeToDate(dateStr: string | null | undefined, timeStr: string | null | undefined): Date | null {
    if (!dateStr || !timeStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }

  formatDisplayDate(date: Date): string {
    return this.datePipe.transform(date, 'd MMM') ?? '';
  }

  formatDisplayTime(date: Date): string {
    return this.datePipe.transform(date, 'hh:mm a') ?? '';
  }

  combineDateAndTime(dateStr: string | null, timeStr: string | null): string | null {
    if (!dateStr || !timeStr) return null;

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);

    return this.datePipe.transform(localDate, "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", 'UTC') ?? null;
  }

  parseDateTime(dateTimeStr: string): { date: string; time: string } | null {
    if (!dateTimeStr) return null;

    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return null;

    return {
      date: this.datePipe.transform(date, 'yyyy-MM-dd') ?? '',
      time: this.datePipe.transform(date, 'HH:mm') ?? ''
    };
  }

  getUserSections(participants: any[], attendees?: any[]): UserSection[] {
    const mapUser = (user: any): IUser => ({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      username: user.username,
      thumbnail_url: user.thumbnail_url || user.image_url,
      image_url: user.image_url || user.thumbnail_url,
      total_gamification_points: user.total_gamification_points,
      connection_status: user.connection_status
    });

    const getParticipantsByRole = (role: string): IUser[] => {
      if (!participants || !Array.isArray(participants)) return [];

      return participants
        .filter((p: any) => (p.role || '').toLowerCase() === role.toLowerCase())
        .map((p: any) => {
          const user = p.user || p;
          return user ? mapUser(user) : null;
        })
        .filter((user): user is IUser => user !== null);
    };

    const sections: UserSection[] = [];
    const hosts = getParticipantsByRole('Host');
    const coHosts = getParticipantsByRole('CoHost');
    const sponsors = getParticipantsByRole('Sponsor');
    const speakers = getParticipantsByRole('Speaker');
    const staff = getParticipantsByRole('Staff');

    if (hosts.length > 0) {
      sections.push({ title: 'Host(s)', users: hosts });
    }
    if (coHosts.length > 0) {
      sections.push({ title: 'Co-Host(s)', users: coHosts });
    }
    if (sponsors.length > 0) {
      sections.push({ title: 'Sponsors', users: sponsors, overflowLabelClass: '!bg-neutral-02 !text-neutral-07' });
    }
    if (speakers.length > 0) {
      sections.push({ title: 'Speaker(s)', users: speakers });
    }

    if (staff.length > 0) {
      sections.push({ title: 'Staff', users: staff });
    }

    return sections;
  }

  createDateItems(parentEvent: any): SegmentButtonItem[] {
    const dateItemsWithDates: Array<{ item: SegmentButtonItem; date: Date }> = [];

    if (parentEvent?.start_date) {
      const parentDate = new Date(parentEvent.start_date);
      // Skip if date is invalid
      if (!isNaN(parentDate.getTime())) {
        const parentDateKey = this.formatDateKey(parentEvent.start_date);
        dateItemsWithDates.push({
          item: {
            value: parentDateKey,
            label: parentDateKey,
            icon: 'assets/svg/calendar.svg',
            activeIcon: 'assets/svg/calendar-selected.svg'
          },
          date: parentDate
        });
      }
    }

    if (parentEvent?.child_events && parentEvent.child_events.length > 0) {
      parentEvent.child_events.forEach((childEvt: any) => {
        if (childEvt.start_date && childEvt.can_view) {
          const childDate = new Date(childEvt.start_date);
          // Skip if date is invalid
          if (!isNaN(childDate.getTime())) {
            const childDateKey = this.formatDateKey(childEvt.start_date);
            // Check if this date key already exists
            if (!dateItemsWithDates.some((entry) => entry.item.value === childDateKey)) {
              dateItemsWithDates.push({
                item: {
                  value: childDateKey,
                  label: childDateKey,
                  icon: 'assets/svg/calendar.svg',
                  activeIcon: 'assets/svg/calendar-selected.svg'
                },
                date: childDate
              });
            }
          }
        }
      });
    }

    // Sort dates chronologically (earliest first) using the actual Date objects
    dateItemsWithDates.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Extract just the items in sorted order
    return dateItemsWithDates.map((entry) => entry.item);
  }

  transformEventDataToForm(eventData: any): any {
    const parseDateTime = (dateTimeStr: string): { date: string; time: string } | null => {
      if (!dateTimeStr) return null;
      const date = new Date(dateTimeStr);
      if (isNaN(date.getTime())) return null;
      const dateStr = this.datePipe.transform(date, 'yyyy-MM-dd') ?? '';
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      return { date: dateStr, time: timeStr };
    };

    const transformTicketFromApi = (ticket: any, index: number): any => {
      const transformedTicket: any = {
        id: ticket.id,
        name: ticket.name,
        price: ticket.price,
        quantity: ticket.quantity,
        description: ticket.description || null,
        ticket_type: ticket.ticket_type,
        end_at_event_start: ticket.end_at_event_start ?? true,
        order: ticket.order ?? index + 1
      };

      if (ticket.sales_start_date) {
        const startDateTime = parseDateTime(ticket.sales_start_date);
        if (startDateTime) {
          transformedTicket.sales_start_date = startDateTime.date;
          transformedTicket.sale_start_time = startDateTime.time;
        }
      }

      if (!ticket.end_at_event_start && ticket.sales_end_date) {
        const endDateTime = parseDateTime(ticket.sales_end_date);
        if (endDateTime) {
          transformedTicket.sales_end_date = endDateTime.date;
          transformedTicket.sale_end_time = endDateTime.time;
        }
      }

      return transformedTicket;
    };

    const transformQuestionnaireData = (questions: any[]): any[] | null => {
      if (!questions?.length) return null;
      return this.formatQuestionnaire(questions);
    };

    const formData: any = {
      title: eventData.title || null,
      description: eventData.description || null,
      address: eventData.address || null,
      latitude: eventData.latitude || null,
      longitude: eventData.longitude || null,
      city: eventData.city || null,
      state: eventData.state || null,
      country: eventData.country || null,
      category_id: eventData.category_id || null,
      is_public: eventData.is_public ?? true,
      medias:
        eventData.medias
          ?.map((media: any) => ({
            id: media.id,
            type: media.media_type?.toLowerCase() === 'image' ? 'image' : 'video',
            url: media.media_url,
            file: undefined,
            order: media.order || 0
          }))
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0)) || [],
      tickets:
        eventData.tickets
          ?.map((ticket: any, index: number) => transformTicketFromApi(ticket, index))
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0)) || [],
      promo_codes: eventData.promo_codes || [],
      participants:
        eventData.participants?.map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          role: p.role,
          name: p.user?.name || null,
          thumbnail_url: p.user?.thumbnail_url || null
        })) || [],
      vibes: eventData.vibes?.map((vibe: any) => vibe.id || vibe) || [],
      questionnaire: transformQuestionnaireData(eventData.questions || eventData.questionnaire || [])
    };

    if (eventData.start_date) {
      const startDateTime = parseDateTime(eventData.start_date);
      if (startDateTime) {
        formData.date = startDateTime.date;
        formData.start_time = startDateTime.time;
      }
    }

    if (eventData.end_date) {
      const endDateTime = parseDateTime(eventData.end_date);
      if (endDateTime) {
        formData.end_time = endDateTime.time;
        formData.until_finished = false;
      } else {
        formData.until_finished = true;
      }
    } else {
      formData.until_finished = true;
    }

    if (eventData.settings) {
      const settings = eventData.settings;
      formData.is_repeating_event = settings.is_repeating_event ?? false;
      formData.repeating_frequency = settings.repeating_frequency?.toLowerCase() || null;
      formData.is_rsvp_approval_required = settings.is_rsvp_approval_required ?? false;
      formData.is_show_timer = settings.is_show_timer ?? false;
      formData.max_attendees_per_user = settings.max_attendees_per_user || null;
      formData.allow_plus_ones = (settings.max_attendees_per_user && settings.max_attendees_per_user > 0) || false;
      formData.host_pays_platform_fee = settings.host_pays_platform_fee ?? false;
      formData.additional_fees = settings.additional_fees ? Number(settings.additional_fees) : null;
      formData.guest_fee_enabled = settings.additional_fees && settings.additional_fees > 0 ? true : false;
      formData.is_subscriber_exclusive = settings.is_subscriber_exclusive ?? false;
    }

    // Handle subscription plans
    formData.is_subscription = eventData.plan_ids && eventData.plan_ids.length > 0 ? true : false;
    formData.plan_ids = eventData.plan_ids && Array.isArray(eventData.plan_ids) ? eventData.plan_ids : [];

    return formData;
  }

  createDateItemsFromForm(repeatingEvents: any[], baseDate: string | null, isRepeating: boolean): SegmentButtonItem[] {
    if (!isRepeating || !repeatingEvents || repeatingEvents.length === 0) {
      if (baseDate) {
        const formatted = this.formatDateKey(baseDate);
        return [
          {
            value: formatted,
            label: formatted,
            icon: 'assets/svg/calendar.svg',
            activeIcon: 'assets/svg/calendar-selected.svg'
          }
        ];
      }
      return [];
    }

    const itemsWithDates: Array<{ item: SegmentButtonItem; date: Date }> = [];

    if (baseDate) {
      const baseDateObj = new Date(baseDate);
      if (!isNaN(baseDateObj.getTime())) {
        const baseFormatted = this.formatDateKey(baseDate);
        itemsWithDates.push({
          item: {
            value: baseFormatted,
            label: baseFormatted,
            icon: 'assets/svg/calendar.svg',
            activeIcon: 'assets/svg/calendar-selected.svg'
          },
          date: baseDateObj
        });
      }
    }

    repeatingEvents.forEach((event: any) => {
      const dateStr = event.date || baseDate;
      if (dateStr) {
        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
          const formatted = this.formatDateKey(dateStr);
          // Check if this date key already exists
          if (!itemsWithDates.some((entry) => entry.item.value === formatted)) {
            itemsWithDates.push({
              item: {
                value: formatted,
                label: formatted,
                icon: 'assets/svg/calendar.svg',
                activeIcon: 'assets/svg/calendar-selected.svg'
              },
              date: dateObj
            });
          }
        }
      }
    });

    // Sort dates chronologically (earliest first) using the actual Date objects
    itemsWithDates.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Extract just the items in sorted order
    return itemsWithDates.map((entry) => entry.item);
  }

  transformEventDataForDisplay(
    eventData: any,
    parentEvent?: any,
    currentUser?: any,
    options?: {
      userSections?: UserSection[];
      dateItems?: SegmentButtonItem[];
      isRepeatingEvent?: boolean;
      formattedLocation?: string;
    }
  ): Partial<EventDisplayData> {
    const participants = eventData?.participants || [];
    const attendees = eventData?.attendees || [];
    const userSections = options?.userSections || this.getUserSections(participants, attendees);
    const hosts = userSections.find((s) => s.title === 'Host(s)')?.users || [];

    const { displayMedias, allMedias } = this.processMediaItems(eventData?.medias || []);
    const thumbnailMedia = allMedias.find((m: any) => m.order === 1) || allMedias[0];
    const thumbnailUrl = thumbnailMedia?.url || '';

    const location = options?.formattedLocation || this.formatLocation(eventData?.address, eventData?.city, eventData?.state, eventData?.country);

    let mapCenter: [number, number] | null = null;
    if (eventData?.latitude != null && eventData?.longitude != null) {
      const lat = typeof eventData.latitude === 'string' ? parseFloat(eventData.latitude) : eventData.latitude;
      const lng = typeof eventData.longitude === 'string' ? parseFloat(eventData.longitude) : eventData.longitude;
      if (!isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng)) {
        mapCenter = [lng, lat];
      }
    }

    const admission = this.formatAdmission(eventData?.tickets || []);

    let formattedDateTime = '';
    if (eventData?.start_date) {
      formattedDateTime = this.formatDateTime(eventData.start_date, eventData.end_date);
    } else if (eventData?.date && eventData?.start_time) {
      const dateTimeStr = this.combineDateAndTime(eventData.date, eventData.start_time);
      if (dateTimeStr) {
        const untilFinished = eventData?.until_finished ?? false;
        const endDateTimeStr = untilFinished ? null : eventData?.end_time ? this.combineDateAndTime(eventData.date, eventData.end_time) : null;
        formattedDateTime = this.formatDateTime(dateTimeStr, endDateTimeStr || undefined);
      }
    }

    const rsvpButtonLabel = admission === 'Free' ? 'RSVP Now for Free' : `RSVP Now from ${admission}`;

    const currentParticipant = participants.find((p: any) => {
      const userId = p.user_id || p.user?.id;
      return userId === currentUser?.id;
    });

    const role = (currentParticipant?.role || '').toLowerCase();

    const isCurrentUserHost = role === 'host';
    const isCurrentUserCoHost = role === 'cohost';
    const isCurrentUserStaff = role === 'staff';
    const isCurrentUserSpeaker = role === 'speaker';
    const isCurrentUserSponsor = role === 'sponsor';

    const isRepeatingEvent = options?.isRepeatingEvent ?? parentEvent?.settings?.is_repeating_event === true;
    const dateItems = options?.dateItems ?? (isRepeatingEvent ? this.createDateItems(parentEvent || eventData) : []);

    let hostName = hosts[0]?.name || 'Get Networked';
    if (!hostName || hostName === 'Get Networked') {
      const host = Array.isArray(participants) ? participants.find((p: any) => (p.role || '').toLowerCase() === 'host') : null;
      hostName = host?.name || host?.user?.name || hostName;
    }

    const isRsvpApprovalRequired = eventData?.settings?.is_rsvp_approval_required ?? false;

    return {
      id: eventData?.id,
      thumbnail_url: eventData?.thumbnail_url || thumbnailUrl,
      image_url: eventData?.image_url,
      title: eventData?.title || '',
      description: eventData?.description || '',
      displayMedias,
      hostName,
      isPublic: eventData?.is_public !== false,
      location,
      mapCenter,
      admission,
      formattedDateTime,
      slug: eventData?.slug || '',
      userSections,
      isRepeatingEvent,
      start_date: eventData?.start_date,
      end_date: eventData?.end_date,
      dateItems,
      rsvpButtonLabel,
      isCurrentUserHost,
      isCurrentUserCoHost,
      isCurrentUserSponsor,
      isCurrentUserSpeaker,
      isCurrentUserStaff,
      isRsvpApprovalRequired,
      tickets: eventData?.tickets || [],
      questionnaire: eventData?.questionnaire || eventData?.questions || [],
      promo_codes: eventData?.promo_codes || [],
      total_views: eventData?.total_views || 0,
      has_plans: eventData?.plan_ids.length > 0 || false,
      is_subscriber_exclusive: eventData?.is_subscriber_exclusive || false
    };
  }

  formatQuestionnaire(questions: any[]): any[] {
    if (!questions?.length) return [];

    const byPhase = questions.reduce(
      (acc, q) => {
        const phase = (q.event_phase || 'PreEvent') as 'PreEvent' | 'PostEvent';
        if (!acc[phase]) acc[phase] = [];
        acc[phase].push(q);
        return acc;
      },
      {} as Record<'PreEvent' | 'PostEvent', any[]>
    );

    const formatQuestions = (phaseQuestions: any[], phase: 'PreEvent' | 'PostEvent') => {
      const sorted = phaseQuestions.sort((a, b) => (a.order || 0) - (b.order || 0));
      return sorted.map((q, index) => this.formatQuestion(q, phase, index + 1));
    };

    return [...formatQuestions(byPhase.PreEvent || [], 'PreEvent'), ...formatQuestions(byPhase.PostEvent || [], 'PostEvent')];
  }

  private formatQuestion(q: any, phase: 'PreEvent' | 'PostEvent', order: number): any {
    const formatted: any = {
      question: q.question,
      event_phase: phase,
      question_type: q.question_type || q.type,
      is_required: q.is_required ?? q.required ?? false,
      is_public: q.is_public ?? q.visibility === 'public',
      order
    };

    if (q.id != null) formatted.id = q.id;
    if (q.min != null) formatted.min = q.min;
    if (q.max != null) formatted.max = q.max;
    if (q.rating_scale || q.rating) formatted.rating_scale = q.rating_scale || q.rating;

    if (Array.isArray(q.options) && q.options.length > 0) {
      formatted.options = this.formatQuestionOptions(q.options);
    }

    return formatted;
  }

  private formatQuestionOptions(options: any[]): any[] {
    const sorted = [...options].sort((a, b) => {
      const orderA = typeof a === 'object' && a.order != null ? a.order : 0;
      const orderB = typeof b === 'object' && b.order != null ? b.order : 0;
      return orderA - orderB;
    });

    return sorted.map((opt, index) => {
      if (typeof opt === 'string') {
        return { option: opt, order: index + 1 };
      }
      if (typeof opt === 'object' && opt.option) {
        const formatted: { option: string; order: number; id?: string } = { option: opt.option, order: opt.order ?? index + 1 };
        if (opt.id != null) formatted.id = opt.id;
        return formatted;
      }
      return { option: String(opt), order: index + 1 };
    });
  }

  formatTickets(tickets: any[], eventDate: string | null, eventStartTime: string | null): any[] {
    return tickets.map((ticket, index) => {
      const formattedTicket: any = {
        id: ticket.id,
        name: ticket.name,
        price: Number(ticket.price),
        quantity: Number(ticket.quantity),
        description: ticket.description || '',
        ticket_type: ticket.ticket_type,
        end_at_event_start: ticket.end_at_event_start ?? false,
        order: ticket.order ?? index + 1
      };

      if (ticket.sales_start_date) {
        const startTime = ticket.sale_start_time || '00:00';
        formattedTicket.sales_start_date = this.combineDateAndTime(ticket.sales_start_date, startTime);
      }

      if (ticket.end_at_event_start && eventDate && eventStartTime) {
        formattedTicket.sales_end_date = this.combineDateAndTime(eventDate, eventStartTime);
      } else if (ticket.sales_end_date) {
        const endTime = ticket.sale_end_time || '23:59';
        formattedTicket.sales_end_date = this.combineDateAndTime(ticket.sales_end_date, endTime);
      }

      return formattedTicket;
    });
  }

  formatPromoCodes(promoCodes: any[]): any[] {
    return promoCodes.map((promo) => ({
      id: promo.id,
      promo_code: promo.promo_code,
      type: promo.type,
      value: Number(promo.value),
      capped_amount: promo.capped_amount != null ? Number(promo.capped_amount) : null,
      quantity: promo.quantity != null ? Math.floor(Number(promo.quantity)) : null,
      max_uses_per_user: promo.max_uses_per_user != null ? Math.floor(Number(promo.max_uses_per_user)) : null
    }));
  }

  buildEventSettings(formData: any): any {
    const settings: any = {
      is_repeating_event: formData.is_repeating_event ?? false,
      is_rsvp_approval_required: formData.is_rsvp_approval_required ?? false,
      is_show_timer: formData.is_show_timer ?? false,
      host_pays_platform_fee: formData.host_pays_platform_fee ?? false,
      is_subscriber_exclusive: formData.is_subscriber_exclusive ?? false
    };

    if (formData.repeating_frequency && formData.repeating_frequency !== 'custom') {
      settings.repeating_frequency = formData.repeating_frequency.charAt(0).toUpperCase() + formData.repeating_frequency.slice(1);
    }

    if (formData.max_attendees_per_user != null) {
      settings.max_attendees_per_user = formData.max_attendees_per_user;
    }

    if (formData.additional_fees && formData.guest_fee_enabled) {
      const fees = Number(formData.additional_fees);
      if (!isNaN(fees)) {
        settings.additional_fees = fees;
      }
    }

    return settings;
  }

  cleanupEventPayload(payload: any, settings: any): any {
    const fieldsToDelete = [
      'repeating_events',
      'date',
      'start_time',
      'end_time',
      'until_finished',
      'is_repeating_event',
      'repeating_frequency',
      'is_rsvp_approval_required',
      'is_show_timer',
      'max_attendees_per_user',
      'host_pays_platform_fee',
      'additional_fees',
      'is_subscription',
      'guest_fee_enabled',
      'allow_plus_ones',
      'category',
      'subscription_plan',
      'repeat_count',
      'custom_repeat_count',
      'subscription_id',
      'is_subscriber_exclusive'
    ];

    fieldsToDelete.forEach((field) => delete payload[field]);

    if (payload.participants && Array.isArray(payload.participants)) {
      payload.participants = payload.participants.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        role: p.role
      }));
    }

    if (Object.keys(settings).length > 0) {
      payload.settings = settings;
    }

    return payload;
  }

  async getEvents(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      include_participant_events?: boolean;
      order_by?: string;
      order_direction?: 'ASC' | 'DESC';
      is_my_events?: boolean;
      is_included_me_event?: boolean;
      city?: string;
      state?: string;
      latitude?: string;
      longitude?: string;
      radius?: number;
      is_public?: boolean;
      start_date?: string;
      end_date?: string;
      roles?: string;
      user_id?: string;
      is_liked?: boolean;
      append?: boolean; // If true, append to existing events instead of replacing
      is_upcoming_event?: boolean;
      is_recommended?: boolean;
      is_all_events?: boolean;
      from_home?: boolean;
    } = {
      from_home: false
    }
  ): Promise<EventsResponse> {
    try {
      let httpParams = new HttpParams();

      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }
      if (params.search) {
        httpParams = httpParams.set('search', params.search);
      }
      if (params.include_participant_events !== undefined) {
        httpParams = httpParams.set('include_participant_events', params.include_participant_events.toString());
      }
      if (params.order_by) {
        httpParams = httpParams.set('order_by', params.order_by);
      }
      if (params.order_direction) {
        httpParams = httpParams.set('order_direction', params.order_direction);
      }
      if (params.is_included_me_event !== undefined) {
        httpParams = httpParams.set('is_included_me_event', params.is_included_me_event.toString());
      }
      if (params.city) {
        httpParams = httpParams.set('city', params.city);
      }
      if (params.state) {
        httpParams = httpParams.set('state', params.state);
      }
      if (params.latitude) {
        httpParams = httpParams.set('latitude', params.latitude);
      }
      if (params.longitude) {
        httpParams = httpParams.set('longitude', params.longitude);
      }
      if (params.radius !== undefined) {
        httpParams = httpParams.set('radius', params.radius.toString());
      }
      if (params.is_public !== undefined) {
        httpParams = httpParams.set('is_public', params.is_public.toString());
      }
      if (params.start_date) {
        httpParams = httpParams.set('start_date', params.start_date);
      }
      if (params.end_date) {
        httpParams = httpParams.set('end_date', params.end_date);
      }
      if (params.roles) {
        httpParams = httpParams.set('roles', params.roles);
      }
      if (params.user_id) {
        httpParams = httpParams.set('user_id', params.user_id);
      }
      if (params.is_liked !== undefined) {
        httpParams = httpParams.set('is_liked', params.is_liked.toString());
      }
      if (params.is_upcoming_event !== undefined) {
        httpParams = httpParams.set('is_upcoming_event', params.is_upcoming_event.toString());
      }
      if (params.is_recommended !== undefined) {
        httpParams = httpParams.set('is_recommended', params.is_recommended.toString());
      }

      const response = await this.get<EventsResponse>('/events', { params: httpParams });
      const events = response?.data?.data || [];

      // Store public events if is_public is true
      if (params.from_home && params.is_public) {
        this.publicEvents.set(params.append ? [...this.publicEvents(), ...events] : events);
      }

      if (params.from_home && params.is_all_events) {
        this.allEvents.set(params.append ? [...this.allEvents(), ...events] : events);
      }

      if (params.from_home && params.is_upcoming_event) {
        this.upcomingEvents.set(params.append ? [...this.upcomingEvents(), ...events] : events);
      }

      if (params.from_home && params.is_recommended) {
        this.recommendedEvents.set(params.append ? [...this.recommendedEvents(), ...events] : events);
      }

      if (params.from_home && params.is_my_events) {
        this.myEvents.set(params.append ? [...this.myEvents(), ...events] : events);
      }
      return response;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  // like/unlike event
  async likeEvent(eventId: string): Promise<{ data: { content: boolean } }> {
    try {
      const response = await this.post<{ data: { content: boolean } }>(`/events/${eventId}/like`, {});
      return response;
    } catch (error) {
      console.error('Error toggling event like:', error);
      throw error;
    }
  }

  // delete event
  async deleteEvent(eventId: string): Promise<EventResponse> {
    try {
      const response = await this.delete<EventResponse>(`/events/${eventId}`);
      return response;
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  // report event
  async reportEvent(eventId: string, reportData: { report_reason_id: string; reason?: string }): Promise<any> {
    try {
      const response = await this.post<any>(`/events/${eventId}/report`, reportData);
      return response;
    } catch (error) {
      console.error('Error reporting event:', error);
      throw error;
    }
  }

  // Save event attendee (RSVP) - sends single attendee object
  async saveEventAttendees(payload: EventAttendeesPayload): Promise<any> {
    try {
      const response = await this.post<any>(`/event-attendees/`, payload);
      return response;
    } catch (error) {
      console.error('Error saving event attendees:', error);
      throw error;
    }
  }

  // Save event feedback (questionnaire responses)
  async saveEventFeedback(eventId: string, feedbackPayload: EventFeedbackPayload): Promise<any> {
    try {
      const response = await this.post<any>(`/events/${eventId}/feedback`, feedbackPayload);
      return response;
    } catch (error) {
      console.error('Error saving event feedback:', error);
      throw error;
    }
  }

  // Send RSVP request (when approval is required)
  async sendRsvpRequest(eventId: string): Promise<any> {
    try {
      const response = await this.post<any>(`/rsvp-requests/${eventId}`, {});
      return response;
    } catch (error) {
      console.error('Error sending RSVP request:', error);
      throw error;
    }
  }

  // Get pending RSVP requests
  async getPendingRsvpRequests(eventId: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      let httpParams = new HttpParams();
      httpParams = httpParams.set('page', page.toString());
      httpParams = httpParams.set('limit', limit.toString());
      const response = await this.get<any>(`/rsvp-requests/${eventId}/pending`, { params: httpParams });
      return response;
    } catch (error) {
      console.error('Error fetching pending RSVP requests:', error);
      throw error;
    }
  }

  // Get processed RSVP requests
  async getProcessedRsvpRequests(eventId: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      let httpParams = new HttpParams();
      httpParams = httpParams.set('page', page.toString());
      httpParams = httpParams.set('limit', limit.toString());
      const response = await this.get<any>(`/rsvp-requests/${eventId}/processed`, { params: httpParams });
      return response;
    } catch (error) {
      console.error('Error fetching processed RSVP requests:', error);
      throw error;
    }
  }

  // Approve or reject RSVP request
  async approveOrRejectRsvpRequest(eventId: string, requestId: string, action: 'Approved' | 'Rejected'): Promise<any> {
    try {
      const response = await this.put<any>(`/rsvp-requests/${eventId}/approve-or-reject/${requestId}`, { action });
      return response;
    } catch (error) {
      console.error('Error approving/rejecting RSVP request:', error);
      throw error;
    }
  }

  // Reset all events (similar to resetAllFeeds in FeedService)
  resetAllEvents(): void {
    this.myEvents.set([]);
    this.recommendedEvents.set([]);
    this.publicEvents.set([]);
    this.allEvents.set([]);
    this.upcomingEvents.set([]);
    this.cityCards.set([]);
    this.isLoadingCities.set(false);
  }

  async getTopCities(): Promise<ICity[]> {
    try {
      const response = await this.get<{ success: boolean; message: string; data: ICity[] }>('/events/top-cities');
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching top cities:', error);
      throw error;
    }
  }

  async getEventAnalytics(eventId: string): Promise<any> {
    try {
      const response = await this.get<any>(`/events/analytics/${eventId}`);
      return response?.data;
    } catch (error) {
      console.error('Error fetching event analytics:', error);
      throw error;
    }
  }

  async getEventTicketAnalytics(ticketId: string, page?: number, limit?: number, search?: string): Promise<any> {
    try {
      let httpParams = new HttpParams();

      if (page && page > 0) {
        httpParams = httpParams.set('page', page.toString());
      }

      if (limit && limit > 0) {
        httpParams = httpParams.set('limit', limit.toString());
      }

      if (search && search.trim()) {
        httpParams = httpParams.set('search', search.trim());
      }

      const response = await this.get<any>(`/events/ticket-analytics/${ticketId}`, { params: httpParams });

      return response?.data;
    } catch (error) {
      console.error('Error fetching event ticket analytics:', error);
      throw error;
    }
  }

  async downloadEventTicketAnalyticsCSV(ticketId: string): Promise<any> {
    try {
      const response = await this.get<any>(`/events/ticket-analytics-csv/${ticketId}`, { responseType: 'text' });
      return response;
    } catch (error) {
      console.error('Error downloading event ticket analytics CSV:', error);
      throw error;
    }
  }

  async downloadEventAttendeesCSV(eventId: string): Promise<any> {
    try {
      const response = await this.get<any>(`/event-attendees/export-csv/${eventId}`, { responseType: 'text' });
      return response;
    } catch (error) {
      console.error('Error downloading event attendees CSV:', error);
      throw error;
    }
  }

  async downloadQuestionnaireResponsesCSV(eventId: string, eventPhase: 'PreEvent' | 'PostEvent'): Promise<any> {
    try {
      let httpParams = new HttpParams().set('event_id', eventId).set('event_phase', eventPhase);
      const response = await this.get<any>(`/events/questions-attendees/csv`, {
        params: httpParams,
        responseType: 'text'
      });

      return response;
    } catch (error: any) {
      const errorJson = JSON.parse(error.error);
      throw new Error(errorJson.message);
    }
  }

  async downloadQuestionnaireAnalyticsCSV(eventId: string, eventPhase: 'PreEvent' | 'PostEvent'): Promise<any> {
    try {
      let httpParams = new HttpParams().set('event_id', eventId).set('event_phase', eventPhase);
      const response = await this.get<any>(`/events/question-analysis/csv`, {
        params: httpParams,
        responseType: 'text'
      });
      return response;
    } catch (error: any) {
      const errorJson = JSON.parse(error.error);
      throw new Error(errorJson.message);
    }
  }

  async getEventQuestionnaireResponses(
    eventId: string,
    eventPhase: 'PreEvent' | 'PostEvent',
    search: string = '',
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    try {
      let httpParams = new HttpParams();
      if (page && page > 0) {
        httpParams = httpParams.set('page', page.toString());
      }

      if (limit && limit > 0) {
        httpParams = httpParams.set('limit', limit.toString());
      }

      if (search && search.trim()) {
        httpParams = httpParams.set('search', search.trim());
      }

      if (eventPhase) {
        httpParams = httpParams.set('event_phase', eventPhase);
      }
      const response = await this.get<any>(`/events/questions-attendees/${eventId}`, { params: httpParams });
      return response?.data;
    } catch (error) {
      console.error('Error fetching event questionnaire responses:', error);
      throw error;
    }
  }

  async getEventQuestionnaireResponsesByUserId(userId: string, eventId: string, eventPhase: 'PreEvent' | 'PostEvent'): Promise<any> {
    try {
      let httpParams = new HttpParams();
      if (userId) {
        httpParams = httpParams.set('user_id', userId);
      }
      if (eventId) {
        httpParams = httpParams.set('event_id', eventId);
      }
      if (eventPhase) {
        httpParams = httpParams.set('event_phase', eventPhase);
      }
      const response = await this.get<any>(`/events/user-questions-answers`, { params: httpParams });
      return response?.data;
    } catch (error) {
      console.error('Error fetching event questionnaire responses by user ID:', error);
      throw error;
    }
  }

  async getEventQuestionAnalysis(eventId: string, eventPhase: 'PreEvent' | 'PostEvent' | ''): Promise<any> {
    try {
      let httpParams = new HttpParams();
      if (eventId) {
        httpParams = httpParams.set('event_id', eventId);
      }
      if (eventPhase) {
        httpParams = httpParams.set('event_phase', eventPhase);
      }
      const response = await this.get<any>(`/events/question-analysis`, { params: httpParams });
      return response?.data;
    } catch (error) {
      console.error('Error fetching event question analysis:', error);
      throw error;
    }
  }

  async getEventQuestionOptionUsers(questionId: string, optionValue: string, page: number = 1, limit: number = 20): Promise<any> {
    try {
      let httpParams = new HttpParams();
      if (questionId) {
        httpParams = httpParams.set('question_id', questionId);
      }
      if (optionValue) {
        httpParams = httpParams.set('option_id', optionValue);
      }
      if (page && page > 0) {
        httpParams = httpParams.set('page', page.toString());
      }

      if (limit && limit > 0) {
        httpParams = httpParams.set('limit', limit.toString());
      }
      const response = await this.get<any>(`/events/question-option-users`, { params: httpParams });
      return response?.data;
    } catch (error) {
      console.error('Error fetching event question option users:', error);
      throw error;
    }
  }

  async manageRoles(eventId: string, payload: any): Promise<any> {
    try {
      const response = await this.put<any>(`/events/participants/role/${eventId}`, payload);
      return response?.data;
    } catch (error) {
      console.error('Error managing roles:', error);
      throw error;
    }
  }

  async changeCheckInStatus(payload: any) {
    try {
      const response = await this.put<any>(`/event-attendees/check-in`, payload);
      return response?.data;
    } catch (error) {
      console.error('Error check in:', error);
      throw error;
    }
  }

  async deleteAttendees(id: string): Promise<EventResponse> {
    try {
      const response = await this.delete<EventResponse>(`/event-attendees/${id}`);
      return response;
    } catch (error) {
      console.error('Error deleting attendees:', error);
      throw error;
    }
  }

  async refundAttendee(attendeeId: string): Promise<IRefundAttendeeResponse> {
    try {
      const response = await this.post<IRefundAttendeeResponse>('/event-attendees/refund', { attendee_id: attendeeId });
      return response;
    } catch (error) {
      console.error('Error refunding attendee:', error);
      throw error;
    }
  }

  async shareEvent(payload: { event_id: string; peer_ids?: string[]; send_entire_network?: boolean; type?: string; message?: string }): Promise<any> {
    try {
      const response = await this.post<any>('/chat-rooms/share', payload);
      return response;
    } catch (error) {
      console.error('Error sharing feed:', error);
      throw error;
    }
  }

  async networkBroadcast(eventId: string, type: 'email' | 'sms'): Promise<any> {
    try {
      const response = await this.post<any>('/events/network-broadcast', {
        event_id: eventId,
        type: type
      });
      return response;
    } catch (error) {
      console.error('Error broadcasting event:', error);
      throw error;
    }
  }

  checkEventAccess(eventData: any): boolean {
    const currentUser = this.authService?.currentUser();
  
    if (!currentUser?.id) return false;
  
    if (currentUser.is_admin) return true;
  
    const participants = eventData?.participants || [];
  
    return participants.some((p: any) => {
      const userId = p.user_id || p.user?.id;
      return userId === currentUser.id;
    });
  }

  checkSpeakerOrSponsorAccess(eventData: any): boolean {
    const currentUser = this.authService?.currentUser();

    if (!currentUser?.id || !eventData?.participants) {
      return false;
    }

    const participants = eventData.participants || [];
    const isSpeaker = participants.some((p: any) => {
      const userId = p.user?.id;
      const role = (p.role || '').toLowerCase();
      return userId === currentUser.id && role === 'speaker';
    });

    const isSponsor = participants.some((p: any) => {
      const userId = p.user?.id;
      const role = (p.role || '').toLowerCase();
      return userId === currentUser.id && role === 'sponsor';
    });

    return isSpeaker || isSponsor;
  }

  async checkIsLoggin(): Promise<boolean> {
    if (!this.isLoggedIn()) {
      const result = await this.modalService.openLoginModal();

      if (!result?.success) {
        return false; // login failed or cancelled
      }
    }

    return true; // already logged in OR login succeeded
  }

  sanitizeOgDescription(html: string): string {
    if (!html) return '';

    const text = html
      // Remove script & style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove all remaining HTML tags
      .replace(/<\/?[^>]+(>|$)/g, '')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Normalize spaces
      .replace(/\s+/g, ' ')
      .trim();

    return text;
  }

  async addGuest(payload: IAddGuestPayload): Promise<IAddGuestResponse> {
    try {
      const response = await this.post<IAddGuestResponse>('/event-attendees/add', payload);
      return response;
    } catch (error) {
      console.error('Error adding guest:', error);
      throw error;
    }
  }

  async markAsPaid(eventId: string, attendeeId: string, markAsPaid: boolean): Promise<IMarkAsPaidResponse> {
    try {
      const body = {
        event_id: eventId,
        attendee_id: attendeeId,
        mark_as_paid: markAsPaid
      };
      const response = await this.post<IMarkAsPaidResponse>('/event-attendees/mark-as-paid', body);
      return response;
    } catch (error) {
      console.error('Error marking as paid:', error);
      throw error;
    }
  }

  async shareEventCsvBroadcast(payload: {
    event_id: string;
    type: 'sms' | 'email' | 'both';
    recipients: { email: string | null; phone: string | null }[];
  }): Promise<ICsvBroadcastResponse> {
    try {
      const response = await this.post<ICsvBroadcastResponse>('/events/share-csv-broadcast', payload);
      return response;
    } catch (error) {
      console.error('Error sharing event CSV broadcast:', error);
      throw error;
    }
  }

  async getEventViewersList(
    eventId: string,
    params: { page?: number; limit?: number; search?: string } = {}
  ): Promise<{ data: IEventViewer[]; pagination: IPagination }> {
    try {
      let httpParams = new HttpParams()
        .set('page', String(params.page ?? 1))
        .set('limit', String(params.limit ?? 20));
  
      if (params.search?.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }
  
      const response = await this.get<IEventViewersResponse>(
        `/events/${eventId}/viewers`,
        { params: httpParams }
      );
  
      const payload = response?.data;
  
      return {
        data: payload?.data ?? [],
        pagination: payload?.pagination ?? {
          totalCount: 0,
          currentPage: 1,
          totalPages: 0
        }
      };
    } catch (error) {
      console.error('Error fetching event viewers:', error);
      throw error;
    }
  }
}
