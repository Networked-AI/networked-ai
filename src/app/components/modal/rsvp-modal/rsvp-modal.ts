import { CommonModule } from '@angular/common';
import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { ShowMoreComponent } from '@/components/common/show-more/show-more';
import { PromoCodeSectionStateChange, TicketDisplay } from '@/interfaces/event';
import { createRsvpState, RsvpPromoState, RsvpTicketInput } from '@/utils/rsvp-state';
import { PromoCodeSectionComponent } from '@/components/common/promo-code-section/promo-code-section';
import { IonHeader, IonFooter, IonToolbar, IonIcon, ModalController, IonContent } from '@ionic/angular/standalone';
import { Input, signal, inject, OnInit, computed, Component, OnDestroy, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'rsvp-modal',
  styleUrl: './rsvp-modal.scss',
  templateUrl: './rsvp-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonFooter, IonToolbar, IonHeader, CommonModule, Button, IonIcon, ShowMoreComponent, PromoCodeSectionComponent]
})
export class RsvpModal implements OnInit, OnDestroy {
  @Input() tickets: TicketDisplay[] = [];
  @Input() eventTitle: string = '';
  @Input() eventId: string = '';
  @Input() questionnaire: any = null;
  @Input() promo_codes: any[] = [];
  @Input() plans: any[] = [];
  @Input() date: string = '';
  @Input() location: string = '';
  @Input() hostPaysFees: boolean = false;
  @Input() additionalFees: string | number | null = null;
  @Input() maxAttendeesPerUser: number = 0;
  @Input() hostName: string = '';
  @Input() hasPlans: boolean = false;
  @Input() hasSubscribed: boolean = false;
  @Input() isSubscriberExclusive: boolean = false;
  @Input() participants: Array<{ user_id?: string; user?: { id?: string }; role?: string }> = [];

  modalCtrl = inject(ModalController);
  authService = inject(AuthService);
  modalService = inject(ModalService);
  private toasterService = inject(ToasterService);

  rsvp = createRsvpState({ hostPaysFees: false, additionalFees: null });

  ticketsData = signal<TicketDisplay[]>([]);
  questionnaireResult = signal<any>(null);
  currentTime = signal<Date>(new Date());
  countdownInterval?: any;
  hasShownSponsorPrompt = signal(false);

  totalPrice = computed(() => this.rsvp.totalPrice());
  formattedTotal = computed(() => this.rsvp.formattedTotal());

  isLoggedIn = computed(() => !!this.authService.currentUser());

  hasQuestionnaire = computed(() => this.questionnaire !== null && Array.isArray(this.questionnaire) && this.questionnaire.length > 0);

  hasSponsorPlan = computed(() => this.plans.some((p) => p.is_sponsor === true));
  sponsorPlans = computed(() => this.plans.filter((p) => p.is_sponsor === true));
  hasSubscription = computed(() => this.hasPlans && this.hasSubscribed);

  isSelectedSponsorTicket = computed(() => this.ticketsData().some((t) => (t.selectedQuantity ?? 0) > 0 && t.ticket_type === 'Sponsor'));

  hasSelectedTickets = computed(() => this.ticketsData().some((t) => (t.selectedQuantity ?? 0) > 0));

  totalSelectedTickets = computed(() => this.ticketsData().reduce((s, t) => s + (t.selectedQuantity ?? 0), 0));

  maxAllowedTickets = computed(() => 1 + this.maxAttendeesPerUser);

  hasPaidTickets = computed(() =>
    this.ticketsData().some((t) => {
      const qty = t.selectedQuantity ?? 0;
      return qty > 0 && (parseFloat(String(t.price)) || 0) > 0 && this.getTicketStatus(t) === 'available';
    })
  );

  hasPromoCodes = computed(() => this.promo_codes?.length > 0 && this.hasPaidTickets());

  promoInput = computed(() => this.rsvp.promoState().promoInput);
  promoCode = computed(() => this.rsvp.promoState().promoCode);
  appliedPromoCode = computed(() => this.rsvp.promoState().appliedPromoCode);
  discountAmount = computed(() => this.rsvp.promoState().discountDollars);
  promoValidation = computed(() => ({
    isValid: this.rsvp.promoState().isValid,
    message: this.rsvp.promoState().message,
    discountAmount: this.rsvp.promoState().discountDollars,
    eligibleTicketCount: this.rsvp.promoState().eligibleTicketCount
  }));

