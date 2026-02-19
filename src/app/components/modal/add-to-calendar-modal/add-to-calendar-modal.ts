import { DatePipe } from '@angular/common';
import { Browser } from '@capacitor/browser';
import { environment } from 'src/environments/environment';
import { Calendar } from '@awesome-cordova-plugins/calendar/ngx';
import { Component, Input, inject, OnInit, DOCUMENT } from '@angular/core';
import { IonHeader, IonToolbar, IonButton, IonIcon, ModalController, isPlatform } from '@ionic/angular/standalone';

import { Capacitor } from '@capacitor/core';
import { ToasterService } from '@/services/toaster.service';

@Component({
  selector: 'add-to-calendar-modal',
  standalone: true,
  providers: [Calendar],
  imports: [IonIcon, IonButton, IonToolbar, IonHeader],
  templateUrl: './add-to-calendar-modal.html',
  styleUrl: './add-to-calendar-modal.scss'
})
export class AddToCalendarModal implements OnInit {
  private modalCtrl = inject(ModalController);
  private calendar = inject(Calendar);
  private document = inject(DOCUMENT);
  private toasterService = inject(ToasterService);
  private datePipe = new DatePipe('en-US');
  isNative = isPlatform('capacitor') && isPlatform('ios');

  @Input() eventData: any;

  calendarLinks: any;

  ngOnInit() {
    this.calendarLinks = this.getCalendarLinks();
  }

  close(): void {
    this.modalCtrl.dismiss();
  }

  // 🔹 Google date formatter (CORRECT)
  formatGoogleDate(date: Date | string | number): string {
    return this.datePipe.transform(date, "yyyyMMdd'T'HHmmss") ?? '';
  }

  // 🔹 Build calendar links
  private getCalendarLinks() {
    if (!this.eventData?.start_date || !this.eventData?.end_date) return null;

    const start = this.formatGoogleDate(this.eventData.start_date);
    const end = this.formatGoogleDate(this.eventData.end_date);

    const title = encodeURIComponent(this.eventData.title || '');
    const description = encodeURIComponent(
      `${this.eventData.description || this.eventData.desc || ''}\n\n${environment.frontendUrl}/event/${this.eventData.slug}`
    );
    const location = encodeURIComponent(this.eventData.location || '');

    return {
      Google:
        `https://www.google.com/calendar/render?action=TEMPLATE` +
        `&text=${title}` +
        `&dates=${start}/${end}` +
        `&details=${description}` +
        `&location=${location}`
    };
  }

  async iosCreateEvent() {
    console.log(this.eventData);
    if (Capacitor.getPlatform() !== 'ios') return;

    try {
      const htmlToText = (html: string = ''): string => {
        const text = html
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{2,}/g, '\n')
          .trim();

        const textarea = this.document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
      };

      const title = this.eventData?.title || 'Untitled Event';
      const location = this.eventData?.location || this.eventData?.address || '';
      const notes = htmlToText(this.eventData?.description || this.eventData?.desc || '');

      const startDate = new Date(this.eventData?.start_date);
      const endDate = new Date(this.eventData?.end_date);

      const options = {
        id: this.eventData?.id
      };
      // 🔍 1. Find existing events for same time range
      const existingEvents = await this.calendar.findEventWithOptions('', '', '', startDate, endDate, options);

      // 🗑️ 2. Delete duplicates
      if (existingEvents?.length) {
        for (const event of existingEvents) {
          await this.calendar.deleteEvent(event.title, event.location, event.notes, new Date(event.startDate), new Date(event.endDate));
        }
      }

      // ➕ 3. Create fresh event
      await this.calendar.createEventWithOptions(title, location, notes, startDate, endDate, options);

      this.toasterService.showSuccess('Event added in Apple Calendar');
    } catch (err: any) {
      console.error('❌ Apple calendar event creation failed:', err);
      this.toasterService.showError(err?.message || 'Failed to add event');
    }
  }

  // 🔹 Button actions
  async addToGoogleCalendar() {
    if (!this.calendarLinks?.Google) return;

    await Browser.open({
      url: this.calendarLinks.Google
    });
  }
}
