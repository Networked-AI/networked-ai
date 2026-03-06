import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Chip } from '@/components/common/chip';
import { Button } from '@/components/form/button';
import { InputTextModule } from 'primeng/inputtext';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ModalService } from '@/services/modal.service';
import { TextInput } from '@/components/form/text-input';
import { NumberInput } from '@/components/form/number-input';
import { ToasterService } from '@/services/toaster.service';
import { ToggleInput } from '@/components/form/toggle-input';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TextAreaInput } from '@/components/form/text-area-input';
import { DescriptionGeneratorService } from '@/services/description-generator.service';
import { IonReorderGroup, IonReorder, ItemReorderEventDetail } from '@ionic/angular/standalone';
import { Component, input, output, computed, signal, ChangeDetectionStrategy, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { BaseApiService } from '@/services/base-api.service';

export interface Benefit {
  id: string;
  text: string;
}

@Component({
  selector: 'app-plan-details-form',
  imports: [
    Chip,
    Button,
    TextInput,
    NumberInput,
    IonReorder,
    ToggleInput,
    CommonModule,
    TextAreaInput,
    InputTextModule,
    IonReorderGroup,
    RadioButtonModule,
    ReactiveFormsModule
  ],
  styleUrl: './plan-details-form.scss',
  templateUrl: './plan-details-form.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanDetailsForm implements OnInit, OnDestroy {
  descriptionGeneratorService = inject(DescriptionGeneratorService);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);
  cdr = inject(ChangeDetectorRef);
  conversation = signal<any[]>([]);
  // Inputs
  planForm = input.required<FormGroup<any>>();
  benefits = input.required<Benefit[]>();
  isSponsorPlan = input<boolean>(true);
  benefitErrors = input<Set<string>>(new Set());
  SPONSOR_GRADIENT =
    'radial-gradient(161.73% 107.14% at 9.38% -7.14%, #F9F2E6 13.46%, #F4D7A9 38.63%, rgba(201, 164, 105, 0.94) 69.52%, #BF9E69 88.87%, rgba(195, 167, 121, 0.9) 100%)';

  // Local signals
  nameValue = signal<string>('');
  monthlyPriceValue = signal<number>(0);
  discountValue = signal<number>(0);
  discountType = signal<'percentage' | 'fixed'>('percentage');
  showDescriptionEditor = signal<boolean>(false);
  isGeneratingDescription = signal<boolean>(false);

  private subscriptions = new Subscription();

  // Outputs
  benefitAdded = output<void>();
  benefitRemoved = output<number>();
  benefitUpdated = output<{ index: number; text: string }>();
  benefitsReordered = output<ItemReorderEventDetail>();
  isCustomize = computed(() => this.showDescriptionEditor());
  discountChanged = output<number>();
  discountTypeChanged = output<'percentage' | 'fixed'>();

  // Computed properties
  isAnnualSubscriptionEnabled = computed(() => {
    const name = this.nameValue();
    const monthlyPrice = this.monthlyPriceValue();
    const nameValid = name && name.trim().length > 0;
    const priceValid = monthlyPrice > 0;
    return nameValid && priceValid;
  });

  annualBasePrice = computed(() => {
    return this.monthlyPriceValue() * 12;
  });

  annualPrice = computed(() => {
    const base = this.annualBasePrice();
    const discount = (base * this.discountValue()) / 100;
    return base - discount;
  });

  amountSaved = computed(() => {
    return this.annualBasePrice() - this.annualPrice();
  });

  discountPercentage = computed(() => {
    return this.discountValue();
  });

  bannerColors = computed(() => {
    const isSponsor = this.isSponsorPlan();
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

  ngOnInit(): void {
    // Initialize values from form
    const form = this.planForm();
    if (form) {
      const name = form.get('name')?.value || '';
      const monthlyPrice = form.get('monthlyPrice')?.value || 0;
      const discountPercentage = form.get('discountPercentage')?.value || 10;
      const discountType = form.get('discountType')?.value || 'percentage';

      this.nameValue.set(name);
      this.monthlyPriceValue.set(monthlyPrice);
      this.discountValue.set(discountPercentage);
      this.discountType.set(discountType);

      // Subscribe to form value changes
      const nameSub = form.get('name')?.valueChanges.subscribe((value) => {
        this.nameValue.set(value || '');
      });

      const priceSub = form.get('monthlyPrice')?.valueChanges.subscribe((value) => {
        this.monthlyPriceValue.set(value || 0);
      });

      const discountSub = form.get('discountPercentage')?.valueChanges.subscribe((value) => {
        this.discountValue.set(value || 0);
        this.discountChanged.emit(value || 0);
      });

      const discountTypeSub = form.get('discountType')?.valueChanges.subscribe((value) => {
        if (value === 'percentage' || value === 'fixed') {
          this.discountType.set(value);
          this.discountTypeChanged.emit(value);
        }
      });

      if (nameSub) this.subscriptions.add(nameSub);
      if (priceSub) this.subscriptions.add(priceSub);
      if (discountSub) this.subscriptions.add(discountSub);
      if (discountTypeSub) this.subscriptions.add(discountTypeSub);
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  getFieldValue(fieldName: string): any {
    return this.planForm().get(fieldName)?.value;
  }

  addBenefit(): void {
    this.benefitAdded.emit();
  }

  removeBenefit(index: number): void {
    this.benefitRemoved.emit(index);
  }

  updateBenefit(index: number, text: string): void {
    this.benefitUpdated.emit({ index, text });
  }

  reorderBenefits(event: ItemReorderEventDetail): void {
    this.benefitsReordered.emit(event);
  }

  setDiscount(percentage: number): void {
    this.planForm().patchValue({ discountPercentage: percentage });
    this.discountValue.set(percentage);
    this.discountChanged.emit(percentage);
  }

  handleGenerateClick(): void {
    if (this.showDescriptionEditor()) {
      this.openAIPromptModal();
    } else {
      this.generateDescription();
    }
  }

  async generateDescription(): Promise<void> {
    if (this.isGeneratingDescription()) return;

    const form = this.planForm();
    const descriptionControl = form.get('description');

    if (!descriptionControl) return;

    try {
      this.isGeneratingDescription.set(true);

      // Get form values
      const formValue = form.getRawValue();
      const planBenefits = this.benefits()
        .map((b) => b.text)
        .filter((text) => text && text.trim() !== '');

      // Generate description using the service
      const generatedDescription = await this.descriptionGeneratorService.generateSubscriptionPlanDescription({
        name: formValue.name || undefined,
        monthlyPrice: formValue.monthlyPrice || undefined,
        isSponsor: formValue.is_sponsor ?? true,
        planBenefits: planBenefits.length > 0 ? planBenefits : undefined,
        annualPrice: formValue.annualPrice || undefined
      });

      descriptionControl.setValue(generatedDescription);
      descriptionControl.markAsTouched();
      this.showDescriptionEditor.set(true);
      this.cdr.markForCheck();
    } catch (error: any) {
      console.error('Error generating description:', error);
      const msg = BaseApiService.getErrorMessage(error, 'Failed to generate description. Please try again.');
      this.toasterService.showError(msg);
    } finally {
      this.isGeneratingDescription.set(false);
    }
  }

  async openAIPromptModal(): Promise<void> {
    const data = await this.modalService.openAIPromptModal(this.conversation());

    if (data) {
      if (data.type === 'value' && data.data) {
        const form = this.planForm();
        const descriptionControl = form.get('description');
        if (descriptionControl) {
          descriptionControl.setValue(data.data);
          descriptionControl.markAsTouched();
        }
      } else if (data.type === 'data' && data.data) {
        this.conversation.set(data.data);
      }
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

  hasBenefitError(benefitId: string): boolean {
    return this.benefitErrors().has(benefitId);
  }
}
