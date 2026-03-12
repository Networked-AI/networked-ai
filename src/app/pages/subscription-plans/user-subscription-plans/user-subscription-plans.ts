import { Button } from '@/components/form/button';
import { ActivatedRoute } from '@angular/router';
import { PlanData } from '@/interfaces/ISubscripton';
import { ModalService } from '@/services/modal.service';
import { EventService } from '@/services/event.service';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { ToasterService } from '@/services/toaster.service';
import { NavigationService } from '@/services/navigation.service';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ISubscription } from '@/components/card/subscription-card';
import { SubscriptionService } from '@/services/subscription.service';
import { PlanPreview } from '@/pages/subscription-plans/plan-preview/plan-preview';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonIcon,
  RefresherCustomEvent,
  IonRefresher,
  IonRefresherContent,
  ModalController
} from '@ionic/angular/standalone';
import { Component, inject, ChangeDetectionStrategy, signal, computed, OnInit, OnDestroy, Input, DOCUMENT, PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'user-subscription-plans',
  templateUrl: './user-subscription-plans.html',
  styleUrl: './user-subscription-plans.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonRefresherContent,
    IonRefresher,
    Button,
    IonIcon,
    IonHeader,
    IonToolbar,
    IonContent,
    CommonModule,
    PlanPreview,
    SegmentButton,
    ReactiveFormsModule
  ]
})
export class UserSubscriptionPlans implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private subscriptionService = inject(SubscriptionService);
  private eventService = inject(EventService);
  private toasterService = inject(ToasterService);
  private route = inject(ActivatedRoute);
  private modalService = inject(ModalService);
  modalCtrl = inject(ModalController);
  private document = inject(DOCUMENT);
  private navigationService = inject(NavigationService);
  private datePipe = new DatePipe('en-US');
  isFromMySubscriptions = signal<boolean>(false);
  isLoading = signal<boolean>(false);
  plans = signal<PlanData[]>([]);
  selectedPlanIndex = signal<number>(0);
  events = signal<any[]>([]);
  selectedPlanInterval = signal<'month' | 'year'>('month');
  planTypeFilter = signal<'event' | 'sponsor'>('event');
  isDropdownOpen = signal<boolean>(false);
  @Input() id = '';

  // platform
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Computed properties
  filteredPlans = computed(() => {
    const filter = this.planTypeFilter();
    const allPlans = this.plans();

    if (filter === 'event') return allPlans.filter((plan) => !plan.is_sponsor);
    return allPlans.filter((plan) => plan.is_sponsor);
  });

  goToTerms() {
    this.navigationService.navigateForward('/terms');
  }

  goToPolicy() {
    this.navigationService.navigateForward('/policy');
  }

  currentPlan = computed(() => {
    const plansList = this.filteredPlans();
    const index = this.selectedPlanIndex();
    return plansList[index] || null;
  });

  hasMultiplePlans = computed(() => this.filteredPlans().length > 1);

  hasBothPlanTypes = computed(() => {
    const allPlans = this.plans();
    const hasEvent = allPlans.some((p) => !p.is_sponsor);
    const hasSponsor = allPlans.some((p) => p.is_sponsor);
    return hasEvent && hasSponsor;
  });

  planTabs = computed<SegmentButtonItem[]>(() => {
    return this.filteredPlans().map((plan, index) => ({
      value: index.toString(),
      label: plan.name
    }));
  });

  planForm = computed(() => {
    const plan = this.currentPlan();
    if (!plan) return this.fb.group({});

    const monthlyPrice = plan.prices.find((p) => p.interval === 'month');
    const annualPrice = plan.prices.find((p) => p.interval === 'year');

    return this.fb.group({
      name: [plan.name],
      description: [plan.description || ''],
      monthlyPrice: [monthlyPrice ? parseFloat(monthlyPrice.amount) : 0],
      annualSubscription: [!!annualPrice],
      discountPercentage: [0],
      discountType: ['percentage'],
      is_sponsor: [plan.is_sponsor],
      plan_benefits: [plan.plan_benefits || []],
      event_ids: [plan.event_ids || []]
    });
  });

  benefits = computed(() => {
    const plan = this.currentPlan();
    if (!plan || !plan.plan_benefits) return [];
    return plan.plan_benefits.map((text, index) => ({
      id: `benefit-${index}`,
      text
    }));
  });

  selectedEvents = computed(() => {
    const plan = this.currentPlan();
    return plan?.event_ids || [];
  });

  // Get events from current plan (they're included in API response)
  currentPlanEvents = computed(() => {
    const plan = this.currentPlan();
    if (!plan || !plan.events) return [];
    // Transform events to the format expected by plan-preview
    return plan.events.map((event) => this.transformEventForPlanPreview(event));
  });

  // Get actual annual price from prices array
  annualPriceValue = computed(() => {
    const plan = this.currentPlan();
    if (!plan) return 0;
    const annualPrice = plan.prices.find((p) => p.interval === 'year');
    return annualPrice ? parseFloat(annualPrice.amount) : 0;
  });

  // Get selected price based on interval
  selectedPriceValue = computed(() => {
    const interval = this.selectedPlanInterval();
    if (interval === 'year') {
      return this.annualPriceValue();
    }
    return this.monthlyPriceValue();
  });

  // Check if annual subscription is available
  hasAnnualSubscription = computed(() => {
    const plan = this.currentPlan();
    return plan ? !!plan.prices.find((p) => p.interval === 'year') : false;
  });

  monthlyPriceValue = computed(() => {
    const plan = this.currentPlan();
    if (!plan) return 0;
    const monthlyPrice = plan.prices.find((p) => p.interval === 'month');
    return monthlyPrice ? parseFloat(monthlyPrice.amount) : 0;
  });

  discountValue = computed(() => {
    const plan = this.currentPlan();
    if (!plan) return 0;
    const annualPrice = plan.prices.find((p) => p.interval === 'year');

    // Use discount_percentage from API if available
    if (annualPrice?.discount_percentage !== null && annualPrice?.discount_percentage !== undefined) {
      return Number(annualPrice.discount_percentage);
    }

    // Otherwise calculate from prices
    const monthlyPrice = plan.prices.find((p) => p.interval === 'month');
    if (!monthlyPrice || !annualPrice) return 0;
    const annualBase = parseFloat(monthlyPrice.amount) * 12;
    const annualActual = parseFloat(annualPrice.amount);
    const discount = ((annualBase - annualActual) / annualBase) * 100;
    return Math.round(discount);
  });

  discountType = computed(() => {
    const plan = this.currentPlan();
    if (!plan) return 'percentage' as 'percentage' | 'fixed';
    const annualPrice = plan.prices.find((p) => p.interval === 'year');

    // Map banner_display_type from API to discountType
    // API uses 'fixed' or 'percentage', component uses 'fixed' or 'percentage'
    if (annualPrice?.banner_display_type === 'fixed') {
      return 'fixed' as 'percentage' | 'fixed';
    }
    return 'percentage' as 'percentage' | 'fixed';
  });

  planType = computed(() => {
    const plan = this.currentPlan();
    return plan?.is_sponsor ? 'sponsor' : 'event';
  });

  selectedTabValue = computed(() => {
    return this.selectedPlanIndex().toString();
  });

  // Get selected price ID based on selected interval
  currentPriceId = computed(() => {
    const plan = this.currentPlan();
    if (!plan) return '';
    const interval = this.selectedPlanInterval();
    const price = plan.prices.find((p) => p.interval === interval);
    return price?.id || '';
  });

  // Get selected price value for display
  displayPriceValue = computed(() => {
    const interval = this.selectedPlanInterval();
    if (interval === 'year') {
      return this.annualPriceValue();
    }
    return this.monthlyPriceValue();
  });

  // Get selected price period for display
  displayPricePeriod = computed(() => {
    const interval = this.selectedPlanInterval();
    return interval === 'year' ? '/year' : '/month';
  });

  // Get current subscription (first one from subscriptions array)
  currentSubscription = computed(() => {
    const plan = this.currentPlan();
    if (!plan) return null;
    const interval = this.selectedPlanInterval();
    const price = plan.prices.find((p) => p.interval === interval);
    if (!price || !price.subscriptions || price.subscriptions.length === 0) return null;
    return price.subscriptions[0];
  });

  // Check if current selected price has an active subscription
  hasActiveSubscription = computed(() => {
    const subscription = this.currentSubscription();
    return !!subscription;
  });

  // Check if subscription should be disabled (cancel_at_end_date is true)
  isSubscriptionCanceled = computed(() => {
    const subscription = this.currentSubscription();
    return subscription?.cancel_at_end_date === true;
  });

  // Get current subscription ID for unsubscribe
  currentSubscriptionId = computed(() => {
    const subscription = this.currentSubscription();
    return subscription?.id || null;
  });

  // Transform current plan to ISubscription format for subscription card
  subscriptionCardData = computed<ISubscription | null>(() => {
    const plan = this.currentPlan();
    const subscription = this.currentSubscription();
    if (!plan || !subscription) return null;

    const interval = this.selectedPlanInterval();
    const price = plan.prices.find((p) => p.interval === interval);
    if (!price) return null;

    const priceDisplay = `$${parseFloat(price.amount).toFixed(2)} /${interval === 'year' ? 'y' : 'm'}`;
    const endDate = subscription.end_date ? new Date(subscription.end_date) : null;

    return {
      id: subscription.id,
      type: plan.is_sponsor ? 'sponsor' : 'event',
      planName: plan.name || 'Unknown Plan',
      creatorName: plan?.user?.name,
      thumbnail_url: plan?.user?.thumbnail_url,
      renewDate: endDate,
      price: priceDisplay
    } as ISubscription;
  });

  // Get subscription end date
  subscriptionEndDate = computed(() => {
    const subscription = this.currentSubscription();
    return subscription?.end_date || null;
  });

  // Format end date for display
  formattedEndDate = computed(() => {
    const endDate = this.subscriptionEndDate();
    if (!endDate) return '';
    const date = new Date(endDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  dropdownOptions = computed(() => {
    const allPlans = this.plans();
    const currentFilter = this.planTypeFilter();
    const options: Array<{
      type: 'event' | 'sponsor';
      label: string;
      iconClass: string;
      iconSrc?: string;
      checkColor: string;
      isActive: boolean;
    }> = [];

    if (allPlans.some((p) => !p.is_sponsor)) {
      options.push({
        type: 'event',
        label: 'Show Event Subscription Plans',
        iconClass: 'pi pi-crown text-white text-xl',
        checkColor: '#2b5bde',
        isActive: currentFilter === 'event'
      });
    }

    if (allPlans.some((p) => p.is_sponsor)) {
      options.push({
        type: 'sponsor',
        label: 'Show Sponsor Subscription Plans',
        iconClass: '',
        iconSrc: '/assets/svg/subscription/sponsorIcon.svg',
        checkColor: '#f5bc61',
        isActive: currentFilter === 'sponsor'
      });
    }

    return options;
  });

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;
    const state = window.history.state;
    const fromValue = state?.from;
    this.isFromMySubscriptions.set(fromValue === 'my-subscriptions');

    await this.loadPlanOrPlansBasedOnState();

    // Close dropdown when clicking outside
    this.document.addEventListener('click', this.handleClickOutside.bind(this));
  }

  private async loadPlanOrPlansBasedOnState(): Promise<void> {
    const planId = this.route.snapshot.paramMap.get('planId') || this.id;
    if (planId) {
      await this.loadPlanById(planId);
    } else {
      const userId = this.route.snapshot.paramMap.get('userId');
      if (!userId) {
        this.toasterService.showError('User ID or Plan ID is required');
        this.navigationService.back();
        return;
      }
      await this.loadPlans(userId);
    }
  }

  private handleClickOutside = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      this.isDropdownOpen.set(false);
    }
  };

  ngOnDestroy(): void {
    this.document.removeEventListener('click', this.handleClickOutside);
  }

  async loadPlanById(planId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const planData = await this.subscriptionService.getPlanById(planId);
      if (!planData) {
        this.toasterService.showError('Subscription plan not found');
        this.navigationService.back();
        return;
      }

      this.plans.set([planData]);
      this.selectedPlanIndex.set(0);
      this.planTypeFilter.set(planData.is_sponsor ? 'sponsor' : 'event');
    } catch (error) {
      console.error('Error loading subscription plan by ID:', error);
      this.toasterService.showError('Failed to load subscription plan');
      this.navigationService.back();
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadPlans(userId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const plansData = await this.subscriptionService.getSubscriptionPlansByUserId(userId);
      this.plans.set((plansData as PlanData[]) || []);

      if (!plansData || plansData.length === 0) {
        this.toasterService.showError('No subscription plans found');
        this.navigationService.back();
        return;
      }

      // Events are already included in the API response, no need to fetch separately
    } catch (error) {
      console.error('Error loading subscription plans:', error);
      this.toasterService.showError('Failed to load subscription plans');
      this.navigationService.back();
    } finally {
      this.isLoading.set(false);
    }
  }

  private transformEventForPlanPreview(event: any): any {
    if (!event.start_date) {
      return {
        id: event.id || '',
        title: event.title || '',
        date: '',
        dayOfWeek: '',
        day: '',
        address: event.address || '',
        time: '',
        organization: 'Get Networked',
        image_url: event.image_url || ''
      };
    }

    const startDate = new Date(event.start_date);
    const endDate = event.end_date ? new Date(event.end_date) : null;

    const dayOfWeek = this.datePipe.transform(startDate, 'EEE') || '';
    const day = startDate.getDate().toString();
    const dateStr = this.datePipe.transform(startDate, 'yyyy-MM-dd') ?? '';

    const startTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    let timeStr = startTime;
    if (endDate) {
      const endTime = endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      timeStr = `${startTime} - ${endTime}`;
    }

    return {
      id: event.id || '',
      title: event.title || '',
      date: dateStr,
      dayOfWeek,
      day,
      address: event.address || '',
      time: timeStr,
      organization: 'Get Networked',
      image_url: event.image_url || ''
    };
  }

  onPlanTabChange(value: string): void {
    const index = parseInt(value, 10);
    const filtered = this.filteredPlans();
    if (!isNaN(index) && index >= 0 && index < filtered.length) {
      this.selectedPlanIndex.set(index);
    }
  }

  onPlanTypeFilterChange(filter: 'event' | 'sponsor'): void {
    this.planTypeFilter.set(filter);
    this.selectedPlanIndex.set(0);
    this.isDropdownOpen.set(false);
  }

  toggleDropdown(): void {
    this.isDropdownOpen.set(!this.isDropdownOpen());
  }

  getFilterLabel(): string {
    const filter = this.planTypeFilter();
    if (filter === 'event') return 'Show Event Subscription Plans';
    if (filter === 'sponsor') return 'Show Sponsor Subscription Plans';
    return 'Show All Subscription Plans';
  }

  onPlanSelected(interval: 'annual' | 'monthly'): void {
    const newInterval = interval === 'annual' ? 'year' : 'month';
    // Always update to ensure computed signals refresh
    this.selectedPlanInterval.set(newInterval);
  }

  async subscribe(): Promise<void> {
    const plan = this.currentPlan();
    if (!plan) return;
    const priceId = this.currentPriceId();
    if (!priceId) {
      this.toasterService.showError('Please select a pricing plan');
      return;
    }

    this.isLoading.set(true);
    try {
      const response = await this.subscriptionService.createSubscriptionPaymentIntent(priceId);

      if (response?.client_secret) {
        await this.openPaymentModal(response.client_secret, plan.name, response);
      } else {
        this.toasterService.showError('Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      this.toasterService.showError(error?.message || 'Failed to initialize payment');
    } finally {
      this.isLoading.set(false);
    }
  }

  async openPaymentModal(clientSecret: string, planName: string, paymentIntentResponse?: any): Promise<void> {
    const result = await this.modalService.openSubscriptionPaymentModal({
      clientSecret,
      amount: this.displayPriceValue(),
      summary: [
        {
          label: planName || 'Subscription',
          amount: this.displayPriceValue()
        }
      ]
    });

    if (result?.success) {
      const plan = this.currentPlan();
      const planId = plan?.id;

      await this.modalService.openConfirmModal({
        iconName: 'pi-check',
        iconBgColor: 'linear-gradient(138.06deg, #F5BC61 8.51%, #C89034 48.28%, #9E660A 85.69%)',
        title: 'Subscription Confirmed!',
        description: "You'll receive notifications when the host adds new events to the subscription.",
        confirmButtonLabel: 'Done',
        shareButtonLabel: 'Share',
        confirmButtonColor: 'primary',
        iconPosition: 'center',

        onShare: async () => {
          // await this.modalService.close();
          if (planId) {
            await this.modalService.openShareModal(planId, 'Plan');
          }
        },

        onConfirm: async () => {
          await this.modalService.close();
          if (this.id) {
            this.modalCtrl.dismiss();
          } else {
            this.navigationService.back();
          }
        }
      });
    }
  }

  async onUnsubscribe(subscriptionId: string): Promise<void> {
    if (!subscriptionId) return;

    const plan = this.currentPlan();
    const planName = plan?.name || 'this plan';
    const endDate = this.formattedEndDate();

    try {
      const result = await this.modalService.openUnsubscribeConfirmModal({
        planName,
        endDate,
        onConfirm: async () => {
          await this.subscriptionService.cancelSubscription(subscriptionId);

          const userId = this.route.snapshot.paramMap.get('userId');
          if (userId) {
            await this.loadPlans(userId);
          }
        }
      });

      if (result?.confirmed) {
        await this.showSubscriptionCancelledModal(endDate);
      }
    } catch (error: any) {
      console.error('Error in unsubscribe flow:', error);
      this.toasterService.showError(error?.message || 'Failed to cancel subscription');
    }
  }

  /**
   * Show subscription cancelled success modal
   */
  private async showSubscriptionCancelledModal(endDate: string): Promise<void> {
    await this.modalService.openConfirmModal({
      iconName: 'pi-check',
      iconBgColor: 'linear-gradient(138.06deg, #F5BC61 8.51%, #C89034 48.28%, #9E660A 85.69%)',
      title: 'Subscription Cancelled',
      description: `You've cancelled your subscription. You'll still have full access to this plan until the next billing period on ${endDate}.`,
      confirmButtonLabel: 'Done',
      confirmButtonColor: 'primary',
      iconPosition: 'center',
      onConfirm: async () => {
        this.navigationService.back();
      }
    });
  }

  back(): void {
    if (this.id) {
      this.modalCtrl.dismiss();
    } else {
      this.navigationService.back();
    }
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.loadPlanOrPlansBasedOnState();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      event.target.complete();
    }
  }
}
