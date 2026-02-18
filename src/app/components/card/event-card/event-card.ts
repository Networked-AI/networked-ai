import { IEvent } from '@/interfaces/event';
import { IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { EventService } from '@/services/event.service';
import { ToasterService } from '@/services/toaster.service';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { ManageEventService } from '@/services/manage-event.service';
import { input, Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { HapticService } from '@/services/haptic.service';

@Component({
  selector: 'event-card',
  imports: [IonIcon, NgOptimizedImage, CommonModule],
  styleUrl: './event-card.scss',
  templateUrl: './event-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EventCard {
  private navigationService = inject(NavigationService);
  private modalService = inject(ModalService);
  private toasterService = inject(ToasterService);
  private eventService = inject(EventService);
  private authService = inject(AuthService);
  manageService = inject(ManageEventService);
  hapticService = inject(HapticService);
  event = input.required<IEvent>();
  showBlur = input<boolean>(true);
  variant = input<'default' | 'compact'>('default');
  localEvent = signal<IEvent | null>(null);

  currentEvent = computed(() => this.localEvent() || this.event());
  isSubscriberExclusive = computed(() => this.currentEvent()?.settings?.is_subscriber_exclusive || false);
  hasPlans = computed(() => this.currentEvent()?.has_plans || false);
  isLoggedIn = computed(() => !!this.authService.currentUser());

  isHostOrCoHost = computed(() => {
    const currentEvent = this.currentEvent();
    const isHostOrCoHost = this.eventService.checkHostOrCoHostAccess(currentEvent);
    return isHostOrCoHost;
  });

  isSponsorOrSpeaker = computed(() => {
    const currentEvent = this.currentEvent();
    const isSponsorOrSpeaker = this.eventService.checkSpeakerOrSponsorAccess(currentEvent);
    return isSponsorOrSpeaker;
  });

  isAttendee = computed(() => {
    const currentEvent = this.currentEvent();
    const isAttendee = currentEvent.attendees && currentEvent.attendees.length > 0;
    return isAttendee;
  });

  allowToview = computed(() => {
    if (!this.showBlur()) return true;
    const currentEvent = this.currentEvent();
    return this.isHostOrCoHost() || this.isAttendee() || this.isSponsorOrSpeaker() || currentEvent.is_public;
  });

  isEventLiked = computed(() => {
    const currentEvent = this.currentEvent();
    return currentEvent?.is_like || false;
  });

  isHost = computed(() => {
    const currentEvent = this.currentEvent();
    return currentEvent?.created_by === this.authService.currentUser()?.id;
  });

  isPastEvent = computed(() => {
    const event = this.currentEvent();
    if (!event) return false;
    const endDate = new Date(event.end_date) || null;
    return endDate ? endDate.getTime() < Date.now() : false;
  });

  formattedDate = computed(() => {
    const event = this.currentEvent();
    if (!event) return 'Date not set';

    if (this.isPastEvent()) {
      const dateStr = event.end_date || event.start_date;
      if (dateStr) {
        const formatted = this.eventService.datePipe.transform(new Date(dateStr), 'MM/dd/yyyy');
        return formatted ? `PAST EVENT ${formatted}` : 'Date not set';
      }
    }

    if (event.start_date) {
      const formatted = this.eventService.formatDateTime(event.start_date, event.end_date);
      return formatted || 'Date not set';
    }

    if (event.date) {
      return event.date;
    }

    return 'Date not set';
  });

  formattedLocation = computed(() => {
    const event = this.currentEvent();
    if (!event) return 'Location not specified';

    if (event.address) {
      return event.address;
    }
    return 'Location not specified';
  });

  eventImage = computed(() => {
    const event = this.currentEvent();
    const imageUrl = event?.image_url || '';
    return getImageUrlOrDefault(imageUrl);
  });

  eventOrganization = computed(() => {
    const event = this.currentEvent();
    const hostName = event?.participants?.find((p: any) => (p.role || '').toLowerCase() === 'host')?.user?.name;
    return hostName || event?.organization || 'Networked AI';
  });

  viewEvent() {
    const eventSlug = this.event().slug;
    if (eventSlug) {
      this.navigationService.navigateForward(`/event/${eventSlug}`);
    }
  }

  async shareEvent() {
    if (!this.showBlur()) return;
    const eventId = this.event().id;
    if (eventId) {
      const isLoggedIn = await this.eventService.checkIsLoggin();
      if (!isLoggedIn) return;

      const result = await this.modalService.openShareModal(eventId, 'Event');
      if (result) {
        this.toasterService.showSuccess('Event shared');
      }
    }
  }

  async likeEvent(event: Event) {
    if (!this.showBlur()) return;
    event.stopPropagation();
    this.hapticService.onClick();
    const eventId = this.event().id;
    if (!eventId) return;

    const isLoggedIn = await this.eventService.checkIsLoggin();
    if (!isLoggedIn) return;

    const currentEvent = this.currentEvent();
    const currentIsLiked = currentEvent?.is_like || false;
    const newIsLiked = !currentIsLiked;

    this.localEvent.set({
      ...currentEvent,
      is_like: newIsLiked
    });

    try {
      await this.eventService.likeEvent(eventId);
    } catch (error) {
      console.error('Error toggling event like:', error);
      this.localEvent.set({
        ...currentEvent,
        is_like: currentIsLiked
      });
    }
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: any): void {
    onImageError(event);
  }

  async openMenu(event: Event) {
    event.stopPropagation();
    this.hapticService.onClick();
    this.manageService.openMenu(this.event());
  }

  openEventChat(event: Event): void {
    event.stopPropagation();
    this.hapticService.onClick();
    const currentUserId = this.authService.currentUser()?.id;
    if (this.currentEvent()?.id && currentUserId) {
      this.navigationService.navigateForward('/chat-room', false, {
        event_id: this.currentEvent()?.id,
        is_personal: false,
        name: this.currentEvent()?.title || null,
        event_image: this.currentEvent()?.image_url?.[0] || null,
        user_ids: []
      });
    }
  }
}
