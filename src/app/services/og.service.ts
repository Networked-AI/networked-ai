import { IEvent } from '@/interfaces/event';
import { DOCUMENT } from '@angular/common';
import { FeedPost } from '@/interfaces/IFeed';
import { EventService } from './event.service';
import { getImageUrlOrDefault } from '@/utils/helper';
import { Meta, Title } from '@angular/platform-browser';
import { Injectable, Inject, inject } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface OgConfig {
  title: string;
  description: string;
  image: string;
  url?: string;
  type?: 'website' | 'article' | 'profile' | 'event';
}
@Injectable({ providedIn: 'root' })
export class OgService {
  private meta = inject(Meta);
  private title = inject(Title);
  private eventService = inject(EventService);
  @Inject(DOCUMENT) private document = inject(DOCUMENT);

  setOgTags(config: OgConfig) {
    const url = config.url || this.document.location.href;
    // Open Graph (force replace)
    this.meta.updateTag({ property: 'og:title', content: config.title });
    this.meta.updateTag({ property: 'og:description', content: config.description });
    this.meta.updateTag({ property: 'og:image', content: config.image });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: config.type || 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Networked AI' });
  }

  setOgTagInEvent(eventData: IEvent) {
    this.setOgTags({
      title: eventData.title || '',
      description: this.eventService.sanitizeOgDescription(eventData.description || ''),
      image: this.getImageUrl(eventData.thumbnail_url),
      url: `${environment.frontendUrl}/event/${eventData.slug}`,
      type: 'event'
    });
  }

  setOgTagInPost(postData: FeedPost) {
    const medias = postData?.medias;
    const sortMedias = [...(medias || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.setOgTags({
      title: `Post by ${postData?.user?.name || postData?.user?.username}` || '',
      image: this.getImageUrl(sortMedias?.[0]?.media_url),
      url: `${environment.frontendUrl}/post/${postData?.id}`,
      type: 'article',
      description: postData?.content || ''
    });
  }

  setOgTagInProfile(user: any) {
    const parts: string[] = [];

    if ((user.total_networks ?? 0) > 0) {
      parts.push(`${user.total_networks} Connections`);
    }

    const events = (user?.total_events_hosted || 0) + (user?.total_events_cohosted || 0) + (user?.total_events_sponsored || 0);
    if (events > 0) {
      parts.push(`${events} Events`);
    }

    if ((user.total_events_attended ?? 0) > 0) {
      parts.push(`${user.total_events_attended} Attended`);
    }

    // Final description
    const description = [parts.join(', '), `View events and posts by ${user.name}`].filter(Boolean).join(' - ').slice(0, 120);

    this.setOgTags({
      title: user.name,
      description: description,
      image: this.getImageUrl(user.thumbnail_url),
      url: `${environment.frontendUrl}/${user.username}`,
      type: 'profile'
    });
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }
}
