import { Pagination } from 'swiper/modules';
import { NgOptimizedImage } from '@angular/common';
import { IonicSlides } from '@ionic/angular/standalone';
import { ModalService } from '@/services/modal.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { Component, input, ChangeDetectionStrategy, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA, inject } from '@angular/core';

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
  private modalService = inject(ModalService);

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

  openFullscreen(index: number) {
    if (this.mode() === 'primary') {
      const url = this.imageUrl() || this.thumbnailUrl();
      if (url) {
        this.modalService.openImagePreviewModal(this.getImageUrl(url));
      }
      return;
    }

    const medias = this.displayMedias() || [];
    const media = medias[index];

    if (media && media.type === 'Image' && media.url) {
      this.modalService.openImagePreviewModal(this.getImageUrl(media.url));
    }
  }
}
