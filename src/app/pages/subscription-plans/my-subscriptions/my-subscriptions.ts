import { ToasterService } from '@/services/toaster.service';
import { NavigationService } from '@/services/navigation.service';
import { SubscriptionService } from '@/services/subscription.service';
import { ISubscription, SubscriptionCard } from '@/components/card/subscription-card';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import { IonHeader, IonToolbar, IonContent, RefresherCustomEvent, IonRefresherContent, IonRefresher } from '@ionic/angular/standalone';
import { Component, inject, ChangeDetectionStrategy, signal, computed, OnInit } from '@angular/core';

@Component({
  selector: 'my-subscriptions',
  templateUrl: './my-subscriptions.html',
  styleUrl: './my-subscriptions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonRefresher, IonRefresherContent, IonHeader, IonToolbar, IonContent, SubscriptionCard, SegmentButton]
})
export class MySubscriptions implements OnInit {
  // services
  navigationService = inject(NavigationService);
  subscriptionService = inject(SubscriptionService);
  toasterService = inject(ToasterService);

  // signals
  segmentValue = signal<string>('event');
  isLoading = signal<boolean>(false);
  allSubscriptions = signal<ISubscription[]>([]);
  rawSubscriptionsData = signal<any[]>([]); // Store raw API data for navigation

  // Segment items
  segmentItems: SegmentButtonItem[] = [
    {
      value: 'event',
      label: 'Event Plans'
    },
    {
      value: 'sponsor',
      label: 'Sponsor Plans'
    }
  ];

  // computed
  eventSubscriptions = computed(() => {
    return this.allSubscriptions().filter((sub) => sub.type === 'event');
  });

  sponsorSubscriptions = computed(() => {
    return this.allSubscriptions().filter((sub) => sub.type === 'sponsor');
  });

  currentSubscriptions = computed(() => {
    return this.segmentValue() === 'event' ? this.eventSubscriptions() : this.sponsorSubscriptions();
  });

  hasSubscriptions = computed(() => this.currentSubscriptions().length > 0);

  async ngOnInit(): Promise<void> {
    await this.loadSubscriptions();
  }

  async loadSubscriptions(): Promise<void> {
    this.isLoading.set(true);
    try {
      const subscriptionsData = await this.subscriptionService.getUserSubscriptions(1, 20);

      // Ensure subscriptionsData is an array
      if (!Array.isArray(subscriptionsData)) {
        console.warn('Subscriptions data is not an array:', subscriptionsData);
        this.allSubscriptions.set([]);
        return;
      }

      // Store raw data for navigation
      this.rawSubscriptionsData.set(subscriptionsData);

      // Transform API response to ISubscription format
      const subscriptions: ISubscription[] = subscriptionsData.map((sub: any) => {
        // Get plan/product details (response uses 'product')
        const plan = sub.product || sub.plan || {};

        // Get owner/creator details (response includes owner object)
        let creatorName = 'Unknown';
        if (sub.owner) {
          creatorName = sub.owner.name || sub.owner.username || 'Unknown';
        }

        // Get price information
        const price = sub.price || {};
        const priceAmount = price.amount || '0.00';
        const priceInterval = price.interval || 'month';
        const priceDisplay = `$${parseFloat(priceAmount).toFixed(2)} /${priceInterval === 'year' ? 'y' : 'm'}`;

        // Get end date for renew date
        const endDate = sub.end_date ? new Date(sub.end_date) : null;
        const cancelDate = sub.canceled_at ? new Date(sub.canceled_at) : null;

        return {
          id: sub.id,
          type: plan.is_sponsor ? 'sponsor' : 'event',
          planName: plan.name || 'Unknown Plan',
          creatorName: creatorName,
          thumbnail_url: sub?.owner?.thumbnail_url,
          renewDate: endDate,
          cancelDate: sub?.product?.is_deleted ? cancelDate : null,
          price: priceDisplay
        } as ISubscription;
      });

      this.allSubscriptions.set(subscriptions);
    } catch (error: any) {
      console.error('Error loading subscriptions:', error);
      this.toasterService.showError(error?.message || 'Failed to load subscriptions');
      this.allSubscriptions.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  back(): void {
    this.navigationService.back();
  }

  onSegmentChange(value: string): void {
    this.segmentValue.set(value);
  }

  onSubscriptionClick(subscription: ISubscription): void {
    // Find the raw subscription data
    const rawData = this.rawSubscriptionsData().find((sub) => sub.id === subscription.id);

    if (!rawData) {
      console.error('Raw subscription data not found');
      return;
    }

    if (rawData?.product?.is_deleted) {
      this.toasterService.showError('Subscriptions plan is deleted by owner.');
      return;
    }

    // Get plan ID from product
    const product = rawData.product || rawData.plan;
    const planId = product?.id || rawData.product_id;

    if (!planId) {
      console.error('Plan ID not found');
      return;
    }

    this.navigationService.navigateForward(`/subscription/${planId}`, false, {
      from: 'my-subscriptions'
    });
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.loadSubscriptions();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete();
    }
  }
}