  SPONSOR_GRADIENT =
    'radial-gradient(161.73% 107.14% at 9.38% -7.14%, #F9F2E6 13.46%, #F4D7A9 38.63%, rgba(201, 164, 105, 0.94) 69.52%, #BF9E69 88.87%, rgba(195, 167, 121, 0.9) 100%)';

  isTicketFreeForSubscriber = (ticket: TicketDisplay): boolean => {
    const s = this.rsvp.summary();
    const tier = s.tiers.find((t) => t.ticketId === String(ticket.id));
    return (tier?.freeSubscriptionCount ?? 0) > 0;
  };

  getFreeTicketCount = (ticket: TicketDisplay): number => {
    const s = this.rsvp.summary();
    return s.tiers.find((t) => t.ticketId === String(ticket.id))?.freeSubscriptionCount ?? 0;
  };

  ngOnInit(): void {
    // Configure rsvp state
    this.rsvp.setFeeConfig({ hostPaysFees: this.hostPaysFees, additionalFees: this.additionalFees });
    this.rsvp.setSubscribed(this.hasSubscribed);
    this.rsvp.setCurrentUserId(this.authService.currentUser()?.id ?? null);

    const ticketsToInitialize: TicketDisplay[] = (this.tickets ?? []).map((ticket: any) => ({
      ...ticket,
      available_quantity: ticket.available_quantity,
      selectedQuantity: ticket.selectedQuantity ?? 0,
      sales_start_date: ticket.sales_start_date,
      sales_end_date: ticket.sales_end_date,
      status: 'available'
    }));

    this.ticketsData.set(ticketsToInitialize);
    this._syncTicketsToState();
    this.startTimeUpdate();
  }

  canDecrement(ticket: TicketDisplay): boolean {
    return (ticket.selectedQuantity ?? 0) > 0;
  }

  canIncrement(ticket: TicketDisplay): boolean {
    if (this.isSubscriberExclusive && (ticket.selectedQuantity ?? 0) >= 1) return false;
    if (ticket.available_quantity !== undefined && (ticket.selectedQuantity ?? 0) >= ticket.available_quantity) return false;
    return this.totalSelectedTickets() < this.maxAllowedTickets();
  }

  decrementQuantity(ticket: TicketDisplay): void {
    if (!this.canDecrement(ticket)) return;
    this._updateTicketQty(ticket, -1);
  }

  incrementQuantity(ticket: TicketDisplay): void {
    if (this.isSubscriberExclusive && (ticket.selectedQuantity ?? 0) >= 1) return;
    if (!this.canIncrement(ticket)) return;
    this._updateTicketQty(ticket, +1);
  }

  private _updateTicketQty(ticket: TicketDisplay, delta: number): void {
    const list = this.ticketsData();
    const idx = list.findIndex((t) => t.id === ticket.id);
    if (idx === -1) return;

    const updated = [...list];
    const newQty = Math.max(0, (updated[idx].selectedQuantity ?? 0) + delta);
    updated[idx] = { ...updated[idx], selectedQuantity: newQty };
    this.ticketsData.set(updated);
    this._syncTicketsToState();
  }

  private _syncTicketsToState(): void {
    const inputs: RsvpTicketInput[] = this.ticketsData().map((t) => ({
      id: String(t.id),
      name: t.name,
      price: t.price,
      ticket_type: t.ticket_type,
      selectedQuantity: t.selectedQuantity ?? 0,
      available_quantity: t.available_quantity
    }));
    this.rsvp.setTickets(inputs);
  }

  onPromoStateChange(change: PromoCodeSectionStateChange): void {
    const { state } = change;
    if (!state.promoCode && !state.promoValidation.isValid) {
      this.rsvp.clearPromo();
      return;
    }
    const promoState: RsvpPromoState = {
      promoInput: state.promoInput,
      promoCode: state.promoCode,
      appliedPromoCode: state.appliedPromoCode,
      promoId: (state.appliedPromoCode as any)?.id ?? null,
      discountDollars: state.discountAmount,
      eligibleTicketCount: state.promoValidation.eligibleTicketCount ?? 0,
      isValid: state.promoValidation.isValid,
      message: state.promoValidation.message
    };
    this.rsvp.applyPromo(promoState);
  }

