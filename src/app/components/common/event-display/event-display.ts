import {
  inject,
  input,
  computed,
  OnDestroy,
  viewChild,
  Component,
  ElementRef,
  PLATFORM_ID,
  AfterViewInit,
  AfterViewChecked,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Pagination } from 'swiper/modules';
import { Browser } from '@capacitor/browser';
import { Button } from '@/components/form/button';
import { EventDisplayData } from '@/interfaces/event';
import { ModalService } from '@/services/modal.service';
import { DomSanitizer } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import { IonIcon, IonicSlides } from '@ionic/angular/standalone';
import { NavigationService } from '@/services/navigation.service';
import { SegmentButton } from '@/components/common/segment-button';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { AvatarGroupComponent } from '@/components/common/avatar-group';
import { HostEventPromoCard } from '@/components/card/host-event-promo-card';
import { VideoJsPlayerComponent } from '../video-js-player';
@Component({
  selector: 'event-display',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  styleUrl: './event-display.scss',
  templateUrl: './event-display.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentButton, AvatarGroupComponent, HostEventPromoCard, IonIcon, Button, NgOptimizedImage, VideoJsPlayerComponent]
})
export class EventDisplay implements AfterViewInit, AfterViewChecked, OnDestroy {
  eventData = input.required<Partial<EventDisplayData>>();
  showPreviewBanner = input(false);
  showHostPromo = input(false);
  onDateChange = input<(date: string) => void>();
  onUserListClick = input<(title: string, eventTitle: string) => void>();
  selectedDate = input<string>('');
  onManageEventClick = input<() => void>();
  onEventChatClick = input<() => void>();
  showActionButtons = input(false);
  hideDateSelector = input(false);

  // variables
  private platformId = inject(PLATFORM_ID);
  swiperModules = [IonicSlides, Pagination];
  private isBrowser = isPlatformBrowser(this.platformId);

  private sanitizer = inject(DomSanitizer);
  private modalService = inject(ModalService);
  private navigationService = inject(NavigationService);
  mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  // MapTiler (lazy loaded)
  private Maptiler!: typeof import('@maptiler/sdk');

  private map: import('@maptiler/sdk').Map | null = null;
  private marker: import('@maptiler/sdk').Marker | null = null;
  private readonly DEFAULT_ZOOM = 14;

  description = computed(() => {
    const description = this.eventData().description;
    return description ? this.sanitizer.bypassSecurityTrustHtml(description) : '';
  });

  dateItemsForDisplay = computed(() => {
    return this.eventData().dateItems || [];
  });

  displayMediasForDisplay = computed(() => {
    const medias = this.eventData().displayMedias || [];
    return medias.slice(1);
  });

  hasMultipleMedias = computed(() => {
    return this.displayMediasForDisplay().length > 1;
  });

  async openMapFromLatLng(mapCenter: number[]): Promise<void> {
    if (!this.showHostPromo()) return;
    if (!mapCenter || mapCenter.length !== 2) return;

    const confirmed = await this.modalService.openConfirmModal({
      icon: 'assets/svg/alert-white.svg',
      title: 'Leave App?',
      description: 'You will be redirected outside the app to open map. Continue?',
      confirmButtonLabel: 'Open',
      cancelButtonLabel: 'Stay',
      confirmButtonColor: 'primary',
      iconBgColor: '#F5BC61',
      iconPosition: 'left'
    });

    if (!confirmed?.data) return;

    const [lng, lat] = mapCenter;
    const platform = Capacitor.getPlatform();

    let url = '';

    if (platform === 'ios') {
      url = `https://maps.apple.com/?daddr=${lat},${lng}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }

    await Browser.open({ url });
  }

  hasMultipleTickets = computed(() => {
    const tickets = this.eventData().tickets || [];
    return tickets.length > 1;
  });

  canViewAttendees = computed(() => {
    const d = this.eventData();
    return !!(d?.isCurrentUserHost || d?.isCurrentUserAttendee || d?.isCurrentUserCoHost);
  });

  hostUsername = computed(() => {
    const participants = (this.eventData() as any)?.participants;
    if (!Array.isArray(participants)) return null;
    const host = participants.find((p: any) => p?.role === 'Host');
    return host?.user?.username ?? null;
  });

  onHostClick(): void {
    const username = this.hostUsername();
    if (username) this.navigationService.navigateForward(`/${username}`);
  }

  handleDateChange(date: string): void {
    const handler = this.onDateChange();
    if (handler) {
      handler(date);
    }
  }

  handleUserListClick(title: string): void {
    if ((title == 'Going' || title == 'Maybe') && !this.canViewAttendees()) return;
    const handler = this.onUserListClick();
    if (handler) {
      handler(title, this.eventData()?.title || '');
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.initMap();
    }
  }

  ngAfterViewChecked(): void {
    if (this.isBrowser) {
      const mapCenter = this.eventData().mapCenter;
      if (mapCenter && this.mapContainer() && !this.map) {
        this.initMap();
      } else if (mapCenter && this.map && this.marker) {
        try {
          const currentCenter = this.map.getCenter();
          if (Math.abs(currentCenter.lng - mapCenter[0]) > 0.0001 || Math.abs(currentCenter.lat - mapCenter[1]) > 0.0001) {
            this.map.setCenter(mapCenter);
            this.marker.setLngLat(mapCenter);
          }
        } catch (e) {
          console.warn('Map not ready for update', e);
        }
      }
    }
  }

  private async initMap(): Promise<void> {
    const mapCenter = this.eventData().mapCenter;
    if (!mapCenter || !this.mapContainer() || this.map) return;

    // SSR-safe lazy import
    this.Maptiler = await import('@maptiler/sdk');

    this.Maptiler.config.apiKey = environment.maptilerApiKey;

    const map = new this.Maptiler.Map({
      container: this.mapContainer()!.nativeElement,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${environment.maptilerApiKey}`, // Use newer style URL with API key to avoid deprecation
      center: mapCenter,
      zoom: this.DEFAULT_ZOOM
    });

    map.on('styleimagemissing', (e: any) => {
      if (e && e.id && !map.hasImage(e.id)) {
        const transparentPixel = {
          width: 1,
          height: 1,
          data: new Uint8Array([0, 0, 0, 0])
        };
        map.addImage(e.id, transparentPixel);
      }
    });

    map.on('load', () => {
      map.resize();
      if (!this.marker) {
        this.marker = new this.Maptiler.Marker({ color: '#D33' }).setLngLat(mapCenter).addTo(map);
      }
    });

    this.map = map;
  }

  ngOnDestroy(): void {
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  async handleAdmissionClick(): Promise<void> {
    if (this.hasMultipleTickets()) {
      const tickets = this.eventData().tickets || [];
      await this.modalService.openTicketsListModal(tickets);
    }
  }

  async handleCalendarClick(): Promise<void> {
    if (this.eventData().isCurrentUserHost || this.eventData().isCurrentUserAttendee || this.eventData().isCurrentUserCoHost)
      await this.modalService.openAddToCalendarModal(this.eventData());
  }
}
