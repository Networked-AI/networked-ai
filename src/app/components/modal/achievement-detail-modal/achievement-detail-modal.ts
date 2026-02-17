import { CommonModule, DatePipe } from '@angular/common';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { GamificationBadge } from '@/interfaces/IGamification';
import { IonFooter, IonIcon, IonToolbar } from '@ionic/angular/standalone';
import { ChangeDetectionStrategy, Component, inject, Input, computed } from '@angular/core';

@Component({
  selector: 'achievement-detail-modal',
  styleUrl: './achievement-detail-modal.scss',
  templateUrl: './achievement-detail-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, IonToolbar, IonFooter, Button, IonIcon]
})
export class AchievementDetailModal {
  private modalService = inject(ModalService);

  @Input() achievement: GamificationBadge | null = null;
  @Input() categoryKey: string | null = null;

  categoryDisplayNames: Record<string, string> = {
    total_events_attended: 'Events Attended',
    total_events_hosted: 'Events Hosted',
    total_networks: 'Networks',
    total_messages_sent: 'Messages',
    total_qr_codes_scanned: 'QR Scans'
  };

  badgeImageUrl = computed(() => {
    const badge = this.achievement;
    if (!badge) return '';
    return badge.url || '';
  });

  categoryDisplayName = computed(() => {
    if (!this.categoryKey) return '';
    return this.categoryDisplayNames[this.categoryKey] || '';
  });

  description = computed(() => {
    const badge = this.achievement;
    const categoryKey = this.categoryKey;

    if (!badge || !categoryKey) return '';
    if (badge.is_locked) return 'Locked';

    const eventCount = badge.event_count;

    // Generate description based on category
    switch (categoryKey) {
      case 'total_events_attended':
        return `Earned this achievement by attending an event ${eventCount} times!`;
      case 'total_events_hosted':
        return `Earned this achievement by hosting an event ${eventCount} times!`;
      case 'total_networks':
        return `Earned this achievement by connecting with ${eventCount} peoples!`;
      case 'total_messages_sent':
        return `Earned this achievement by sending messages ${eventCount} times!`;
      case 'total_qr_codes_scanned':
        return `Earned this achievement by scanning an QR ${eventCount} times!`;
      default:
        return '';
    }
  });

  close() {
    this.modalService.close(null, 'close');
  }
}
