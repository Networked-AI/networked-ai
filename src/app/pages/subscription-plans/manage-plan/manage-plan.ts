import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { NavigationService } from '@/services/navigation.service';
import { SubscriptionService } from '@/services/subscription.service';
import { PlanAnalytics } from '@/pages/subscription-plans/components/plan-analytics';
import { SegmentButton, SegmentButtonItem } from '@/components/common/segment-button';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlanDetailsForm } from '@/pages/subscription-plans/components/plan-details-form';
import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { IonHeader, IonToolbar, IonContent, IonFooter, ItemReorderEventDetail, LoadingController } from '@ionic/angular/standalone';
import { BaseApiService } from '@/services/base-api.service';
import { PlanAnalyticsData } from '@/interfaces/ISubscripton';

@Component({
  selector: 'app-manage-plan',
  styleUrl: './manage-plan.scss',
  templateUrl: './manage-plan.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, CommonModule, SegmentButton, PlanDetailsForm, PlanAnalytics, ReactiveFormsModule, IonHeader, IonToolbar, IonContent, IonFooter]
})
export class ManagePlan implements OnInit {
  SPONSOR_GRADIENT =
    'radial-gradient(161.73% 107.14% at 9.38% -7.14%, #F9F2E6 13.46%, #F4D7A9 38.63%, rgba(201, 164, 105, 0.94) 69.52%, #BF9E69 88.87%, rgba(195, 167, 121, 0.9) 100%)';

  route = inject(ActivatedRoute);
  navigationService = inject(NavigationService);
  fb = inject(FormBuilder);
  subscriptionService = inject(SubscriptionService);
  toasterService = inject(ToasterService);
  modalService = inject(ModalService);
  loadingCtrl = inject(LoadingController);

  planId = signal<string | null>(null);
  planData = signal<any>(null);
  planName = signal<string>('');
  tabValue = signal<'details' | 'analytics'>('details');
  isSaving = signal<boolean>(false);
  isGeneratingDescription = signal<boolean>(false);
  isCustomize = signal<boolean>(false);
  isSponsor = signal<boolean>(true);
  isLoading = signal<boolean>(true);
  analyticsData = signal<PlanAnalyticsData | null>(null);

