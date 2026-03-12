import { Share } from '@capacitor/share';
import { QrCodeComponent } from 'ng-qrcode';
import { Capacitor } from '@capacitor/core';
import * as htmlToImage from 'html-to-image';
import { ActivatedRoute } from '@angular/router';
import { Button } from '@/components/form/button';
import { getImageUrlOrDefault } from '@/utils/helper';
import { AuthService } from '@/services/auth.service';
import { CommonModule, DatePipe } from '@angular/common';
import { environment } from 'src/environments/environment';
import { ToasterService } from '@/services/toaster.service';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { IonHeader, IonToolbar, IonContent, IonSkeletonText, ModalController } from '@ionic/angular/standalone';
import { Component, inject, ChangeDetectionStrategy, signal, computed, ViewChild, ElementRef, Input, DOCUMENT } from '@angular/core';

@Component({
  selector: 'event-qr',
  styleUrl: './event-qr.scss',
  templateUrl: './event-qr.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonSkeletonText, IonContent, IonToolbar, IonHeader, Button, CommonModule, QrCodeComponent]
})
export class EventQr {
  @ViewChild('downloadableSection', { static: false, read: ElementRef }) downloadableSection?: ElementRef<HTMLDivElement>;
  modalCtrl = inject(ModalController);
  route = inject(ActivatedRoute);
  authService = inject(AuthService);
  toasterService = inject(ToasterService);
  private readonly document = inject(DOCUMENT);

  datePipe = new DatePipe('en-US');
  @Input() event: any;
  eventId = signal<string>('');
  isDownloading = signal(false);
  isLoading = signal<boolean>(true);

  host = computed(() => {
    const event = this.event;
    const hostName = event?.participants?.find((p: any) => (p.role || '').toLowerCase() === 'host')?.user;
    return hostName || 'Get Networked';
  });

  formattedEventDate = computed(() => {
    const start = this.event?.start_date;
    if (!start) return '';

    const date = new Date(start);

    return this.datePipe.transform(date, 'EEEE, MMM d');
  });

  formattedEventTime = computed(() => {
    const start = this.event?.start_date;
    const end = this.event?.end_date;
    if (!start || !end) return '';

    const startTime = this.datePipe.transform(start, 'h:mm a') || '';

    const endTime = this.datePipe.transform(end, 'h:mm a') || '';

    return `${startTime} to ${endTime}`;
  });

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

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

  back() {
    this.modalCtrl.dismiss();
  }

  async shareQR(): Promise<void> {
    const link = this.eventLink();
    if (!link) {
      this.toasterService.showError('Profile link not available');
      return;
    }

    try {
      await Share.share({
        title: this.event?.title || 'Event',
        text: link
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  async downloadQR(): Promise<void> {
    const element = this.downloadableSection?.nativeElement;
    if (!element) {
      return;
    }

    this.isDownloading.set(true);

    try {
      const dataUrl = await htmlToImage.toPng(element, {
        cacheBust: true,
        skipFonts: true
      });

      const slug = this.event?.slug || 'event';
      const sanitizedSlug = this.sanitizeFileName(slug);
      const fileName = `${sanitizedSlug}-${Date.now()}.png`;

      // WEB
      if (Capacitor.getPlatform() === 'web') {
        const link = this.document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
        return;
      }

      // MOBILE (Android / iOS)
      const base64Data = dataUrl.split(',')[1];

      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Documents
      });

      // iOS → Share sheet
      if (Capacitor.getPlatform() === 'ios') {
        await Share.share({
          title: 'Download Profile',
          url: savedFile.uri
        });
      } else {
        // Android → Show success message
        this.toasterService.showSuccess('Profile saved successfully!');
      }
    } catch (err) {
      console.error('Profile download failed', err);
    } finally {
      this.isDownloading.set(false);
    }
  }

  eventLink = computed(() => {
    const event = this.event;
    if (!event?.slug) return '';
    const frontendUrl = environment.frontendUrl;
    return `${frontendUrl}/event/${event.slug}`;
  });
}
