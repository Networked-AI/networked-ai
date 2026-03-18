import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { EventService } from '@/services/event.service';
import { EventAttendee, IEvent } from '@/interfaces/event';
import { HapticService } from '@/services/haptic.service';
import { NgOptimizedImage, DatePipe } from '@angular/common';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { input, Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
@Component({
  imports: [NgOptimizedImage, DatePipe, Button],
  selector: 'upcoming-event-card',
  styleUrl: './upcoming-event-card.scss',
  templateUrl: './upcoming-event-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpcomingEventCard {
  private authService = inject(AuthService);
  private eventService = inject(EventService);
  private modalService = inject(ModalService);
  private navigationService = inject(NavigationService);
  hapticService = inject(HapticService);
  event = input.required<IEvent>();
  currentUser = computed(() => this.authService.currentUser());
  isLoggedIn = computed(() => !!this.authService.currentUser());
  eventImage = computed(() => {
    const event = this.event();
    const imageUrl =
      event?.thumbnail_url ||
      (event?.medias && event.medias.length > 0 ? event.medias[0].media_url || event.medias[0].url : '') ||
      event?.image ||
      '';
    return getImageUrlOrDefault(imageUrl);
  });

  isHostOrCoHost = computed(() => {
    const currentEvent = this.event();
    const isHostOrCoHost = this.eventService.checkHostOrCoHostAccess(currentEvent);
    return isHostOrCoHost;
  });

  isSponsorOrSpeaker = computed(() => {
    const currentEvent = this.event();
    const isSponsorOrSpeaker = this.eventService.checkSpeakerOrSponsorAccess(currentEvent);
    return isSponsorOrSpeaker;
  });

  isAttendee = computed(() => {
    const currentEvent = this.event();
    const isAttendee = currentEvent.attendees && currentEvent.attendees.length > 0;
    return isAttendee;
  });

  allowToview = computed(() => {
    const currentEvent = this.event();
    return this.isHostOrCoHost() || this.isAttendee() || this.isSponsorOrSpeaker() || currentEvent.is_public || this.currentUser()?.is_admin;
  });

  formattedLocation = computed(() => {
    const event = this.event();
    return this.eventService.formatLocation(event.city, event.state);
  });

  isWeekend = computed(() => {
    const startDate = this.event()?.start_date;
    if (!startDate) return false;
    const date = new Date(startDate);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  });

  hasTickets = computed(() => {
    const event = this.event();
    return event?.attendees?.some((attendee: EventAttendee) => attendee.user_id === this.authService.currentUser()?.id) || false;
  });

  viewTickets(event: any) {
    event?.stopPropagation();
    this.hapticService.onClick();
    this.modalService.openMyTicketsModal(this.event());
  }

  viewEvent() {
    const eventSlug = this.event().slug;
    if (eventSlug) {
      this.navigationService.navigateForward(`/event/${eventSlug}`);
    }
  }

  onImageError = onImageError;
}
