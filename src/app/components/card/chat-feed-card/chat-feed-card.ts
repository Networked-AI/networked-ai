import { NgOptimizedImage } from '@angular/common';
import { ChatEventCard } from '../chat-event-card';
import { VideoJsPlayerComponent } from '@/components/common/video-js-player';
import { NavigationService } from '@/services/navigation.service';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { Component, computed, inject, input } from '@angular/core';

@Component({
  selector: 'app-chat-feed-card',
  imports: [NgOptimizedImage, ChatEventCard, VideoJsPlayerComponent],
  templateUrl: './chat-feed-card.html',
  styleUrl: './chat-feed-card.scss'
})
export class ChatFeedCard {
  feed = input<any>();
  navigationService = inject(NavigationService);

  firstMedia = computed(() => {
    const medias = this.feed()?.medias ?? [];

    return medias.find((m: any) => m.order === 1 || m.order === 0) ?? null;
  });

  onPostClick(): void {
    const feed = this.feed();
    if (!feed) return;
    this.navigationService.navigateForward(`/post/${feed.id}`);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: any): void {
    onImageError(event);
  }
}
