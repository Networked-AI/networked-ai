import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonFooter,
  ItemReorderEventDetail,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/angular/standalone';
import { IEvent } from '@/interfaces/event';
import { ActivatedRoute } from '@angular/router';
import { Button } from '@/components/form/button';
import { InputTextModule } from 'primeng/inputtext';
import { AuthService } from '@/services/auth.service';
import { RadioButtonModule } from 'primeng/radiobutton';
import { EventService } from '@/services/event.service';
import { CommonModule, DatePipe } from '@angular/common';
import { ModalService } from '@/services/modal.service';
import { NavController } from '@ionic/angular/standalone';
import { ToasterService } from '@/services/toaster.service';
import { SubscriptionService } from '@/services/subscription.service';
import { PlanPreview } from '@/pages/subscription-plans/plan-preview';
import { SubscriptionEventCard } from '@/components/card/subscription-event-card';
import { DescriptionGeneratorService } from '@/services/description-generator.service';
import { PlanDetailsForm } from '@/pages/subscription-plans/components/plan-details-form';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Component, computed, inject, signal, ChangeDetectionStrategy, OnInit, ChangeDetectorRef, Input } from '@angular/core';
import { NavigationService } from '@/services/navigation.service';

interface Event {
  id: string;
  title: string;
  date: string;
  dayOfWeek: string;
  day: string;
  address: string;
  time: string;
  organization: string;
  image_url?: string;
}