  benefits = signal<Array<{ id: string; text: string }>>([]);

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
      is_sponsor: this.fb.control<boolean | null>(true, [Validators.required])
    })
  );

  tabItems: SegmentButtonItem[] = [
    { value: 'details', label: 'Details' },
    { value: 'analytics', label: 'Analytics' }
  ];

  buttonColor = computed(() => {
    const isSponsor = this.route.snapshot.queryParams['is_sponsor'] === 'true';
    return !isSponsor ? '#2B5BDE' : undefined;
  });

  async ngOnInit(): Promise<void> {
    const planId = this.route.snapshot.paramMap.get('planId');
    if (planId) {
      this.planId.set(planId);
      await this.loadPlanData(planId);
    }
  }

  async loadPlanData(planId: string): Promise<void> {
    const loading = await this.loadingCtrl.create({
      mode: 'md'
    });
    await loading.present();
    try {
      const planData = await this.subscriptionService.getPlanById(planId);
      if (!planData) {
        return;
      }

      this.loadAnalyticsData(planData.id!);

      this.planData.set(planData);
      this.planName.set(planData.name || '');

      const form = this.planForm();
      const isSponsorValue = planData.is_sponsor ?? false;
      form.patchValue({
        name: planData.name || '',
        description: planData.description || '',
        is_sponsor: isSponsorValue
      });

      // Update the signal so computed properties react
      this.isSponsor.set(isSponsorValue);

      const prices = planData.prices || [];
      const monthlyPrice = prices.find((p: any) => p.interval === 'month');
      const yearlyPrice = prices.find((p: any) => p.interval === 'year');

      if (monthlyPrice) {
        const monthlyAmount = parseFloat(monthlyPrice.amount) || 0;
        form.patchValue({ monthlyPrice: monthlyAmount });
      }

      if (monthlyPrice && yearlyPrice) {
        const monthlyAmount = parseFloat(monthlyPrice.amount) || 0;
        const yearlyAmount = parseFloat(yearlyPrice.amount) || 0;
        const annualBase = monthlyAmount * 12;
        const discount = annualBase - yearlyAmount;
        const discountPercentage = annualBase > 0 ? (discount / annualBase) * 100 : 0;

        const bannerDisplayType = yearlyPrice.banner_display_type;
        const formDiscountType: 'percentage' | 'fixed' = bannerDisplayType === 'fixed' ? 'fixed' : 'percentage';

        form.patchValue({
          annualSubscription: true,
          annualPrice: yearlyAmount,
          discountPercentage: Math.round(discountPercentage),
          discountType: formDiscountType
        });
      }

      const planBenefits = planData.plan_benefits || [];
      if (planBenefits.length > 0) {
        const benefitsArray = planBenefits.map((text: string, index: number) => ({
          id: (index + 1).toString(),
          text: text
        }));
        while (benefitsArray.length < 2) {
          benefitsArray.push({
            id: (benefitsArray.length + 1).toString(),
            text: ''
          });
        }
        this.benefits.set(benefitsArray);
        form.patchValue({ plan_benefits: planBenefits });
      }
    } catch (error) {
      console.error('Error loading plan data:', error);
      this.navigationService.back();
      this.toasterService.showError('Failed to load plan data');
    } finally {
      await loading.dismiss();
    }
  }

  async loadAnalyticsData(planId: string): Promise<void> {
    try {
      this.isLoading.set(true);
      const response = await this.subscriptionService.getPlanAnalytics(planId);
      this.analyticsData.set(response.data);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      this.toasterService.showError(BaseApiService.getErrorMessage(error, 'Failed to load analytics data'));
    } finally {
      this.isLoading.set(false);
    }
  }

  onTabChange(value: string): void {
    if (value === 'details' || value === 'analytics') {
      this.tabValue.set(value);
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
    updated[index] = { ...updated[index], text };
    this.benefits.set(updated);
    this.planForm().patchValue({ plan_benefits: updated.map((b) => b.text) });
  }

  reorderBenefits(event: ItemReorderEventDetail): void {
    const items = [...this.benefits()];
    const item = items.splice(event.from, 1)[0];
    items.splice(event.to, 0, item);
    this.benefits.set(items);
    this.planForm().patchValue({ plan_benefits: items.map((b) => b.text) });
    event.complete();
  }

  handleGenerateDescription(): void {
    // TODO: Implement description generation
    this.isGeneratingDescription.set(true);
    setTimeout(() => {
      this.isGeneratingDescription.set(false);
    }, 2000);
  }

  async saveChanges(): Promise<void> {
    const form = this.planForm();
    if (!form.valid) {
      form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    try {
      const planData = this.planData();
      if (!planData) return;

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

      const payload = {
        name: form.get('name')?.value,
        description: form.get('description')?.value || '',
        prices,
        is_sponsor: form.get('is_sponsor')?.value ?? false,
        plan_benefits: planBenefits,
        event_ids: planData.event_ids || []
      };

      await this.subscriptionService.updatePlan(planData.id, payload);

      await this.modalService.openConfirmModal({
        icon: 'assets/svg/launch.svg',
        iconBgColor: this.isSponsor() ? this.SPONSOR_GRADIENT : '#2B5BDE',
        title: 'Plan updated successfully',
        description: 'Your plan has been updated successfully',
        confirmButtonLabel: 'Done',
        confirmButtonColor: 'primary',
        shareButtonLabel: 'Share',
        customColor: !this.isSponsor() ? '#2B5BDE' : undefined,
        onShare: async () => {
          await this.modalService.openShareModal(planData.id, 'Plan');
        }
      });

      this.navigationService.back();
    } catch (error) {
      console.error('Error updating plan:', error);
      this.toasterService.showError('Failed to update plan. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }

  back(): void {
    this.navigationService.back();
  }

  navigateToEvents(): void {
    const planId = this.planId();
    if (planId) {
      const planData = this.planData();
      const isSponsor = planData?.is_sponsor ?? false;
      this.navigationService.navigateForward(`/subscription/plan/${planId}/events?is_sponsor=${isSponsor ? 'true' : 'false'}`);
    }
  }
}
