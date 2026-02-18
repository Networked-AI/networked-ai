import { CommonModule } from '@angular/common';
import { Button } from '@/components/form/button';
import { TicketDisplay } from '@/interfaces/event';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { IonHeader, IonFooter, IonToolbar, IonIcon, ModalController, IonContent } from '@ionic/angular/standalone';
import { Input, signal, inject, OnInit, effect, computed, Component, OnDestroy, untracked, ChangeDetectionStrategy } from '@angular/core';
import { NavigationService } from '@/services/navigation.service';

@Component({
  selector: 'rsvp-modal',
  styleUrl: './rsvp-modal.scss',
  templateUrl: './rsvp-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonFooter, IonToolbar, IonHeader, CommonModule, Button, IonIcon]
})
export class RsvpModal implements OnInit, OnDestroy {
  @Input() tickets: TicketDisplay[] = [];
  @Input() eventTitle: string = 'Atlanta Makes Me Laugh';
  @Input() eventId: string = '';
  @Input() questionnaire: any = null;
  @Input() promo_codes: any[] = [];
  @Input() plans: any[] = [];
  @Input() date: string = '';
  @Input() location: string = '';
  @Input() hostPaysFees: boolean = false;
  @Input() additionalFees: string | number | null = null;
  @Input() maxAttendeesPerUser: number = 0;
  @Input() hostName: string = 'Networked AI';
  @Input() hasPlans: boolean = false;
  @Input() hasSubscribed: boolean = false;
  @Input() isSubscriberExclusive: boolean = false;
  @Input() participants: Array<{ user_id?: string; user?: { id?: string }; role?: string }> = [];

  modalCtrl = inject(ModalController);
  authService = inject(AuthService);
  modalService = inject(ModalService);
  private toasterService = inject(ToasterService);

  promoCode = signal<string>('');
  promoInput = signal<string>('');
  discountAmount = signal<number>(0);
  appliedPromoCode = signal<any>(null);
  promoValidation = signal<{
    isValid: boolean;
    message: string;
    discountAmount: number;
    cappedAmount?: number;
    redemptionLimit?: number;
    maxUsePerUser?: number;
    currentRedemptions?: number;
    userRedemptions?: number;
    eligibleTicketCount?: number;
  }>({
    isValid: false,
    message: '',
    discountAmount: 0
  });
  ticketsData = signal<TicketDisplay[]>([]);
  questionnaireResult = signal<any>(null);
  currentTime = signal<Date>(new Date());
  countdownInterval?: any;
  attendees = signal<any[]>([]);
  hasShownSponsorPrompt = signal(false);
  // Tier-specific calculation signals (in cents)
  totalsByTier = signal<{ [key: string]: number }>({});
  platformFeesByTier = signal<{ [key: string]: number }>({});
  hostFeesByTier = signal<{ [key: string]: number }>({});
  ticketPricesByTier = signal<{ [key: string]: number }>({});
  actualPricesByTier = signal<{ [key: string]: number }>({});
  discountAmountsByTier = signal<{ [key: string]: number }>({});

  SPONSOR_GRADIENT =
    'radial-gradient(161.73% 107.14% at 9.38% -7.14%, #F9F2E6 13.46%, #F4D7A9 38.63%, rgba(201, 164, 105, 0.94) 69.52%, #BF9E69 88.87%, rgba(195, 167, 121, 0.9) 100%)';

  // Track the first paid ticket ID that was selected (for free subscription benefit)
  firstSelectedPaidTicketId = signal<string | null>(null);

  isLoggedIn = computed(() => !!this.authService.currentUser());
  hasQuestionnaire = computed(() => {
    return this.questionnaire !== null && this.questionnaire !== undefined && Array.isArray(this.questionnaire) && this.questionnaire.length > 0;
  });

  hasSponsorPlan = computed(() => {
    return this.plans.some((plan) => plan.is_sponsor === true);
  });

  sponsorPlans = computed(() => {
    return this.plans.filter((plan) => plan.is_sponsor === true);
  });

  hasSubscription = computed(() => {
    return this.hasPlans && this.hasSubscribed;
  });

  isSelectedSponsorTicket = computed(() => {
    return this.ticketsData().some((ticket) => (ticket.selectedQuantity ?? 0) > 0 && ticket.ticket_type === 'Sponsor');
  });

