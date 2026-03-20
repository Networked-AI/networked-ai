import { Button } from '@/components/form/button';
import { SubscriptionPlan } from '@/interfaces/event';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { NavigationService } from '@/services/navigation.service';
import { SubscriptionService } from '@/services/subscription.service';
import { SubscriptionCard, ISubscription } from '@/components/card/subscription-card';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import { Component, inject, ChangeDetectionStrategy, signal, computed, OnInit } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonFooter,
  IonIcon,
  RefresherCustomEvent,
  IonRefresherContent,
  IonRefresher,
  IonSkeletonText
} from '@ionic/angular/standalone';

@Component({
  selector: 'subscription-plans',
  templateUrl: './subscription-plans.html',
  styleUrl: './subscription-plans.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonSkeletonText,
    IonRefresher,
    IonRefresherContent,
    IonHeader,
    IonToolbar,
    IonContent,
    IonFooter,
    IonIcon,
    Button,
    SubscriptionCard,
    SegmentButton
  ]
})
export class SubscriptionPlans {
  // services
  navigationService = inject(NavigationService);
  subscriptionService = inject(SubscriptionService);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);

  // signals
  segmentValue = signal<'event' | 'sponsor'>('event');
  isLoading = signal<boolean>(false);
  allPlans = signal<SubscriptionPlan[]>([]);

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
  eventPlans = computed(() => {
    return this.transformPlansToISubscription(this.allPlans().filter((plan) => !plan.is_sponsor));
  });

  sponsorPlans = computed(() => {
    return this.transformPlansToISubscription(this.allPlans().filter((plan) => plan.is_sponsor));
  });

  currentPlans = computed(() => {
    return this.segmentValue() === 'event' ? this.eventPlans() : this.sponsorPlans();
  });

  hasPlans = computed(() => this.currentPlans().length > 0);

  hasAnyPlans = computed(() => this.allPlans().length > 0);

  hasEventPlans = computed(() => this.eventPlans().length > 0);

  hasSponsorPlans = computed(() => this.sponsorPlans().length > 0);

  // Check if we should show segment-specific empty state
  showEventEmptyState = computed(() => {
    return !this.hasEventPlans() && this.hasSponsorPlans();
  });

  showSponsorEmptyState = computed(() => {
    return !this.hasSponsorPlans() && this.hasEventPlans();
  });

  showGenericEmptyState = computed(() => {
    return !this.hasEventPlans() && !this.hasSponsorPlans();
  });

  /**
   * Transform SubscriptionPlan to ISubscription format
   */
  private transformPlansToISubscription(plans: SubscriptionPlan[]): ISubscription[] {
    return plans.map((plan) => ({
      id: plan.product_id,
      name: plan.name,
      subscribers: plan.subscribers || 0,
      priceRange: plan.priceRange || '',
      type: plan.type || (plan.is_sponsor ? 'sponsor' : 'event')
    }));
  }

  async ionViewWillEnter(): Promise<void> {
    await this.loadPlans();
  }

  async loadPlans(): Promise<void> {
    this.isLoading.set(true);
    try {
      const plans = await this.subscriptionService.getSubscriptionPlans();
      this.allPlans.set(plans);
    } catch (error) {
      console.error('Error loading subscription plans:', error);
      this.allPlans.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  back(): void {
    this.navigationService.back();
  }

  onSegmentChange(value: string): void {
    if (value === 'event' || value === 'sponsor') {
      this.segmentValue.set(value);
    }
  }

  onManage(plan: ISubscription): void {
    // Navigate to manage page with plan ID
    if (plan.id) {
      const isSponsor = plan.type === 'sponsor';
      this.navigationService.navigateForward(`/subscription/manage/${plan.id}?is_sponsor=${isSponsor ? 'true' : 'false'}`);
    }
  }

  onEvents(plan: ISubscription): void {
    if (plan.id) {
      const isSponsor = plan.type === 'sponsor';
      this.navigationService.navigateForward(`/subscription/${plan.id}/events?is_sponsor=${isSponsor ? 'true' : 'false'}`);
    }
  }

  async onDelete(plan: ISubscription): Promise<void> {
    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/deleteWhiteIcon.svg',
      iconBgColor: '#C73838',
      title: 'Delete Subscription Plan',
      description: `Are you sure you want to delete "${plan.name}"? This action cannot be undone.`,
      confirmButtonLabel: 'Delete',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left',
      onConfirm: async () => {
        if (!plan.id) {
          throw new Error('Plan ID is required');
        }
        const response = await this.subscriptionService.deletePlan(plan.id);
        this.toasterService.showSuccess(response?.message || 'Plan deleted successfully');
        // Reload plans after deletion
        await this.loadPlans();
        return response;
      }
    });

    if (result && result.role === 'error') {
      this.toasterService.showError('Failed to delete plan. Please try again.');
    }
  }

  onCreatePlan(planType: 'event' | 'sponsor'): void {
    const isSponsor = planType === 'sponsor';
    this.navigationService.navigateForward(`/subscription/create?is_sponsor=${isSponsor ? 'true' : 'false'}`);
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.loadPlans();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete();
    }
  }
}