  startTimeUpdate(): void {
    this.countdownInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  getTicketStatus = (ticket: TicketDisplay): 'sale-ended' | 'available' | 'sold-out' | 'upcoming' => {
    this.currentTime();
    const now = this.currentTime();
    const saleStartDate = ticket.sales_start_date;
    const saleEndDate = ticket.sales_end_date;
    const availableQuantity = ticket.available_quantity;

    if (availableQuantity !== null && availableQuantity !== undefined && availableQuantity <= 0) {
      return 'sold-out';
    }

    if (saleEndDate) {
      const endDate = new Date(saleEndDate);
      if (now > endDate) {
        return 'sale-ended';
      }
    }

    if (saleStartDate) {
      const startDate = new Date(saleStartDate);
      if (now < startDate) {
        return 'upcoming';
      }
    }

    return 'available';
  };

  getTicketCountdown = (ticket: TicketDisplay): string => {
    this.currentTime();
    const saleStartDate = ticket.sales_start_date;
    if (!saleStartDate) return '';

    const now = this.currentTime();
    const startDate = new Date(saleStartDate);
    const diff = startDate.getTime() - now.getTime();

    if (diff <= 0) return '';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    const parts: string[] = [];
    if (days > 0) {
      parts.push(`${days}d`);
    }
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0 && days === 0) {
      parts.push(`${minutes} min`);
    }
    if (seconds > 0 && days === 0 && hours === 0) {
      parts.push(`${seconds} sec`);
    }

    return parts.length > 0 ? parts.join(' ') : '0 sec';
  };

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'sale-ended':
        return 'border border-surface-300 ';
      case 'sold-out':
        return 'border accent-red ';
      case 'upcoming':
        return 'border border-surface-300 ';
      default:
        return '';
    }
  }

  getStatusIconClass(status: string): string {
    switch (status) {
      case 'sale-ended':
        return 'neutral-02';
      case 'sold-out':
        return 'accent-red';
      case 'upcoming':
        return 'neutral-02';
      default:
        return 'neutral-02';
    }
  }

  getStatusText(ticket: TicketDisplay): string {
    const status = this.getTicketStatus(ticket);
    switch (status) {
      case 'sale-ended':
        return 'Sale Ended';
      case 'sold-out':
        return 'Sold Out';
      case 'upcoming':
        const countdown = this.getTicketCountdown(ticket);
        return countdown ? `Starts in ${countdown}` : 'Upcoming';
      default:
        return '';
    }
  }

  async openStripePayoutModal(): Promise<void> {
    const prices = this.sponsorPlans()[0]?.prices || [];
    let title = 'Subscribe as a Sponsor!';
    let description = "Subscribe to the host's events as a sponsor.";
    if (prices.length > 1) {
      const yearly = prices.find((p: any) => p.interval === 'year');
      const monthly = prices.find((p: any) => p.interval === 'month');
      if (yearly?.banner_display_type === 'percentage' && yearly.discount_percentage) {
        const d = Number(yearly.discount_percentage);
        title = `Save ${d}% by Subscribing as a Sponsor!`;
        description = `Subscribe and save up to ${d}% annually.`;
      } else if (yearly?.banner_display_type === 'fixed' && monthly) {
        const d = Math.round(monthly.amount * 12 - yearly.amount);
        title = `Save $${d} by Subscribing as a Sponsor!`;
        description = `Subscribe and save $${d} annually.`;
      }
    }
    await this.modalService.openConfirmModal({
      icon: '/assets/svg/subscription/sponsorIcon.svg',
      iconBgColor: this.SPONSOR_GRADIENT,
      title,
      description,
      confirmButtonLabel: 'See Plans',
      cancelButtonLabel: 'Not Now',
      confirmButtonColor: 'primary',
      iconPosition: 'center',
      onConfirm: async () => {
        const loginResult = await this.ensureLoggedIn();
        if (loginResult?.success) {
          await this.navigateToSubscriptionPlans();
          await this.modalCtrl.dismiss();
        }
      }
    });
  }

  async navigateToSubscriptionPlans(): Promise<void> {
    if (this.sponsorPlans()?.length) {
      await this.modalService.openSubscriptionModal(this.sponsorPlans()[0].id);
    }
  }

  private isCurrentUserHostOrCoHost(): boolean {
    const user = this.authService.currentUser();
    if (!user?.id || !this.participants?.length) return false;
    return this.participants.some((p) => {
      const uid = p.user_id ?? p.user?.id;
      const role = (p.role ?? '').toLowerCase();
      return uid === user.id && (role === 'host' || role === 'cohost');
    });
  }

  private async ensureLoggedIn(): Promise<{ success: boolean; isNewUser?: boolean } | null> {
    if (this.authService.getCurrentToken()) return { success: true };
    return await this.modalService.openLoginModal();
  }

  async onSignInClick(): Promise<void> {
    await this.modalService.openLoginModal();
  }

  async dismiss(): Promise<void> {
    const isLoggedIn = !!this.authService.getCurrentToken();
    const loginResult = isLoggedIn ? await this.ensureLoggedIn() : { success: true };
    if (isLoggedIn && !loginResult?.success) return;

    if (isLoggedIn && this.isCurrentUserHostOrCoHost()) {
      this.toasterService.showError('You are the host or co-host. You cannot RSVP as a guest.');
      return;
    }

    if (this.hasSponsorPlan() && !this.hasSubscribed && this.isSelectedSponsorTicket() && !this.hasShownSponsorPrompt()) {
      this.hasShownSponsorPrompt.set(true);
      await this.openStripePayoutModal();
    }

    const selectedTickets = this.ticketsData().filter((t) => (t.selectedQuantity ?? 0) > 0);

    // Build rsvpData for details modal
    const rsvpData = this.rsvp.getRsvpDataPayload({
      promoCodes: this.promo_codes,
      eventTickets: selectedTickets as unknown as RsvpTicketInput[],
      hasSubscribed: this.hasSubscribed, // ← ADD
      freeTicketId: this.rsvp.freeTicketId() // ← ADD (or expose via getter)
    });

    // Questionnaire
    if (this.hasQuestionnaire() && !this.questionnaireResult()) {
      const preEvent = (this.questionnaire as any[]).filter((q) => !q.event_phase || q.event_phase === 'PreEvent');
      if (preEvent.length > 0) {
        this.questionnaireResult.set(await this.modalService.openQuestionnairePreviewModal(preEvent, false));
        if (!this.questionnaireResult()) return;
      }
    }

    const rsvpConfirmData = await this.modalService.openRsvpDetailsModal(
      this.eventTitle,
      this.date,
      this.location,
      this.eventId,
      rsvpData,
      this.hostPaysFees,
      this.additionalFees,
      this.hostName,
      !this.authService.getCurrentToken()
    );

    if (!rsvpConfirmData) return;

    // Sync promo state back from details modal
    this._syncPromoFromConfirm(rsvpConfirmData);
    this.rsvp.setCurrentUserId(this.authService.currentUser()?.id ?? null);

    // Apply names from confirmation form to attendees
    const namedAttendees = this.rsvp.applyAttendeeDetails(
      rsvpConfirmData.yourDetails,
      rsvpConfirmData.guestDetails,
      this.authService.currentUser()?.name ?? ''
    );

    const result = {
      ...rsvpConfirmData,
      questionnaireResult: this.questionnaireResult(),
      event_id: this.eventId,
      attendees: namedAttendees,
      stripe_payment_intent_id: rsvpConfirmData?.stripePaymentIntentId ?? null,
      isNewUser: rsvpConfirmData?.isNewUser ?? (loginResult as any)?.isNewUser ?? false
    };

    await this.modalCtrl.dismiss(result);
    this.modalService.close();
  }

  private _syncPromoFromConfirm(rsvpConfirmData: any): void {
    const discount = Number(rsvpConfirmData.discountAmount ?? 0);
    const applied = rsvpConfirmData.appliedPromoCode ?? null;
    const validation = rsvpConfirmData.promoValidation ?? null;
    const inputRaw = rsvpConfirmData.promoInput ?? '';
    const codeRaw = rsvpConfirmData.promo_code || inputRaw || applied?.promoCode || applied?.promo_code || '';
    const code = (codeRaw || '').toString().trim().toUpperCase();
    const input = (inputRaw || '').toString().trim().toUpperCase();
    const hasSignal = !!(code || input || applied);

    if (!hasSignal) {
      this.rsvp.clearPromo();
      return;
    }

    this.rsvp.applyPromo({
      promoInput: input || code,
      promoCode: code,
      appliedPromoCode: applied,
      promoId: applied?.id ?? null,
      discountDollars: discount,
      eligibleTicketCount: validation?.eligibleTicketCount ?? 0,
      isValid: discount > 0 && !!applied,
      message: validation?.message ?? (discount > 0 ? `You saved $${discount.toFixed(2)}` : '')
    });
  }

  async close(): Promise<void> {
    await this.modalCtrl.dismiss();
    this.modalService.close();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }
}
