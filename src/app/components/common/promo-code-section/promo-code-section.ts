import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { PromoValidationState, PromoCodeSectionStateChange, PromoCodeSectionState, PromoLike, TicketLike } from '@/interfaces/event';

@Component({
  selector: 'promo-code-section',
  templateUrl: './promo-code-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonIcon]
})
export class PromoCodeSectionComponent {
  promoCodes = input<unknown[]>([]);
  tickets = input<unknown[]>([]);

  promoInputValue = input<string>('');
  promoCode = input<string>('');
  appliedPromoCode = input<unknown | null>(null);
  discountAmount = input<number>(0);
  promoValidation = input.required<PromoValidationState>();

  promoStateChange = output<PromoCodeSectionStateChange>();

  promoInput = signal<string>('');

  constructor() {
    effect(() => {
      const parentValue = this.promoInputValue();
      const code = this.promoCode();
      if (code && parentValue && parentValue !== this.promoInput()) {
        this.promoInput.set(parentValue);
      }
    });

    effect(() => {
      const code = this.promoCode();
      const appliedPromo = this.appliedPromoCode();
      if (!code || !appliedPromo) return;

      const promo = appliedPromo as PromoLike;
      const next = this.validatePromoCode(code, promo);

      if (this.shouldEmitRevalidate(next)) {
        this.promoStateChange.emit({ reason: 'revalidate', state: next });
      }
    });
  }

  isPromoApplied = computed(() => {
    const code = this.promoCode();
    const validation = this.promoValidation();
    return !!code && validation.isValid;
  });

  applyButtonDisabled = computed(() => {
    if (this.isPromoApplied()) return false;
    const inputValue = this.promoInput();
    return !inputValue || inputValue.trim().length === 0;
  });

  onPromoCodeChange(value: string): void {
    const upperValue = value.toUpperCase();
    this.promoInput.set(upperValue);

    this.promoStateChange.emit({
      reason: 'input',
      state: {
        promoInput: upperValue,
        promoCode: '',
        appliedPromoCode: null,
        discountAmount: 0,
        promoValidation: { isValid: false, message: '', discountAmount: 0 }
      }
    });
  }

  onPromoButtonClick(): void {
    if (this.isPromoApplied()) {
      this.clearPromoCode();
      return;
    }
    this.applyPromoCode();
  }

  private applyPromoCode(): void {
    const code = this.promoInput().trim().toUpperCase();
    const promoCodes = Array.isArray(this.promoCodes()) ? (this.promoCodes() as PromoLike[]) : [];

    const foundPromo = promoCodes.find((promo) => {
      const promoCodeValue = (promo.promo_code || promo.promoCode || '') as string;
      return promoCodeValue.toUpperCase() === code;
    });

    if (!foundPromo) {
      this.setPromoError(code, 'Invalid promo code');
      return;
    }

    const next = this.validatePromoCode(code, foundPromo);
    this.promoStateChange.emit({ reason: 'apply', state: next });
  }

  private clearPromoCode(): void {
    this.promoInput.set('');
    this.promoStateChange.emit({
      reason: 'remove',
      state: {
        promoInput: '',
        promoCode: '',
        appliedPromoCode: null,
        discountAmount: 0,
        promoValidation: { isValid: false, message: '', discountAmount: 0 }
      }
    });
  }

  private setPromoError(code: string, message: string): void {
    this.promoStateChange.emit({
      reason: 'apply',
      state: {
        promoInput: this.promoInput(),
        promoCode: code,
        appliedPromoCode: null,
        discountAmount: 0,
        promoValidation: { isValid: false, message, discountAmount: 0 }
      }
    });
  }

