import { FormsModule } from '@angular/forms';
import { Button } from '@/components/form/button';
import { CheckboxModule } from 'primeng/checkbox';
import { FeedService } from '@/services/feed.service';
import { ModalService } from '@/services/modal.service';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { EventService } from '@/services/event.service';
import { HapticService } from '@/services/haptic.service';
import { Searchbar } from '@/components/common/searchbar';
import { ToasterService } from '@/services/toaster.service';
import { ModalController } from '@ionic/angular/standalone';
import { EmptyState } from '@/components/common/empty-state';
import { IonHeader, IonFooter, IonToolbar, IonContent } from '@ionic/angular/standalone';
import { Input, Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { BaseApiService } from '@/services/base-api.service';

export interface ICsvGuestItem {
  name: string;
  email: string;
  phone: string;
}

@Component({
  selector: 'csv-data-modal',
  styleUrl: './csv-data-modal.scss',
  templateUrl: './csv-data-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, IonHeader, IonToolbar, IonContent, IonFooter, Searchbar, EmptyState, FormsModule, CheckboxModule, ScrollingModule]
})
export class CsvDataModal {
  @Input() id: string = '';
  @Input() contentLink: string = '';
  @Input() guests: ICsvGuestItem[] = [];
  @Input() type: 'Event' | 'Post' | 'Plan' = 'Event';

  feedService = inject(FeedService);
  eventService = inject(EventService);
  modalCtrl = inject(ModalController);
  modalService = inject(ModalService);
  hapticService = inject(HapticService);
  toasterService = inject(ToasterService);

  searchQuery = signal('');
  allGuests = signal<ICsvGuestItem[]>([]);
  selectedGuests = signal<Set<number>>(new Set<number>());
  isSubmitting = signal<'sms' | 'email' | 'both' | null>(null);

  selectedCount = computed(() => this.getSelectedGuestList().length);

  allSelected = computed(() => {
    const guests = this.allGuests();
    const selected = this.selectedGuests();
    return guests.length > 0 && selected.size === guests.length;
  });

  filteredGuests = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) return this.allGuests();
    return this.allGuests().filter(
      (g) => g.name?.toLowerCase().includes(query) || g.email?.toLowerCase().includes(query) || g.phone?.toLowerCase().includes(query)
    );
  });

  ngOnInit(): void {
    const initial = Array.isArray(this.guests) ? this.guests : [];
    this.allGuests.set(initial);
  }

  toggleGuest(index: number): void {
    const current = new Set(this.selectedGuests());
    current.has(index) ? current.delete(index) : current.add(index);
    this.selectedGuests.set(current);
  }

  toggleSelectAll(): void {
    this.selectedGuests.set(this.allSelected() ? new Set() : new Set(this.allGuests().map((_, i) => i)));
  }

  isSelected(index: number): boolean {
    return this.selectedGuests().has(index);
  }

  async close(): Promise<void> {
    await this.modalCtrl.dismiss();
    await this.modalService.close();
  }

  getSelectedGuestList(): ICsvGuestItem[] {
    const selected = this.selectedGuests();
    return this.allGuests().filter((_, i) => selected.has(i));
  }

  ensureSelection(): ICsvGuestItem[] | null {
    const selected = this.getSelectedGuestList();
    if (!selected.length) {
      this.toasterService.showError('Please select at least one contact.');
      return null;
    }
    return selected;
  }

  async onSend(type: 'sms' | 'email' | 'both'): Promise<void> {
    const selected = this.ensureSelection();
    if (!selected || this.isSubmitting()) return;

    try {
      this.isSubmitting.set(type);
      await this.shareCsvBroadcast(type, selected);
    } finally {
      this.isSubmitting.set(null);
    }
  }

  buildRecipients(guests: ICsvGuestItem[]) {
    return guests.map(({ email, phone }) => ({
      email: email?.trim() || null,
      phone: phone?.trim() || null
    }));
  }

  async shareCsvBroadcast(type: 'sms' | 'email' | 'both', guests: ICsvGuestItem[]) {
    const recipients = this.buildRecipients(guests);

    try {
      const payload = { type, recipients };

      if (this.type === 'Event') {
        await this.eventService.shareEventCsvBroadcast({
          ...payload,
          event_id: this.id
        });
      } else if (this.type === 'Post') {
        await this.feedService.shareFeedCsvBroadcast({
          ...payload,
          feed_id: this.id
        });
      }

      const messageMap = {
        sms: 'SMS broadcast sent successfully.',
        email: 'Email broadcast sent successfully.',
        both: 'Email & SMS broadcast sent successfully.'
      };

      this.toasterService.showSuccess(messageMap[type]);
      this.close();
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to send broadcast.');
      this.toasterService.showError(message);
    }
  }
}
