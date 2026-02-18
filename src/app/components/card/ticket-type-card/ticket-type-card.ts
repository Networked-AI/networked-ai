import { HapticService } from '@/services/haptic.service';
import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, input, output, inject } from '@angular/core';

@Component({
  selector: 'ticket-type-card',
  styleUrl: './ticket-type-card.scss',
  templateUrl: './ticket-type-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class TicketTypeCard {
  icon = input.required<string>();
  label = input.required<string>();
  description = input.required<string>();

  click = output<void>();

  hapticService = inject(HapticService);

  onClick(event: Event): void {
    event.stopPropagation();
    this.hapticService.onClick();
    this.click.emit();
  }
}
