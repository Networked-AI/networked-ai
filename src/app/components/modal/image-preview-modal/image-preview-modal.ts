import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { NgOptimizedImage } from '@angular/common';
import { Component, Input, inject, CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA, viewChild, AfterViewInit, ElementRef } from '@angular/core';
import { ModalController, IonicSlides } from '@ionic/angular/standalone';
import { Pagination, Zoom } from 'swiper/modules';

export type PreviewMediaType = 'Image' | 'Video';

export interface PreviewMediaItem {
  type: PreviewMediaType;
  url: string;
}

@Component({
  selector: 'image-preview-modal',
  styleUrl: './image-preview-modal.scss',
  templateUrl: './image-preview-modal.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
  imports: [NgOptimizedImage],

})
export class ImagePreviewModal implements AfterViewInit {
  @Input() mediaItems: PreviewMediaItem[] = [];
  @Input() initialIndex = 0;

  swiperModules = [IonicSlides, Pagination, Zoom];

  private modalCtrl = inject(ModalController);
  private swiperContainer =
    viewChild<ElementRef<HTMLDivElement & { swiper?: { slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void } }>>(
      'swiperContainer'
    );

  ngAfterViewInit(): void {
    const idx = Math.min(this.initialIndex, Math.max(0, this.mediaItems.length - 1));
    if (!this.mediaItems.length) return;
    const el = this.swiperContainer()?.nativeElement;
    const swiper = el?.swiper;
    if (swiper?.slideTo) {
      setTimeout(() => swiper.slideTo(idx, 0, false), 0);
    }
  }

  closeFullscreen() {
    this.modalCtrl.dismiss();
  }
  
  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: any): void {
    onImageError(event);
  }
}
