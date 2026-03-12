import { DatePipe, isPlatformBrowser } from '@angular/common';
import { QrCodeComponent } from 'ng-qrcode';
import { Browser } from '@capacitor/browser';
import { CommonModule } from '@angular/common';
import { SwiperContainer } from 'swiper/element';
import { Button } from '@/components/form/button';
import { EventAttendee } from '@/interfaces/event';
import { getImageUrlOrDefault } from '@/utils/helper';
import { AuthService } from '@/services/auth.service';
import { SocketService } from '@/services/socket.service';
import { Component, Input, ElementRef, computed, inject, signal, PLATFORM_ID, CUSTOM_ELEMENTS_SCHEMA, viewChild } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, ModalController, IonIcon, IonicSlides } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tickets-modal',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonIcon, IonToolbar, IonHeader, IonContent, Button, QrCodeComponent, CommonModule],
  templateUrl: './tickets-modal.html',
  styleUrl: './tickets-modal.scss'
})
export class TicketsModal {
  ticketsSwiperEl = viewChild<ElementRef<SwiperContainer>>('ticketsSwiper');

  // services
  modalCtrl = inject(ModalController);
  authService = inject(AuthService);

  // platform
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  datePipe = new DatePipe('en-US');
  private socketService = inject(SocketService);
  event = signal<any>(null);
  @Input()
  set eventData(value: any) {
    this.event.set(value);
  }

  // variables
  swiperModules = [IonicSlides];
  activeIndex = signal(0);

  host = computed(() => {
    const event = this.event();
    const hostName = event?.participants?.find((p: any) => (p.role || '').toLowerCase() === 'host')?.user;
    return hostName || 'Get Networked';
  });

  userTickets = computed(() => {
    const attendees = this.event()?.attendees || [];
    return attendees.filter((a: any) => a.user_id === this.authService.currentUser()?.id);
  });

  formattedEventDate = computed(() => {
    const start = this.event()?.start_date;
    if (!start) return '';

    const date = new Date(start);

    return this.datePipe.transform(date, 'EEEE, MMM d');
  });

  formattedEventTime = computed(() => {
    const start = this.event()?.start_date;
    const end = this.event()?.end_date;
    if (!start || !end) return '';

    const startTime = this.datePipe.transform(start, 'h:mm a') || '';

    const endTime = this.datePipe.transform(end, 'h:mm a') || '';

    return `${startTime} to ${endTime}`;
  });

  progressBarColor = computed(() => {
    const score = this.authService.currentUser()?.total_gamification_points || 0;

    if (score >= 50000) {
      return 'border-[#9ca3af]'; // Silver
    } else if (score >= 30000) {
      return 'border-[#F5BC61]'; // Gold
    } else if (score >= 20000) {
      return 'border-[#a855f7]'; // Purple
    } else if (score >= 10000) {
      return 'border-[#9DEAFB]'; // Cyan
    } else if (score >= 5000) {
      return 'border-[#ef4444]'; // Red
    } else if (score >= 1000) {
      return 'border-[#52D193]'; // Green
    } else {
      return 'border-[#000]';
    }
  });

  ngOnInit(): void {
    this.setupCheckInStatusListner();
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  contactHost() {
    const email = this.host()?.email;

    if (!email) {
      console.warn('Host email not found');
      return;
    }

    const subject = encodeURIComponent(`Regarding ${this.event()?.title}`);
    const body = encodeURIComponent(`Hello ${this.host()?.name},\n\nI have a question regarding the event.\n\nThanks,`);

    const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;

    if (this.isBrowser) window.open(mailtoUrl, '_self');
  }

  async addToWallet() {
    await Browser.open({
      url: this.userTickets()[this.activeIndex()].apple_wallet_pass_url,
      toolbarColor: '#dedede',
      presentationStyle: 'popover',
      windowName: '_self'
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  onSlideChange(event: Event) {
    const { activeIndex } = (event.target as SwiperContainer).swiper;
    this.activeIndex.set(activeIndex);
  }

  slidePrev() {
    this.ticketsSwiperEl()?.nativeElement?.swiper?.slidePrev(300);
  }

  slideNext() {
    this.ticketsSwiperEl()?.nativeElement?.swiper?.slideNext(300);
  }

  private setupCheckInStatusListner(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('attendee:check-in:update', this.checkInStatusHandler);
    });
  }

  private checkInStatusHandler = (attendee: EventAttendee) => {
    const currentEvent = this.event();
    if (!currentEvent) return;

    this.event.set({
      ...currentEvent,
      attendees: currentEvent.attendees?.map((a: any) => (a.id === attendee.id ? { ...a, ...attendee } : a))
    });
  };

  ngOnDestroy(): void {
    this.socketService.off('attendee:check-in:update', this.checkInStatusHandler);
  }
}