  private validatePromoCode(promoCodeValue: string, discountObj: PromoLike): PromoCodeSectionState {
    const maxUsePerUser = discountObj.max_uses_per_user && discountObj.max_uses_per_user > 0 ? discountObj.max_uses_per_user : Infinity;

    const redemptionLimit =
      discountObj.available_quantity !== null && discountObj.available_quantity !== undefined ? discountObj.available_quantity : Infinity;

    const paidTicketUnitPricesInCents = this.getPaidTicketUnitPricesInCents();
    const totalPaidTickets = paidTicketUnitPricesInCents.length;

    if (redemptionLimit <= 0) {
      return {
        promoInput: promoCodeValue,
        promoCode: promoCodeValue,
        appliedPromoCode: this.normalizePromo(discountObj),
        discountAmount: 0,
        promoValidation: {
          isValid: false,
          message: 'Promo code has reached its redemption limit',
          discountAmount: 0,
          redemptionLimit
        }
      };
    }

    const totalAmountInCents = paidTicketUnitPricesInCents.reduce((sum, c) => sum + c, 0);

    if (discountObj.capped_amount !== undefined && String(discountObj.capped_amount).trim() !== '') {
      const minOrderAmount = Number(discountObj.capped_amount) * 100;
      if (totalAmountInCents < minOrderAmount) {
        return {
          promoInput: promoCodeValue,
          promoCode: promoCodeValue,
          appliedPromoCode: this.normalizePromo(discountObj),
          discountAmount: 0,
          promoValidation: {
            isValid: false,
            message: `Promo code not applied - minimum order of $${(minOrderAmount / 100).toFixed(2)} required`,
            discountAmount: 0,
            cappedAmount: minOrderAmount
          }
        };
      }
    }

    const eligibleLimit = Math.min(maxUsePerUser, redemptionLimit);
    const eligibleTickets = paidTicketUnitPricesInCents.slice(0, eligibleLimit);
    const eligibleTicketCount = eligibleTickets.length;
    const eligibleAmountInCents = eligibleTickets.reduce((sum, c) => sum + c, 0);

    const promoType = (discountObj.promotion_type || discountObj.type || '') as string;
    const promoValueRaw = (discountObj.promoPresent ?? discountObj.value ?? 0) as number | string;

    let discountAmountInCents = 0;

    if (promoType === 'percentage' || promoType === 'Percentage') {
      const percentage = Number.parseFloat(String(promoValueRaw)) || 0;
      discountAmountInCents = Math.round(eligibleAmountInCents * (percentage / 100));

      if (discountObj.capped_amount !== undefined && String(discountObj.capped_amount).trim() !== '') {
        const cap = Number(discountObj.capped_amount);
        if (cap > 0) discountAmountInCents = Math.min(discountAmountInCents, cap * 100);
      }
    } else if (promoType === 'fixed' || promoType === 'Fixed') {
      const fixed = Number(promoValueRaw) || 0;
      discountAmountInCents = Math.min(fixed * 100, eligibleAmountInCents);
    }

    const discountInDollars = discountAmountInCents / 100;
    const isFullyFree = discountAmountInCents >= eligibleAmountInCents;

    let message: string;
    if (isFullyFree) {
      message =
        eligibleTicketCount < totalPaidTickets
          ? `Your ${eligibleTicketCount} ticket${eligibleTicketCount > 1 ? 's are' : ' is'} free! (applied on ${eligibleTicketCount} ticket${eligibleTicketCount > 1 ? 's' : ''})`
          : `Your ticket${eligibleTicketCount > 1 ? 's are' : ' is'} free!`;
    } else if (discountInDollars > 0) {
      message =
        eligibleTicketCount < totalPaidTickets
          ? `You saved $${discountInDollars.toFixed(2)} (applied on ${eligibleTicketCount} ticket${eligibleTicketCount > 1 ? 's' : ''})`
          : `You saved $${discountInDollars.toFixed(2)}`;
    } else {
      message = 'Promo code applied';
    }

    return {
      promoInput: promoCodeValue,
      promoCode: promoCodeValue,
      appliedPromoCode: this.normalizePromo(discountObj, promoType, promoValueRaw),
      discountAmount: discountInDollars,
      promoValidation: {
        isValid: true,
        message,
        discountAmount: discountInDollars,
        redemptionLimit,
        maxUsePerUser,
        eligibleTicketCount
      }
    };
  }

  private getPaidTicketUnitPricesInCents(): number[] {
    const tickets = Array.isArray(this.tickets()) ? (this.tickets() as TicketLike[]) : [];
    const unitPrices: number[] = [];

    tickets.forEach((ticket) => {
      const quantity = ticket.selectedQuantity ?? 0;
      if (quantity <= 0) return;
      const priceInCents = Math.round((Number(ticket.price) || 0) * 100);
      if (priceInCents <= 0) return;
      for (let i = 0; i < quantity; i++) unitPrices.push(priceInCents);
    });

    return unitPrices;
  }

  private normalizePromo(promo: PromoLike, promoType?: string, promoValue?: number | string): PromoLike {
    return {
      ...promo,
      promoCode: (promo.promo_code || promo.promoCode || '') as string,
      promotion_type: promoType ?? ((promo.promotion_type || promo.type || '') as string),
      value: promoValue ?? promo.promoPresent ?? promo.value
    };
  }

  private shouldEmitRevalidate(next: PromoCodeSectionState): boolean {
    const cur = this.promoValidation();
    const curDisc = this.discountAmount();
    return (
      cur.isValid !== next.promoValidation.isValid ||
      cur.message !== next.promoValidation.message ||
      curDisc !== next.discountAmount ||
      (cur.eligibleTicketCount ?? 0) !== (next.promoValidation.eligibleTicketCount ?? 0)
    );
  }
}