  // Check if a ticket is eligible for free subscription benefit
  isTicketFreeForSubscriber = (ticket: TicketDisplay): boolean => {
    if (!this.hasSubscribed || ticket.price <= 0) return false;

    const firstPaidTicketId = this.firstSelectedPaidTicketId();

    // If we haven't tracked a first paid ticket yet, find it
    if (!firstPaidTicketId) {
      const selectedPaidTickets = this.ticketsData().filter((t) => {
        const quantity = t.selectedQuantity ?? 0;
        return t.price > 0 && quantity > 0;
      });

      if (selectedPaidTickets.length === 0) return false;

      // Set the first paid ticket ID
      const firstSelectedPaidTicket = selectedPaidTickets[0];
      this.firstSelectedPaidTicketId.set(String(firstSelectedPaidTicket.id));
      return ticket.id === firstSelectedPaidTicket.id;
    }

    // Always use the tracked first paid ticket ID
    return String(ticket.id) === firstPaidTicketId;
  };

  // Get the number of free tickets for a given ticket (max 1 for first paid ticket)
  getFreeTicketCount = (ticket: TicketDisplay): number => {
    if (!this.isTicketFreeForSubscriber(ticket)) return 0;
    const quantity = ticket.selectedQuantity ?? 0;
    return Math.min(1, quantity); // Max 1 free ticket
  };

  // Get the effective price for display (0 if free, original price otherwise)
  getEffectivePrice = (ticket: TicketDisplay): number => {
    if (this.isTicketFreeForSubscriber(ticket) && this.getFreeTicketCount(ticket) > 0) {
      return 0;
    }
    return ticket.price;
  };

  hasPaidTickets = computed(() => {
    return this.ticketsData().some((ticket) => {
      const quantity = ticket.selectedQuantity ?? 0;
      const price = parseFloat(String(ticket.price)) || 0;
      const status = this.getTicketStatus(ticket);
      return quantity > 0 && price > 0 && status === 'available';
    });
  });

  hasPromoCodes = computed(() => {
    return this.promo_codes && this.promo_codes.length > 0 && this.hasPaidTickets();
  });

  isApplyButtonDisabled = computed(() => {
    const input = this.promoInput();
    return !input || input.trim().length === 0;
  });

  isPromoCodeApplied = computed(() => {
    return this.appliedPromoCode() !== null;
  });

  subtotalPrice = computed(() => {
    const totalInCents = Object.values(this.ticketPricesByTier()).reduce((sum, tierPrice) => sum + tierPrice, 0);
    const discount = this.discountAmount();
    return Math.max(0, totalInCents / 100 - discount);
  });

  hostFeesTotal = computed(() => {
    const totalInCents = Object.values(this.hostFeesByTier()).reduce((sum, fee) => sum + fee, 0);
    return totalInCents / 100;
  });

  subtotalAfterHostFees = computed(() => {
    return this.subtotalPrice() + this.hostFeesTotal();
  });

  calculationEffect = effect(() => {
    const tickets = this.ticketsData();
    if (!tickets || tickets.length === 0) {
      return;
    }

    this.hostPaysFees;
    this.additionalFees;
    this.calculateAmountsForAllTiers();

    untracked(() => {
      const selectedTickets = tickets.filter((t) => (t.selectedQuantity ?? 0) > 0);
      const currentAttendees = this.attendees();

      if (selectedTickets.length === 0) {
        this.attendees.set([]);
      } else if (currentAttendees.length === 0) {
        this.rebuildAttendees();
      } else {
        this.updateAttendeeFees();
      }

      const promoCodeValue = this.normalizedPromoCode();

      if (!promoCodeValue) return;

      const appliedPromo = this.appliedPromoCode();
      if (appliedPromo) {
        this.validatePromoCode(promoCodeValue, appliedPromo);
      } else if (this.promo_codes?.length > 0) {
        const foundPromo = this.promo_codes.find((promo) => {
          const code = promo.promo_code || promo.promoCode;
          return code?.toUpperCase() === promoCodeValue.toUpperCase();
        });
        if (foundPromo) {
          this.validatePromoCode(promoCodeValue, foundPromo);
        }
      }
    });
  });

  normalizedPromoCode = computed(() => {
    const promoCodeValue = this.promoCode();
    if (promoCodeValue) return promoCodeValue;

    const applied = this.appliedPromoCode();
    if (applied) {
      return applied.promoCode || applied.promo_code || '';
    }

    return '';
  });

  totalPrice = computed(() => {
    const totalInCents = Object.values(this.totalsByTier()).reduce((sum, tierTotal) => sum + tierTotal, 0);
    const totalInDollars = totalInCents / 100;
    const discount = this.discountAmount();
    return Math.max(0, totalInDollars - discount);
  });

  formattedTotal = computed(() => {
    const total = this.totalPrice();
    if (!total || total === 0) {
      return '';
    }

    return total.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  });

  hasSelectedTickets = computed(() => {
    return this.ticketsData().some((ticket) => (ticket.selectedQuantity ?? 0) > 0);
  });

