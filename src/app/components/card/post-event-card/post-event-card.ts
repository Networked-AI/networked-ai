import { CommonModule, NgOptimizedImage, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, computed, inject } from '@angular/core';
import { IEvent } from '@/interfaces/event';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { HapticService } from '@/services/haptic.service';
@Component({
  imports: [CommonModule, NgOptimizedImage, DatePipe],
  selector: 'post-event-card',
  styleUrl: './post-event-card.scss',
  templateUrl: './post-event-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostEventCard {
  hapticService = inject(HapticService);
  onRemove = output<any>();
  onAdd = output<any>();
  event = input<IEvent>();
  isModal = input<boolean>(false);

  eventDate = computed(() => {
    const evt = this.event();
    return evt?.start_date || null;
  });

  eventImage = computed(() => {
    const evt = this.event();
    return getImageUrlOrDefault(evt?.thumbnail_url || '');
  });

  onImageError(event: Event): void {
    onImageError(event);
  }
}
