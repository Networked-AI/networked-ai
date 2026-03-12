import { IEvent } from '@/interfaces/event';
import { DOCUMENT } from '@angular/common';
import { FeedPost } from '@/interfaces/IFeed';
import { ChatRoom } from '@/interfaces/IChat';
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
    this.meta.updateTag({ property: 'og:site_name', content: 'Get Networked' });
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

  // OG tags for group invitation share link
  setOgTagInGroupInvitation(room: ChatRoom) {
    const name = room.name || 'Group';
    const users = room.users ?? [];
    const count = users.length;
    const memberPart =
      count === 0
        ? 'Join this group on Get Networked.'
        : count === 1
          ? `${users[0]?.name || 'Someone'} is a member. Join now!`
          : count === 2
            ? `${users[0]?.name || ''}, ${users[1]?.name || ''} and others are members. Join now!`
            : `${users[0]?.name || ''}, ${users[1]?.name || ''} and ${count - 2} others are members. Join now!`;
    const description = memberPart.slice(0, 200);

    const groupImage = room.event_id ? room.event?.thumbnail_url : room.profile_image;

    this.setOgTags({
      title: `Group Invitation: ${name}`,
      description,
      image: this.getImageUrl(groupImage || ''),
      url: `${environment.frontendUrl}/group-invitation/${room.id}`,
      type: 'website'
    });
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }
}
