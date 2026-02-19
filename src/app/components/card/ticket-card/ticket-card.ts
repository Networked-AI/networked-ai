import { Ticket } from '@/interfaces/event';
import { CommonModule } from '@angular/common';
import { EventService } from '@/services/event.service';
import { IonIcon, IonReorder } from '@ionic/angular/standalone';
import { input, output, computed, DOCUMENT, Component, ChangeDetectionStrategy, inject } from '@angular/core';

@Component({
  selector: 'ticket-card',
  templateUrl: './ticket-card.html',
  styleUrl: './ticket-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonReorder, CommonModule, IonIcon]
})
export class TicketCard {
  ticket = input.required<Ticket>();
  eventDate = input<string | null>();
  eventStartTime = input<string | null>();
  private document = inject(DOCUMENT);
  private eventService = inject(EventService);

  edit = output<void>();
  delete = output<void>();

  ticketIcon = computed(() => {
    const ticketType = this.ticket().ticket_type;
    switch (ticketType) {
      case 'Early Bird':
        return 'assets/svg/ticket/early-bird-icon.svg';
      case 'Sponsor':
        return 'assets/svg/crown-white.svg';
      case 'Free':
        return 'assets/svg/ticket/free-ticket-icon.svg';
      default:
        return 'assets/svg/ticket/standard-ticket-icon.svg';
    }
  });

  ticketBackground = computed(() => {
    const ticketType = this.ticket().ticket_type;
    switch (ticketType) {
      case 'Early Bird':
        return 'bg-early-bird';
      case 'Sponsor':
        return 'bg-sponsor';
      case 'Free':
        return 'bg-free';
      default:
        return 'bg-standard';
    }
  });

  formattedPrice = computed(() => {
    const ticket = this.ticket();
    if (ticket.ticket_type === 'Free') {
      return 'FREE';
    }
    const price = typeof ticket?.price === 'number' ? ticket.price : parseFloat(String(ticket?.price || 0).replace('$', ''));
    return '$' + price.toFixed(2);
  });

  formattedQuantity = computed(() => {
    const quantity = this.ticket().quantity;
    return quantity ? quantity.toString() : 'Unlimited';
  });

  saleStartDisplay = computed(() => {
    const ticket = this.ticket();
    const dt = this.eventService.combineDateAndTimeToDate(ticket.sales_start_date, ticket.sale_start_time);
    if (!dt) return 'Not set';
    return `${this.eventService.formatDisplayDate(dt)}, ${this.eventService.formatDisplayTime(dt)}`;
  });

  saleEndDisplay = computed(() => {
    const ticket = this.ticket();
    if (ticket.end_at_event_start) {
      const dt = this.eventService.combineDateAndTimeToDate(this.eventDate(), this.eventStartTime());
      if (dt) return `${this.eventService.formatDisplayDate(dt)}, ${this.eventService.formatDisplayTime(dt)}`;
    } else {
      const dt = this.eventService.combineDateAndTimeToDate(ticket.sales_end_date, ticket.sale_end_time);
      if (dt) return `${this.eventService.formatDisplayDate(dt)}, ${this.eventService.formatDisplayTime(dt)}`;
    }
    return 'Not set';
  });

  description = computed(() => {
    const ticketDescription = this.ticket().description;
    const tempDiv = this.document.createElement('div');
    tempDiv.innerHTML = ticketDescription || '';
    return tempDiv.textContent || tempDiv.innerText || '';
  });

  onEdit(): void {
    this.edit.emit();
  }

  onDelete(): void {
    this.delete.emit();
  }
}