  totalSelectedTickets = computed(() => {
    return this.ticketsData().reduce((sum, ticket) => {
      return sum + (ticket.selectedQuantity ?? 0);
    }, 0);
  });

  maxAllowedTickets = computed(() => {
    return 1 + this.maxAttendeesPerUser;
  });

  ngOnInit(): void {
    // Reset the first paid ticket tracking when modal opens
    this.firstSelectedPaidTicketId.set(null);

    let ticketsToInitialize: TicketDisplay[] = [];

    if (this.tickets && this.tickets.length > 0) {
      ticketsToInitialize = this.tickets.map((ticket: any) => {
        const saleStartDate = ticket.sales_start_date;
        const saleEndDate = ticket.sales_end_date;
        const availableQuantity = ticket.available_quantity;

        const transformedTicket: TicketDisplay = {
          ...ticket,
          available_quantity: availableQuantity,
          selectedQuantity: ticket.selectedQuantity ?? 0,
          sales_start_date: saleStartDate,
          sales_end_date: saleEndDate,
          status: 'available'
        };
        return transformedTicket;
      });
    }

    this.ticketsData.set(ticketsToInitialize);

    // If tickets are pre-selected, find the first paid ticket
    const firstPaidTicket = ticketsToInitialize.find((t) => {
      const quantity = t.selectedQuantity ?? 0;
      return t.price > 0 && quantity > 0;
    });
    if (firstPaidTicket) {
      this.firstSelectedPaidTicketId.set(String(firstPaidTicket.id));
    }

    this.startTimeUpdate();
  }

  private async ensureLoggedIn(): Promise<{ success: boolean; isNewUser?: boolean } | null> {
    if (this.authService.getCurrentToken()) return { success: true };
    return await this.modalService.openLoginModal();
  }

