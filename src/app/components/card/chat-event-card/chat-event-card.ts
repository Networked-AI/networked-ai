import { IEvent } from '@/interfaces/event';
import { environment } from 'src/environments/environment';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, inject, input, computed } from '@angular/core';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';

@Component({
  selector: 'app-chat-event-card',
  imports: [DatePipe, NgOptimizedImage],
  templateUrl: './chat-event-card.html',
  styleUrl: './chat-event-card.scss'
})
export class ChatEventCard {
  private datePipe = new DatePipe('en-US');
  private navigationService = inject(NavigationService);

  event = input<IEvent | null>();
  inPost = input<boolean>(false);
  frontendUrl = environment.frontendUrl;
  eventLinkText = computed(() => `${this.frontendUrl}/event/${this.event()?.slug}`);

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: any): void {
    onImageError(event);
  }

  eventMessage(): string {
    const event: any = this.event();
    if (!event) return '';

    const frontendUrl = environment.frontendUrl;

    const formattedDateTime = this.formatDateTime(event.start_date, event.end_date);

    return `You're Invited: ${event.title}

Hosted by ${event.created_by_user?.name}. ${formattedDateTime} at ${event.address}

Get out. Get Networked.
Powered by ${frontendUrl}
`;
  }

  formatDateTime(startDate?: string, endDate?: string): string {
    if (!startDate || !endDate) return '';

    const start = this.datePipe.transform(startDate, 'M/d/yy, h:mm a');

    const end = this.datePipe.transform(endDate, 'h:mm a');

    if (!start || !end) return '';

    return `${start} - ${end}`;
  }

  goToEvent() {
    this.navigationService.navigateForward(`/event/${this.event()?.slug || ''}`);
  }
}
