import { Component, inject, signal, computed, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { UserService } from 'src/app/services/user.service';
import { PaymentTransactionItem } from './components/payment-transaction-item';
import {
  NavController,
  IonHeader,
  IonToolbar,
  IonContent,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonSpinner
} from '@ionic/angular/standalone';

export interface PaymentTransaction {
  id: string;
  eventName: string;
  amount: number;
  isPayout: boolean;
  date: Date;
  icon?: string;
}

@Component({
  selector: 'payment-history',
  templateUrl: './payment-history.html',
  styleUrl: './payment-history.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonSpinner,
    IonRefresherContent,
    IonRefresher,
    DatePipe,
    IonHeader,
    IonToolbar,
    IonContent,
    CommonModule,
    IonInfiniteScroll,
    PaymentTransactionItem,
    IonInfiniteScrollContent
  ]
})
export class PaymentHistory implements OnInit {
  private navCtrl = inject(NavController);
  private userService = inject(UserService);
  private datePipe = new DatePipe('en-US');

  isDownloading = signal(false);
  isLoading = signal(false);

  transactions = signal<any[]>([]);

  private page = 1;
  private limit = 20;
  hasMore = signal(true);

  ngOnInit(): void {
    this.loadPaymentHistory();
  }

  async loadPaymentHistory(event?: CustomEvent): Promise<void> {
    if (this.isLoading() || !this.hasMore()) {
      (event?.target as HTMLIonInfiniteScrollElement)?.complete();
      return;
    }

    try {
      this.isLoading.set(true);

      const response = await this.userService.paymentHistory(this.page, this.limit);
      const newTransactions = response?.data ?? [];

      this.transactions.update((prev) => [...prev, ...newTransactions]);

      if (newTransactions.length < this.limit) {
        this.hasMore.set(false);
      } else {
        this.page++;
      }
    } catch (error) {
      console.error('Error loading payment history', error);
    } finally {
      this.isLoading.set(false);
      (event?.target as HTMLIonInfiniteScrollElement)?.complete();
    }
  }

  async onRefresh(event: CustomEvent) {
    try {
      this.page = 1;
      this.hasMore.set(true);
      this.transactions.set([]);

      await this.loadPaymentHistory();
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
    }
  }

  groupedTransactions = computed(() => {
    const transactions = this.transactions();

    const groups = new Map<string, any[]>();

    transactions.forEach((tx) => {
      const dateKey = this.datePipe.transform(tx.created_at, 'yyyy-MM-dd') ?? '';

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }

      groups.get(dateKey)!.push(tx);
    });

    return Array.from(groups.entries()).map(([dateKey, transactions]) => ({
      dateKey,
      date: dateKey,
      transactions
    }));
  });

  hasTransactions = computed(() => this.transactions().length > 0);

  back(): void {
    this.navCtrl.back();
  }
}
