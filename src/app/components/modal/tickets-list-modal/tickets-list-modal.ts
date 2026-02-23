import { Ticket } from '@/interfaces/event';
import { ModalController } from '@ionic/angular/standalone';
import { IonHeader, IonToolbar, IonContent } from '@ionic/angular/standalone';
import { Component, inject, ChangeDetectionStrategy, Input } from '@angular/core';
import { PlanData } from '@/interfaces/ISubscripton';
import { SubscriptionCard, ISubscription } from '@/components/card/subscription-card';
import { TicketCard } from '@/components/card/ticket-card';

@Component({
  selector: 'tickets-list-modal',
  imports: [IonHeader, IonToolbar, IonContent, SubscriptionCard, TicketCard],
  styleUrl: './tickets-list-modal.scss',
  templateUrl: './tickets-list-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketsListModal {
  private modalCtrl = inject(ModalController);

  @Input() tickets: Ticket[] = [];
  @Input() plans: PlanData[] | null = [];

  /** Map PlanData to ISubscription for subscription-card */
  toSubscriptionData(plan: PlanData): ISubscription {
    const prices = plan.prices ?? [];
    const monthly = prices.find((p: any) => p.interval === 'month' && p.active);
    const yearly = prices.find((p: any) => p.interval === 'year' && p.active);
    const parts: string[] = [];
    if (monthly) parts.push(`$${Number(monthly.amount).toFixed(0)}/m`);
    if (yearly) parts.push(`$${Number(yearly.amount).toFixed(0)}/y`);
    const priceRange = parts.length ? parts.join(' / ') : '—';
    return {
      id: plan.id,
      type: plan.is_sponsor ? 'sponsor' : 'event',
      name: plan.name,
      subscribers: plan.total_subscribers ?? 0,
      priceRange
    };
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}
