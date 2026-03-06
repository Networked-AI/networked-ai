import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { Button } from '@/components/form/button';
import { Searchbar } from '@/components/common/searchbar';
import { ToasterService } from '@/services/toaster.service';
import { ModalController } from '@ionic/angular/standalone';
import { EmptyState } from '@/components/common/empty-state';
import { isPlatformBrowser } from '@angular/common';
import { Input, Component, ChangeDetectionStrategy, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { IonHeader, IonFooter, IonToolbar, IonContent } from '@ionic/angular/standalone';
import { ModalService } from '@/services/modal.service';

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
  imports: [Button, IonHeader, IonToolbar, IonContent, IonFooter, Searchbar, EmptyState, FormsModule, CheckboxModule]
})
export class CsvDataModal {
  @Input() guests: ICsvGuestItem[] = [];
  @Input() id: string = '';
  @Input() type: 'Event' | 'Post' | 'Plan' = 'Event';
  @Input() contentLink: string = '';

  private toasterService = inject(ToasterService);
  private modalCtrl = inject(ModalController);
  private platformId = inject(PLATFORM_ID);
  private modalService = inject(ModalService);
  private isBrowser = isPlatformBrowser(this.platformId);

  isSubmitting = signal<'sms' | 'email' | 'both' | null>(null);
  allGuests = signal<ICsvGuestItem[]>([]);
  selectedGuests = signal<Set<number>>(new Set<number>());
  searchQuery = signal('');

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

  onSearchChange(value: string) {
    this.searchQuery.set(value);
  }
  onSearchClear() {
    this.searchQuery.set('');
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

  private getSelectedGuestList(): ICsvGuestItem[] {
    const guests = this.allGuests();
    const selected = this.selectedGuests();
    return guests.filter((_, i) => selected.has(i));
  }

  private ensureSelection(): ICsvGuestItem[] | null {
    const selected = this.getSelectedGuestList();
    if (!selected.length) {
      this.toasterService.showError('Please select at least one contact.');
      return null;
    }
    return selected;
  }

  private sendSms(guests: ICsvGuestItem[]): void {
    const phones = guests.map((g) => g.phone?.trim()).filter((p): p is string => !!p);
    if (!phones.length) {
      this.toasterService.showError('No phone numbers found for the selected contacts.');
      return;
    }
  }

  private sendEmail(guests: ICsvGuestItem[]): void {
    const emails = guests.map((g) => g.email?.trim()).filter((e): e is string => !!e);
    if (!emails.length) {
      this.toasterService.showError('No email addresses found for the selected contacts.');
      return;
    }
  }

  async onSendSms(): Promise<void> {
    const selected = this.ensureSelection();
    if (!selected || this.isSubmitting()) return;
    try {
      this.isSubmitting.set('sms');
      this.sendSms(selected);
      this.close();
    } finally {
      this.isSubmitting.set(null);
    }
  }

  async onSendEmail(): Promise<void> {
    const selected = this.ensureSelection();
    if (!selected || this.isSubmitting()) return;
    try {
      this.isSubmitting.set('email');
      this.sendEmail(selected);
      this.close();
    } finally {
      this.isSubmitting.set(null);
    }
  }

  async onSendEmailAndSms(): Promise<void> {
    const selected = this.ensureSelection();
    if (!selected || this.isSubmitting()) return;
    try {
      this.isSubmitting.set('both');
      this.sendSms(selected);
      this.sendEmail(selected);
      this.close();
    } finally {
      this.isSubmitting.set(null);
    }
  }
}