@Component({
  selector: 'app-create-plan',
  imports: [
    Button,
    IonHeader,
    IonFooter,
    IonContent,
    IonToolbar,
    PlanPreview,
    CommonModule,
    InputTextModule,
    RadioButtonModule,
    ReactiveFormsModule,
    SubscriptionEventCard,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    PlanDetailsForm
  ],
  styleUrl: './create-plan.scss',
  templateUrl: './create-plan.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreatePlan implements OnInit {
  SPONSOR_GRADIENT =
    'radial-gradient(161.73% 107.14% at 9.38% -7.14%, #F9F2E6 13.46%, #F4D7A9 38.63%, rgba(201, 164, 105, 0.94) 69.52%, #BF9E69 88.87%, rgba(195, 167, 121, 0.9) 100%)';

  fb = inject(FormBuilder);
  navigationService = inject(NavigationService);
  cdr = inject(ChangeDetectorRef);
  modalService = inject(ModalService);
  subscriptionService = inject(SubscriptionService);
  toasterService = inject(ToasterService);
  eventService = inject(EventService);
  authService = inject(AuthService);
  route = inject(ActivatedRoute);
  descriptionGeneratorService = inject(DescriptionGeneratorService);
  datePipe = new DatePipe('en-US');

  nameValue = signal<string>('');
  currentStep = signal<number>(1);
  conversation = signal<any[]>([]);
  discountValue = signal<number>(0);
  steps = signal<number[]>([1, 2, 3]);
  isLaunching = signal<boolean>(false);
  selectedEvents = signal<string[]>([]);
  monthlyPriceValue = signal<number>(0);
  discountType = signal<'percentage' | 'fixed'>('percentage');

  planForm = signal<FormGroup<any>>(
    this.fb.group<any>({
      name: this.fb.control<string | null>(null, [Validators.required]),
      monthlyPrice: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
      description: this.fb.control<string | null>(null),
      plan_benefits: this.fb.control<string[] | null>([]),
      annualSubscription: this.fb.control<boolean | null>(false),
      discountPercentage: this.fb.control<number | null>(10),
      discountType: this.fb.control<'percentage' | 'fixed' | null>('percentage'),
      annualPrice: this.fb.control<number | null>(null),
      event_ids: this.fb.control<string[] | null>([]),
      is_sponsor: this.fb.control<boolean | null>(true, [Validators.required])
    })
  );

  benefits = signal<any[]>([
    { id: '1', text: '' },
    { id: '2', text: '' }
  ]);
  benefitErrors = signal<Set<string>>(new Set());

  events = signal<Event[]>([]);
  isLoadingEvents = signal<boolean>(false);
  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  isLoadingMore = signal<boolean>(false);
  pageLimit = 20;

  hasMore = computed(() => {
    return this.currentPage() < this.totalPages();
  });

  stepHeading = computed(() => {
    const step = this.currentStep();
    switch (step) {
      case 1:
        return this.isSponsorPlan() ? 'Sponsorship Plan Details' : 'Plan Details';
      case 2:
        return 'Include Events';
      case 3:
        return 'Preview';
      default:
        return 'Plan Details';
    }
  });

  buttonLabel = computed(() => {
    const step = this.currentStep();
    const selectedCount = this.selectedEvents().length;
    switch (step) {
      case 1:
        return 'Next';
      case 2:
        return selectedCount > 0 ? `Next (${selectedCount})` : 'Next';
      case 3:
        return 'Launch';
      default:
        return 'Next';
    }
  });

  clearButtonLabel = computed(() => {
    const count = this.selectedEvents().length;
    return count > 0 ? 'Clear Selection' : 'Skip for Now';
  });

  isNextButtonDisabled = computed(() => {
    return this.currentStep() === 2 && this.selectedEvents().length === 0;
  });

  primaryButton = computed(() => {
    const step = this.currentStep();
    const hasIcon = step === 3;
    const isSponsor = this.planForm().get('is_sponsor')?.value ?? true;
    const iconPath = hasIcon ? (isSponsor ? 'assets/svg/launch-black.svg' : 'assets/svg/launch.svg') : '';
    return {
      label: this.buttonLabel(),
      icon: iconPath,
      disabled: step === 2 ? this.isNextButtonDisabled() : false,
      clickHandler: () => this.handleButtonClick(),
      customColor: !isSponsor ? '#2B5BDE' : undefined
    };
  });

  secondaryButton = computed(() => {
    const step = this.currentStep();
    return {
      label: step === 1 ? 'Cancel' : step === 2 ? this.clearButtonLabel() : 'Edit',
      icon: step === 3 ? 'assets/svg/editIconBlack.svg' : '',
      color: 'secondary' as const,
      clickHandler: step === 1 ? () => this.previousStep() : step === 2 ? () => this.handleClearButtonClick() : () => this.currentStep.set(1)
    };
  });

  annualPrice = computed(() => {
    const monthlyPrice = this.monthlyPriceValue();
    const discount = this.discountValue();
    const annualBase = monthlyPrice * 12;
    const discountAmount = (annualBase * discount) / 100;
    return annualBase - discountAmount;
  });

  annualBasePrice = computed(() => {
    return this.monthlyPriceValue() * 12;
  });

  amountSaved = computed(() => {
    return this.annualBasePrice() - this.annualPrice();
  });

  discountPercentage = computed(() => {
    return this.discountValue();
  });

  bannerColors = computed(() => {
    const isSponsor = this.planForm().get('is_sponsor')?.value ?? true;
    if (!isSponsor) {
      return {
        border: '#2B5BDE',
        background: '#EFF6FF',
        badge: '#2B5BDE'
      };
    }
    return {
      border: '#F5BC61',
      background: '#FFFBEB',
      badge: '#F5BC61'
    };
  });

  isSponsorPlan = computed(() => {
    return this.planForm().get('is_sponsor')?.value ?? true;
  });

  discountTypeOptions = computed(() => {
    return [
      {
        type: 'percentage' as const,
        badgeText: `${this.discountPercentage()}% OFF!`,
        label: 'Show % Discount',
        inputId: 'discount-percentage'
      },
      {
        type: 'fixed' as const,
        badgeText: `SAVE $${Math.round(this.amountSaved())}!`,
        label: 'Show Amount Saved',
        inputId: 'discount-amount'
      }
    ];
  });

  async ngOnInit(): Promise<void> {
    const isSponsorParam = this.route.snapshot.queryParamMap.get('is_sponsor');
    const isSponsor = isSponsorParam === 'true';
    this.planForm().patchValue({ is_sponsor: isSponsor });

    await this.loadEvents(true);

    this.planForm()
      .get('monthlyPrice')
      ?.valueChanges.subscribe((value) => {
        this.monthlyPriceValue.set(value || 0);
      });

    this.planForm()
      .get('discountPercentage')
      ?.valueChanges.subscribe((value) => {
        this.discountValue.set(value || 0);
      });

    this.planForm()
      .get('name')
      ?.valueChanges.subscribe((value) => {
        this.nameValue.set(value || '');
      });

    this.planForm()
      .get('discountType')
      ?.valueChanges.subscribe((value) => {
        if (value === 'percentage' || value === 'fixed') {
          this.discountType.set(value);
        }
      });

    const form = this.planForm();
    this.monthlyPriceValue.set(form.get('monthlyPrice')?.value || 0);
    this.discountValue.set(form.get('discountPercentage')?.value || 10);
    this.nameValue.set(form.get('name')?.value || '');

    const formSelectedEvents = form.get('event_ids')?.value || [];
    this.selectedEvents.set(formSelectedEvents);

    const formDiscountType = form.get('discountType')?.value;
    if (formDiscountType === 'percentage' || formDiscountType === 'fixed') {
      this.discountType.set(formDiscountType);
    }
  }

  getBannerBorderStyle(discountType: 'percentage' | 'fixed', isSelected: boolean): string {
    if (this.isSponsorPlan()) {
      return isSelected ? this.SPONSOR_GRADIENT : '#D1D5DB';
    }
    return isSelected ? this.bannerColors().border : '#D1D5DB';
  }

  getBannerBadgeStyle(): string {
    return this.isSponsorPlan() ? this.SPONSOR_GRADIENT : this.bannerColors().badge;
  }

  isAnnualSubscriptionEnabled = computed(() => {
    const name = this.nameValue();
    const monthlyPrice = this.monthlyPriceValue();
    const nameValid = name && name.trim().length > 0;
    const priceValid = monthlyPrice > 0;
    return nameValid && priceValid;
  });

  groupedEvents = computed(() => {
    const events = this.events();
    const grouped: { [key: string]: Event[] } = {};

    events.forEach((event) => {
      if (!event.date) return;

      const date = new Date(event.date);
      if (isNaN(date.getTime())) return;

      const month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push(event);
    });

    Object.keys(grouped).forEach((month) => {
      grouped[month].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    });

    return grouped;
  });

  private transformEventToSubscriptionEvent(event: IEvent): Event {
    if (!event.start_date) {
      return {
        id: event.id || '',
        title: event.title || '',
        date: '',
        dayOfWeek: '',
        day: '',
        address: event.address || '',
        time: '',
        organization: this.getOrganization(event),
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
      organization: this.getOrganization(event),
      image_url: event.image_url || ''
    };
  }

  private getOrganization(event: IEvent): string {
    const hostParticipant = event.participants?.find((p) => p.role === 'Host');
    return hostParticipant?.user?.name || 'Networked AI';
  }

  private async fetchEvents(page: number): Promise<any> {
    const currentUser = this.authService.currentUser();
    const userId = currentUser?.id;

    if (!userId) {
      return { data: { data: [], pagination: {} } };
    }

    return await this.eventService.getEvents({
      page,
      limit: this.pageLimit,
      order_by: 'start_date',
      order_direction: 'DESC',
      roles: 'Host',
      user_id: userId
    });
  }

  private handleEventsResponse(response: any, reset: boolean, page: number): void {
    if (!response?.data?.data) return;

    const events = Array.isArray(response.data.data) ? response.data.data : [];
    const pagination = response?.data?.pagination || {};
    const totalPages = pagination.totalPages || pagination.total_pages || 0;
    const currentPageNum = pagination.currentPage || page;

    const transformedEvents = events.map((event: IEvent) => this.transformEventToSubscriptionEvent(event));

    if (reset) {
      this.events.set(transformedEvents);
    } else {
      this.events.update((existing) => [...existing, ...transformedEvents]);
    }

    this.currentPage.set(currentPageNum);
    this.totalPages.set(totalPages || Math.ceil((pagination.totalCount || 0) / this.pageLimit));
  }

  async loadEvents(reset: boolean = false): Promise<void> {
    try {
      if (reset) {
        this.isLoadingEvents.set(true);
      }

      const page = reset ? 1 : this.currentPage();
      const response = await this.fetchEvents(page);
      this.handleEventsResponse(response, reset, page);
    } catch (error) {
      console.error('Error loading events:', error);
      if (reset) {
        this.events.set([]);
      }
    } finally {
      this.isLoadingEvents.set(false);
    }
  }

  async loadMoreEvents(event: any): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);
      const nextPage = this.currentPage() + 1;
      const response = await this.fetchEvents(nextPage);
      this.handleEventsResponse(response, false, nextPage);
    } catch (error) {
      console.error('Error loading more events:', error);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  }

  groupedEventsKeys = computed(() => {
    const grouped = this.groupedEvents();
    const keys = Object.keys(grouped);

    return keys.sort((a, b) => {
      const dateA = this.parseMonthYear(a);
      const dateB = this.parseMonthYear(b);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });
  });

  private parseMonthYear(monthYear: string): Date | null {
    try {
      const date = new Date(monthYear + ' 1');
      if (isNaN(date.getTime())) {
        const date2 = new Date(monthYear + ' 1, ' + new Date().getFullYear());
        return isNaN(date2.getTime()) ? null : date2;
      }
      return date;
    } catch {
      return null;
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
    } else {
      this.navigationService.back();
    }
  }

  nextStep(): void {
    const step = this.currentStep();
    if (step === 1) {
      const form = this.planForm();
      if (!form.get('name')?.valid || !form.get('monthlyPrice')?.valid) {
        form.get('name')?.markAsTouched();
        form.get('monthlyPrice')?.markAsTouched();
        return;
      }

      const benefits = this.benefits();
      const emptyBenefitIds = new Set<string>();
      benefits.forEach((benefit) => {
        if (!benefit.text || benefit.text.trim().length === 0) {
          emptyBenefitIds.add(benefit.id);
        }
      });

      if (emptyBenefitIds.size > 0) {
        this.benefitErrors.set(emptyBenefitIds);
        this.toasterService.showError('Please fill in all plan benefits');
        return;
      }

      this.benefitErrors.set(new Set());
      this.currentStep.set(2);
    } else if (step === 2) {
      this.currentStep.set(3);
    }
  }

  handleButtonClick(): void {
    const step = this.currentStep();
    if (step === 3) {
      this.launchPlan();
    } else {
      this.nextStep();
    }
  }

  addBenefit(): void {
    const newBenefit: any = {
      id: Date.now().toString(),
      text: ''
    };
    this.benefits.set([...this.benefits(), newBenefit]);
  }

  removeBenefit(index: number): void {
    const updated = this.benefits().filter((_, i) => i !== index);
    this.benefits.set(updated);
    this.planForm().patchValue({ plan_benefits: updated.map((b) => b.text) });
  }

  updateBenefit(index: number, text: string): void {
    const updated = [...this.benefits()];
    const benefit = updated[index];
    updated[index] = { ...benefit, text };
    this.benefits.set(updated);
    this.planForm().patchValue({ plan_benefits: updated.map((b) => b.text) });

    if (text && text.trim().length > 0) {
      const errors = new Set(this.benefitErrors());
      errors.delete(benefit.id);
      this.benefitErrors.set(errors);
    }
  }

  hasBenefitError(benefitId: string): boolean {
    return this.benefitErrors().has(benefitId);
  }

  toggleEventSelection(eventId: string): void {
    const selected = this.selectedEvents();
    const index = selected.indexOf(eventId);

    let newSelected: string[];
    if (index > -1) {
      newSelected = selected.filter((id) => id !== eventId);
    } else {
      newSelected = [...selected, eventId];
    }

    this.selectedEvents.set(newSelected);
    this.planForm().patchValue({ event_ids: newSelected });
  }

  clearSelection(): void {
    this.selectedEvents.set([]);
    this.planForm().patchValue({ event_ids: [] });
  }

  handleClearButtonClick(): void {
    if (this.selectedEvents().length > 0) {
      this.clearSelection();
    } else {
      this.nextStep();
    }
  }

  setDiscount(percentage: number): void {
    const form = this.planForm();
    const control = form.get('discountPercentage');
    if (control) {
      control.setValue(percentage);
      control.markAsTouched();
      this.discountValue.set(percentage);
    }
  }

  setDiscountType(type: 'percentage' | 'fixed'): void {
    this.discountType.set(type);
    this.planForm().patchValue({ discountType: type });
  }

  getFieldValue(fieldName: string): any {
    return this.planForm().get(fieldName)?.value;
  }

  async launchPlan(): Promise<void> {
    const form = this.planForm();

    if (!form.valid) {
      form.markAllAsTouched();
      return;
    }

    this.isLaunching.set(true);

    try {
      const monthlyPrice = Number(form.get('monthlyPrice')?.value) || 0;
      const annualSubscription = form.get('annualSubscription')?.value || false;
      const discountPercentage = Number(form.get('discountPercentage')?.value) || 0;

      const prices: Array<{
        amount: number;
        interval: 'month' | 'year';
        discount_percentage?: number | null;
        banner_display_type?: 'percentage' | 'fixed' | null;
      }> = [
        {
          amount: Number(monthlyPrice),
          interval: 'month',
          discount_percentage: null,
          banner_display_type: null
        }
      ];

      if (annualSubscription) {
        const annualBase = Number(monthlyPrice) * 12;
        const discountAmount = (annualBase * Number(discountPercentage)) / 100;
        const annualPrice = annualBase - discountAmount;
        const discountType = form.get('discountType')?.value || 'percentage';
        const bannerDisplayType: 'percentage' | 'fixed' | null =
          discountType === 'fixed' ? 'fixed' : discountType === 'percentage' ? 'percentage' : null;

        prices.push({
          amount: Number(annualPrice),
          interval: 'year',
          discount_percentage: Number(discountPercentage) || null,
          banner_display_type: bannerDisplayType
        });
      }

      const planBenefits = this.benefits()
        .map((b) => b.text)
        .filter((text) => text && text.trim().length > 0);

      const formValue = form.getRawValue();
      const payload = {
        name: formValue.name,
        description: formValue.description || '',
        prices,
        is_sponsor: formValue.is_sponsor ?? true,
        plan_benefits: planBenefits,
        event_ids: formValue.event_ids || []
      };

      let response = await this.subscriptionService.createPlan(payload);
      this.toasterService.showSuccess(response?.message || 'Plan created successfully');

      const isSponsorValue = this.planForm().get('is_sponsor')?.value ?? true;
      const color = !isSponsorValue ? '#2B5BDE' : '';
      const iconBgColor = isSponsorValue ? this.SPONSOR_GRADIENT : color;

      await this.modalService.openConfirmModal({
        title: 'Subscription Published!',
        description: 'Your subscription plan is now live!',
        confirmButtonLabel: 'Done',
        shareButtonLabel: 'Share',
        confirmButtonColor: 'primary',
        icon: 'assets/svg/launch.svg',
        iconBgColor: iconBgColor,
        customColor: color,
        onShare: async () => {
          await this.modalService.openShareModal(response?.data?.id, 'Plan');
        }
      });

      this.navigationService.back();
    } catch (error: any) {
      console.error('Error launching plan:', error);
      const errorMessage = error?.message || 'Failed to create plan. Please try again';
      this.toasterService.showError(errorMessage);
    } finally {
      this.isLaunching.set(false);
    }
  }

  reorderBenefits(event: ItemReorderEventDetail): void {
    const benefits = [...this.benefits()];
    const movedItem = benefits.splice(event.from, 1)[0];
    benefits.splice(event.to, 0, movedItem);
    this.benefits.set(benefits);
    this.planForm().patchValue({ plan_benefits: benefits.map((b) => b.text) });
    event.complete();
  }
}
