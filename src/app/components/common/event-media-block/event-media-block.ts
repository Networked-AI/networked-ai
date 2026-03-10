import { Component, input, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { IonicSlides } from '@ionic/angular/standalone';
import { Pagination } from 'swiper/modules';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';

export type EventMediaBlockMode = 'primary' | 'swiper';

export interface DisplayMediaItem {
  id?: string;
  type?: string;
  url?: string;
}

@Component({
  selector: 'app-event-media-block',
  styleUrl: './event-media-block.scss',
  templateUrl: './event-media-block.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
  imports: [NgOptimizedImage]
})
export class EventMediaBlockComponent {
  /** 'primary' = single image (blur + main); 'swiper' = carousel of displayMedias */
  mode = input<EventMediaBlockMode>('primary');
  /** For primary mode */
  imageUrl = input<string>('');
  thumbnailUrl = input<string>('');
  /** For both modes */
  title = input<string>('Event image');
  /** For swiper mode */
  displayMedias = input<DisplayMediaItem[]>([]);
  /** Optional countdown HTML string (e.g. from formatTimerDisplay) */
  countdownFormatted = input<string | null>(null);
  /** Compact layout for modal right column */
  compact = input(false);
  /** Swiper modules for carousel */
  swiperModules = [IonicSlides, Pagination];

  getImageUrl(url = ''): string {
    return getImageUrlOrDefault(url);
  }

  onImageError = onImageError;
}