  private isCurrentUserHostOrCoHost(): boolean {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.id || !this.participants?.length) return false;
    const id = currentUser.id;
    return this.participants.some((p) => {
      const userId = p.user_id ?? p.user?.id;
      const role = (p.role ?? '').toLowerCase();
      return userId === id && (role === 'host' || role === 'cohost');
    });
  }


  calculateAmountsForAllTiers(): void {
    const tickets = this.ticketsData();
    if (!tickets || tickets.length === 0) return;

    const newTotalsByTier: { [key: string]: number } = {};
    const newPlatformFeesByTier: { [key: string]: number } = {};
    const newHostFeesByTier: { [key: string]: number } = {};
    const newTicketPricesByTier: { [key: string]: number } = {};
    const newActualPricesByTier: { [key: string]: number } = {};
    const newDiscountAmountsByTier: { [key: string]: number } = {};

    // Track if we've already applied the free ticket discount
    let freeTicketApplied = false;

    const firstSelectedPaidTicketId = this.firstSelectedPaidTicketId();

    tickets.forEach((ticket) => {
      if (!ticket.id) return;

      const ticketId = String(ticket.id);
      const ticketQuantity = ticket.selectedQuantity ?? 0;

      if (ticketQuantity <= 0) return;

      let priceInCents = ticket.price * 100;

      const originalPriceInCents = priceInCents;

      const ticketCount = ticketQuantity;

      let freeTicketCount = 0;
      if (this.hasSubscribed && priceInCents > 0 && !freeTicketApplied && firstSelectedPaidTicketId && ticketId === firstSelectedPaidTicketId) {
        freeTicketCount = Math.min(1, ticketCount);
        freeTicketApplied = true;
      }

      // Calculate subtotal after free ticket discount
      let subTotal = priceInCents * (ticketCount - freeTicketCount);

      let additionalCharge = 0;

      if (!this.hostPaysFees && this.additionalFees) {
        const hostChargePercent = Number(this.additionalFees);
        if (hostChargePercent > 0) {
          additionalCharge = Math.round(subTotal * (hostChargePercent / 100));
          subTotal += additionalCharge;
        }
      }

      // Store the free ticket discount amount
      const freeTicketDiscountAmount = freeTicketCount * originalPriceInCents;

      let fees = 0;
      let total = 0;

      // Only calculate fees for paid tickets (price > 0)
      // Fees should be calculated on the paid ticket count (excluding free tickets)
      if (subTotal > 0 && originalPriceInCents > 0) {
        // Fixed fee (e.g., $1.00 per paid ticket) + 10% (7% + 3%) of subtotal
        // Stripe flat fee is added once per transaction (allocated to first paid tier)
        const paidTicketCount = ticketCount - freeTicketCount;
        const fixedFeeInCents = 100 * paidTicketCount;
        const percentageFee = subTotal * 0.1;
        const stripeFlatFee = paidTicketCount > 0 ? 30 : 0; // Only add Stripe fee if there are paid tickets

        fees = fixedFeeInCents + percentageFee + stripeFlatFee;
        total = this.hostPaysFees ? subTotal : subTotal + fees;
        subTotal = this.hostPaysFees ? subTotal - fees : subTotal;
      }

      newTotalsByTier[ticketId] = Math.max(0, Math.trunc(total));
      newPlatformFeesByTier[ticketId] = fees;
      newHostFeesByTier[ticketId] = additionalCharge;
      newTicketPricesByTier[ticketId] = Math.max(0, Math.trunc(subTotal));
      newActualPricesByTier[ticketId] = originalPriceInCents * ticketCount;
      newDiscountAmountsByTier[ticketId] = freeTicketDiscountAmount;
    });

    this.totalsByTier.set(newTotalsByTier);
    this.platformFeesByTier.set(newPlatformFeesByTier);
    this.hostFeesByTier.set(newHostFeesByTier);
    this.ticketPricesByTier.set(newTicketPricesByTier);
    this.actualPricesByTier.set(newActualPricesByTier);
    this.discountAmountsByTier.set(newDiscountAmountsByTier);
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

  canDecrement(ticket: TicketDisplay): boolean {
    return (ticket.selectedQuantity ?? 0) > 0;
  }

  canIncrement(ticket: TicketDisplay): boolean {
    if (this.isSubscriberExclusive && (ticket.selectedQuantity ?? 0) >= 1) {
      return false;
    }
    if (ticket.available_quantity !== undefined) {
      if ((ticket.selectedQuantity ?? 0) >= ticket.available_quantity) {
        return false;
      }
    }

    const currentTotal = this.totalSelectedTickets();
    const maxAllowed = this.maxAllowedTickets();

    if (currentTotal >= maxAllowed) {
      return false;
    }

    return true;
  }

  decrementQuantity(ticket: TicketDisplay): void {
    if (!this.canDecrement(ticket)) return;
    const tickets = this.ticketsData();
    const index = tickets.findIndex((t) => t.id === ticket.id);
    if (index !== -1) {
      const updatedTickets = [...tickets];
      const newQuantity = (updatedTickets[index].selectedQuantity ?? 0) - 1;
      updatedTickets[index] = {
        ...updatedTickets[index],
        selectedQuantity: newQuantity
      };
      this.ticketsData.set(updatedTickets);

      // If the first paid ticket is removed completely (quantity = 0), move free benefit to next paid ticket
      const firstPaidTicketId = this.firstSelectedPaidTicketId();
      if (firstPaidTicketId && String(ticket.id) === firstPaidTicketId && newQuantity === 0) {
        // Find the next available paid ticket that is selected
        const nextPaidTicket = updatedTickets.find((t) => {
          const quantity = t.selectedQuantity ?? 0;
          return t.price > 0 && quantity > 0 && String(t.id) !== firstPaidTicketId;
        });

        if (nextPaidTicket) {
          // Move the free benefit to the next paid ticket
          this.firstSelectedPaidTicketId.set(String(nextPaidTicket.id));
        } else {
          // No other paid tickets selected, clear the tracking
          this.firstSelectedPaidTicketId.set(null);
        }
      }

      this.removeAttendeeForTicket(String(ticket.id));
    }
  }

  incrementQuantity(ticket: TicketDisplay): void {
    // 🚫 Allow only 1 quantity for subscriber exclusive tickets
    if (this.isSubscriberExclusive && (ticket.selectedQuantity ?? 0) >= 1) {
      return;
    }

    if (!this.canIncrement(ticket)) return;

    const tickets = this.ticketsData();
    const index = tickets.findIndex((t) => t.id === ticket.id);

    if (index !== -1) {
      const updatedTickets = [...tickets];
      const previousQuantity = updatedTickets[index].selectedQuantity ?? 0;

      updatedTickets[index] = {
        ...updatedTickets[index],
        selectedQuantity: previousQuantity + 1
      };

      this.ticketsData.set(updatedTickets);

      // Track first paid ticket
      if (ticket.price > 0 && previousQuantity === 0 && !this.firstSelectedPaidTicketId()) {
        this.firstSelectedPaidTicketId.set(String(ticket.id));
      }

      this.addAttendeeForTicket(ticket);
    }
  }

  onPromoCodeChange(value: string): void {
    const upperValue = value.toUpperCase();
    this.promoInput.set(upperValue);
    this.promoCode.set('');
    this.appliedPromoCode.set(null);
    this.discountAmount.set(0);
    this.promoValidation.set({
      isValid: false,
      message: '',
      discountAmount: 0
    });
  }

  validatePromoCode(promoCodeValue: string, discountObj: any): void {
    const maxUsePerUser = discountObj.max_uses_per_user && discountObj.max_uses_per_user > 0 ? discountObj.max_uses_per_user : Infinity;

    const redemptionLimit =
      discountObj.available_quantity !== null && discountObj.available_quantity !== undefined ? discountObj.available_quantity : Infinity;

    const paidTickets: Array<{ priceInCents: number }> = [];

    this.ticketsData().forEach((ticket) => {
      const quantity = ticket.selectedQuantity ?? 0;
      if (quantity > 0) {
        const priceInCents = ticket.price * 100;
        if (priceInCents > 0) {
          for (let i = 0; i < quantity; i++) {
            paidTickets.push({ priceInCents });
          }
        }
      }
    });

    const totalPaidTickets = paidTickets.length;
    if (redemptionLimit <= 0) {
      this.discountAmount.set(0);

      const normalizedPromo = {
        ...discountObj,
        promoCode: discountObj.promo_code || discountObj.promoCode,
        promotion_type: discountObj.promotion_type || discountObj.type,
        value: discountObj.promoPresent || discountObj.value
      };

      this.appliedPromoCode.set(normalizedPromo);
      this.promoCode.set(promoCodeValue);
      this.promoInput.set(promoCodeValue);

      this.promoValidation.set({
        isValid: false,
        message: 'Promo code has reached its redemption limit',
        discountAmount: 0,
        redemptionLimit
      } as any);

      return;
    }

    const eligibleLimit = Math.min(maxUsePerUser, redemptionLimit);

    const eligibleTickets = paidTickets.slice(0, eligibleLimit);
    const eligibleTicketCount = eligibleTickets.length;

    const eligibleAmountInCents = eligibleTickets.reduce((sum, t) => sum + t.priceInCents, 0);

    const actualPrices = this.actualPricesByTier();
    const totalAmountInCents = Object.values(actualPrices).reduce((sum, amount) => sum + amount, 0);

    if (discountObj.capped_amount && discountObj.capped_amount.trim() !== '') {
      const minOrderAmount = discountObj.capped_amount * 100;

      if (totalAmountInCents < minOrderAmount) {
        this.discountAmount.set(0);

        const normalizedPromo = {
          ...discountObj,
          promoCode: discountObj.promo_code || discountObj.promoCode,
          promotion_type: discountObj.promotion_type || discountObj.type,
          value: discountObj.promoPresent || discountObj.value
        };

        this.appliedPromoCode.set(normalizedPromo);
        this.promoCode.set(promoCodeValue);
        this.promoInput.set(promoCodeValue);

        this.promoValidation.set({
          isValid: false,
          message: `Promo code not applied - minimum order of $${(minOrderAmount / 100).toFixed(2)} required`,
          discountAmount: 0,
          cappedAmount: minOrderAmount
        } as any);

        return;
      }
    }

    const promoType = discountObj.promotion_type || discountObj.type;
    const promoValue = discountObj.promoPresent || discountObj.value;

    let discountAmountInCents = 0;

    if (promoType === 'percentage' || promoType === 'Percentage') {
      const percentage = parseFloat(promoValue) || 0;
      discountAmountInCents = Math.round(eligibleAmountInCents * (percentage / 100));

      if (discountObj.capped_amount && discountObj.capped_amount.trim() !== '') {
        const maxDiscount = discountObj.capped_amount * 100;
        discountAmountInCents = Math.min(discountAmountInCents, maxDiscount);
      }
    } else if (promoType === 'fixed' || promoType === 'Fixed') {
      discountAmountInCents = promoValue * 100;
      discountAmountInCents = Math.min(discountAmountInCents, eligibleAmountInCents);
    }

    const discountInDollars = discountAmountInCents / 100;

    let message = 'Promo code applied';

    if (discountInDollars > 0) {
      if (eligibleTicketCount < totalPaidTickets) {
        message = `You saved $${discountInDollars.toFixed(2)} (applied on ${eligibleTicketCount} ticket${eligibleTicketCount > 1 ? 's' : ''})`;
      } else {
        message = `You saved $${discountInDollars.toFixed(2)}`;
      }
    }

    const normalizedPromo = {
      ...discountObj,
      promoCode: discountObj.promo_code || discountObj.promoCode,
      promotion_type: promoType,
      value: promoValue
    };

    this.promoValidation.set({
      isValid: true,
      message,
      discountAmount: discountInDollars,
      redemptionLimit,
      maxUsePerUser,
      eligibleTicketCount
    } as any);

    this.appliedPromoCode.set(normalizedPromo);
    this.discountAmount.set(discountInDollars);
    this.promoCode.set(promoCodeValue);
    this.promoInput.set(promoCodeValue);
  }

  onPromoButtonClick(): void {
    const isApplied = this.promoCode() && this.promoValidation().isValid && this.promoCode() === this.promoInput().trim().toUpperCase();

    if (isApplied) {
      this.clearPromoCode();
    } else {
      this.applyPromoCode();
    }
  }

  applyPromoCode(): void {
    const code = this.promoInput().trim().toUpperCase();

    const foundPromo = this.promo_codes?.find((promo) => {
      const promoCodeValue = promo.promo_code || promo.promoCode;
      return promoCodeValue?.toUpperCase() === code;
    });

    if (!foundPromo) {
      this.setPromoError(code, 'Invalid promo code');
      return;
    }

    this.calculateAmountsForAllTiers();
    this.validatePromoCode(code, foundPromo);
    this.updateAttendeeFees();
  }

  clearPromoCode(): void {
    this.promoCode.set('');
    this.promoInput.set('');
    this.appliedPromoCode.set(null);
    this.discountAmount.set(0);
    this.promoValidation.set({
      isValid: false,
      message: '',
      discountAmount: 0
    });
  }

  setPromoError(code: string, message: string): void {
    this.discountAmount.set(0);
    this.appliedPromoCode.set(null);
    this.promoCode.set(code);
    this.promoValidation.set({
      isValid: false,
      message,
      discountAmount: 0
    });
  }

  rebuildAttendees(): void {
    try {
      const selectedTickets = this.ticketsData().filter((t) => (t.selectedQuantity ?? 0) > 0);
      if (selectedTickets.length === 0) {
        this.attendees.set([]);
        return;
      }

      const attendees: any[] = [];
      const currentUser = this.authService.currentUser();
      const userId = currentUser?.id || null;

      selectedTickets.forEach((ticket) => {
        const quantity = ticket.selectedQuantity ?? 0;
        const ticketId = String(ticket.id);
        const priceInCents = ticket.price * 100;

        for (let i = 0; i < quantity; i++) {
          const isGuest = attendees.length > 0;

          if (priceInCents <= 0) {
            attendees.push({
              parent_user_id: isGuest ? userId : null,
              name: '',
              is_incognito: false,
              rsvp_status: 'Yes',
              event_ticket_id: ticketId,
              event_promo_code_id: null,
              platform_fee_amount: 0,
              amount_paid: 0,
              host_payout_amount: 0
            });
          } else {
            attendees.push({
              parent_user_id: isGuest ? userId : null,
              name: '',
              is_incognito: false,
              rsvp_status: 'Yes',
              event_ticket_id: ticketId,
              event_promo_code_id: null,
              platform_fee_amount: 0,
              amount_paid: 0,
              host_payout_amount: 0
            });
          }
        }
      });

      this.attendees.set(attendees);
      this.updateAttendeeFees();
    } catch (error) {
      console.error('Error rebuilding attendees:', error);
      this.attendees.set([]);
    }
  }

  addAttendeeForTicket(ticket: TicketDisplay): void {
    const currentUser = this.authService.currentUser();
    const userId = currentUser?.id || null;
    const ticketId = String(ticket.id);
    const priceInCents = ticket.price * 100;
    const currentAttendees = this.attendees();
    const isGuest = currentAttendees.length > 0;

    if (priceInCents <= 0) {
      const newAttendee = {
        parent_user_id: isGuest ? userId : null,
        name: '',
        is_incognito: false,
        rsvp_status: 'Yes',
        event_ticket_id: ticketId,
        event_promo_code_id: null,
        platform_fee_amount: 0,
        amount_paid: 0,
        host_payout_amount: 0
      };
      this.attendees.update((attendees) => [...attendees, newAttendee]);
      return;
    }

    const newAttendee = {
      parent_user_id: isGuest ? userId : null,
      name: '',
      is_incognito: false,
      rsvp_status: 'Yes',
      event_ticket_id: ticketId,
      event_promo_code_id: null,
      platform_fee_amount: 0,
      amount_paid: 0,
      host_payout_amount: 0
    };
    this.attendees.update((attendees) => [...attendees, newAttendee]);
  }

  removeAttendeeForTicket(ticketId: string): void {
    const currentAttendees = this.attendees();
    const ticketIdStr = String(ticketId);

    for (let i = currentAttendees.length - 1; i >= 0; i--) {
      if (currentAttendees[i].event_ticket_id === ticketIdStr) {
        const updatedAttendees = [...currentAttendees];
        updatedAttendees.splice(i, 1);
        this.attendees.set(updatedAttendees);
        break;
      }
    }
  }

  updateAttendeeFees(): void {
    try {
      const currentAttendees = this.attendees();
      if (currentAttendees.length === 0) {
        return;
      }

      const selectedTickets = this.ticketsData().filter((t) => (t.selectedQuantity ?? 0) > 0);
      const platformFeesByTier = this.platformFeesByTier();
      const ticketPricesByTier = this.ticketPricesByTier();
      const appliedPromoCode = this.appliedPromoCode();
      const promoCodeId = appliedPromoCode?.id || null;
      const discountAmount = this.discountAmount();
      const promoValidation = this.promoValidation();
      const eligibleTicketCount = promoValidation.eligibleTicketCount || 0;

      const discountPerEligibleTicket = eligibleTicketCount > 0 ? discountAmount / eligibleTicketCount : 0;

      let eligibleTicketIndex = 0;
      const ticketCounts: { [key: string]: number } = {};
      const freeTicketCountByTicket: { [key: string]: number } = {};
      const freeTicketUsedByTicket: { [key: string]: number } = {};

      selectedTickets.forEach((ticket) => {
        const ticketId = String(ticket.id);
        ticketCounts[ticketId] = ticket.selectedQuantity ?? 0;
        // Check if this ticket is eligible for free subscription benefit
        if (this.hasSubscribed && this.isTicketFreeForSubscriber(ticket)) {
          freeTicketCountByTicket[ticketId] = this.getFreeTicketCount(ticket);
          freeTicketUsedByTicket[ticketId] = 0;
        }
      });

      const updatedAttendees = currentAttendees.map((attendee) => {
        const ticketId = attendee.event_ticket_id;
        const ticket = selectedTickets.find((t) => String(t.id) === ticketId);
        const priceInCents = (ticket?.price || 0) * 100;

        if (priceInCents <= 0) {
          return {
            ...attendee,
            event_promo_code_id: null,
            platform_fee_amount: 0,
            amount_paid: 0,
            host_payout_amount: 0
          };
        }

        // Check if this attendee should get the free ticket benefit
        const freeTicketCount = freeTicketCountByTicket[ticketId] || 0;
        const freeTicketsUsed = freeTicketUsedByTicket[ticketId] || 0;
        const isFreeTicketForSubscriber = freeTicketCount > 0 && freeTicketsUsed < freeTicketCount;

        if (isFreeTicketForSubscriber) {
          freeTicketUsedByTicket[ticketId] = freeTicketsUsed + 1;
          return {
            ...attendee,
            event_promo_code_id: null,
            platform_fee_amount: 0,
            amount_paid: 0,
            host_payout_amount: 0
          };
        }

        const quantity = ticketCounts[ticketId] || 0;
        const totalPlatformFeeInCents = platformFeesByTier[ticketId] || 0;
        const totalTicketPriceInCents = ticketPricesByTier[ticketId] || 0;

        // Calculate per-ticket amounts, accounting for the free ticket
        const paidTicketCount = quantity - freeTicketCount;

        const platformFeePerTicketInCents = paidTicketCount > 0 ? totalPlatformFeeInCents / paidTicketCount : 0;
        const ticketPricePerTicketInCents = paidTicketCount > 0 ? totalTicketPriceInCents / paidTicketCount : 0;

        const isEligibleForPromo = eligibleTicketIndex < eligibleTicketCount;
        const ticketDiscount = isEligibleForPromo ? discountPerEligibleTicket : 0;
        eligibleTicketIndex++;

        const ticketPriceInDollars = ticketPricePerTicketInCents / 100;
        const platformFeeInDollars = platformFeePerTicketInCents / 100;

        const ticketPriceAfterDiscount = Math.max(0, ticketPriceInDollars - ticketDiscount);

        let amountPaid = ticketPriceAfterDiscount;
        if (!this.hostPaysFees) {
          amountPaid += platformFeeInDollars;
        }

        const hostPayoutAmount = amountPaid - platformFeeInDollars;

        return {
          ...attendee,
          event_promo_code_id: isEligibleForPromo ? promoCodeId : null,
          platform_fee_amount: platformFeeInDollars,
          amount_paid: Math.max(0, amountPaid), // ✅ Ensure non-negative
          host_payout_amount: Math.max(0,hostPayoutAmount)
        };
      });

      this.attendees.set(updatedAttendees);
    } catch (error) {
      console.error('Error updating attendee fees:', error);
    }
  }

  updateAttendeeNames(rsvpConfirmData: any): void {
    const currentUser = this.authService.currentUser();
    const guestDetails = rsvpConfirmData?.guestDetails || [];
    const yourDetails = rsvpConfirmData?.yourDetails;

    let guestIndex = 0;
    const attendees = this.attendees().map((attendee) => {
      const isGuest = attendee.parent_user_id !== null;
      let attendeeName = '';
      let isIncognito = false;
      let rsvpStatus: 'Yes' | 'Maybe' = 'Yes';

      if (isGuest) {
        if (guestIndex < guestDetails.length) {
          const guest = guestDetails[guestIndex];
          attendeeName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim();
          isIncognito = guest.isIncognito || false;
          rsvpStatus = guest.attendance === 'maybe' ? 'Maybe' : 'Yes';
        } else {
          attendeeName = `Guest ${guestIndex + 1}`;
          isIncognito = false;
          rsvpStatus = 'Yes';
        }
        guestIndex++;
      } else {
        if (yourDetails) {
          attendeeName = `${yourDetails.firstName || ''} ${yourDetails.lastName || ''}`.trim();
        } else if (currentUser?.name) {
          attendeeName = currentUser.name;
        }
        isIncognito = false;
        rsvpStatus = 'Yes';
      }

      return {
        ...attendee,
        name: attendeeName,
        is_incognito: isIncognito,
        rsvp_status: rsvpStatus
      };
    });

    this.attendees.set(attendees);
  }

  async openStripePayoutModal(): Promise<void> {
    return new Promise(async (resolve) => {
      await this.modalService.openConfirmModal({
        icon: '/assets/svg/subscription/sponsorIcon.svg',
        iconBgColor: this.SPONSOR_GRADIENT,
        title: 'Save 20% by Subscribing as a Sponsor!',
        description: 'Subscribe to the host’s events as a sponsor and save up to 20% annually.',
        confirmButtonLabel: 'See Plans',
        cancelButtonLabel: 'Not Now',
        confirmButtonColor: 'primary',
        iconPosition: 'center',

        onConfirm: async () => {
          await this.navigateToSubscriptionPlans();
          resolve(); // ✅ allow RSVP flow to continue
        }
      });
    });
  }

  async navigateToSubscriptionPlans(): Promise<void> {
    if (this.sponsorPlans()?.length) {
      const planId = this.sponsorPlans()[0].id;

      await this.modalCtrl.dismiss();
      await this.modalService.openSubscriptionModal(planId);
    }
  }

  async dismiss(): Promise<void> {
    const loginResult = await this.ensureLoggedIn();
    if (!loginResult?.success) return;

    if (this.isCurrentUserHostOrCoHost()) {
      this.toasterService.showError('You are the host or co-host of this event. You cannot RSVP as a guest.');
      return;
    }

    if (this.hasSponsorPlan() && !this.hasSubscribed && this.isSelectedSponsorTicket() && !this.hasShownSponsorPrompt()) {
      this.hasShownSponsorPrompt.set(true);
      await this.openStripePayoutModal(); // ⛔ blocks until closed
    }

    const selectedTickets = this.ticketsData().filter((t) => (t.selectedQuantity ?? 0) > 0);
    const totalPlatformFeesInCents = Object.values(this.platformFeesByTier()).reduce((sum, fee) => sum + fee, 0);
    const totalPlatformFees = totalPlatformFeesInCents / 100;

    // Calculate total free ticket discount in dollars
    const totalFreeTicketDiscountInCents = Object.values(this.discountAmountsByTier()).reduce((sum, discount) => sum + discount, 0);
    const totalFreeTicketDiscount = totalFreeTicketDiscountInCents / 100;

    const rsvpData = {
      tickets: selectedTickets,
      promo_code: this.normalizedPromoCode(),
      appliedPromoCode: this.appliedPromoCode(),
      discountAmount: this.discountAmount(),
      subtotal: this.subtotalPrice(),
      total: this.totalPrice(),
      platformFee: totalPlatformFees,
      hostFees: this.hostFeesTotal(),
      subtotalAfterHostFees: this.subtotalAfterHostFees(),
      promoCodeTicketCount: this.promoValidation().eligibleTicketCount || 0,
      freeTicketDiscount: totalFreeTicketDiscount
    };

    if (this.hasQuestionnaire() && this.questionnaire && this.questionnaire.length > 0 && !this.questionnaireResult()) {
      const preEventQuestionnaire = this.questionnaire.filter((q: any) => !q.event_phase || q.event_phase === 'PreEvent');

      if (preEventQuestionnaire.length > 0) {
        this.questionnaireResult.set(await this.modalService.openQuestionnairePreviewModal(preEventQuestionnaire, false));

        if (!this.questionnaireResult()) {
          return;
        }
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
      this.hostName
    );

    if (!rsvpConfirmData) {
      return;
    }

    this.updateAttendeeNames(rsvpConfirmData);

    const result = {
      ...rsvpConfirmData,
      questionnaireResult: this.questionnaireResult(),
      event_id: this.eventId,
      attendees: this.attendees(),
      stripe_payment_intent_id: rsvpConfirmData?.stripePaymentIntentId || null,
      isNewUser: loginResult.isNewUser ?? false
    };

    await this.modalCtrl.dismiss(result);
    this.modalService.close();
  }

  async close(): Promise<void> {
    await this.modalCtrl.dismiss();
    this.modalService.close();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
