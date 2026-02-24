import { computed, signal } from '@angular/core';

export interface RsvpTicketInput {
  id: string;
  name: string;
  price: number;
  ticket_type?: string;
  selectedQuantity: number;
  available_quantity?: number;
}

export interface RsvpPromoState {
  promoInput: string;
  promoCode: string;
  appliedPromoCode: any | null;
  promoId: string | null;
  discountDollars: number;
  eligibleTicketCount: number;
  isValid: boolean;
  message: string;
}

export interface RsvpFeeConfig {
  hostPaysFees: boolean;
  additionalFees: string | number | null;
}

export interface RsvpAttendee {
  event_ticket_id: string;
  parent_user_id: string | null;
  name: string;
  is_incognito: boolean;
  rsvp_status: 'Yes' | 'Maybe';
  event_promo_code_id: string | null;
  platform_fee_amount: number;
  amount_paid: number;
  host_payout_amount: number;
}

export interface RsvpTierSummary {
  ticketId: string;
  ticketName: string;
  quantity: number;
  unitPriceDollars: number;
  freeSubscriptionCount: number;
  promoDiscountDollars: number;
  subtotalDollars: number;
  platformFeeDollars: number;
  hostFeeDollars: number;
  totalDollars: number;
}

export interface RsvpSummary {
  tiers: RsvpTierSummary[];
  subtotalDollars: number;
  promoDiscountDollars: number;
  platformFeeDollars: number;
  hostFeeDollars: number;
  totalDollars: number;
  freeSubscriptionDiscountDollars: number;
  attendees: RsvpAttendee[];
  grossSubtotalDollars: number;
  fullPricePlatformFeeDollars: number;
}


function calcPlatformFee(
  subTotalAfterPromoCents: number,
  stillPaidTicketCount: number
): number {
  if (stillPaidTicketCount <= 0 || subTotalAfterPromoCents <= 0) return 0;
  const fixed = 100 * stillPaidTicketCount;
  const pct = Math.round(subTotalAfterPromoCents * 0.1);
  const stripe = 30 * stillPaidTicketCount;
  return fixed + pct + stripe;
}

function calcHostFee(
  subTotalAfterPromoCents: number,
  config: RsvpFeeConfig
): number {
  if (config.hostPaysFees || !config.additionalFees) return 0;
  const pct = Number(config.additionalFees);
  if (pct <= 0) return 0;
  return Math.round(subTotalAfterPromoCents * (pct / 100));
}


export function createRsvpState(config: RsvpFeeConfig = { hostPaysFees: false, additionalFees: null }) {

  // ── Raw signals (inputs) ──────────────────────────────────────────────────
  const _tickets = signal<RsvpTicketInput[]>([]);
  // in createRsvpState return block
  const freeTicketId = computed(() => _freeTicketId());
  // add to return:
  const _promo = signal<RsvpPromoState>({
    promoInput: '', promoCode: '', appliedPromoCode: null,
    promoId: null, discountDollars: 0, eligibleTicketCount: 0,
    isValid: false, message: ''
  });
  const _subscribed = signal<boolean>(false);
  const _freeTicketId = signal<string | null>(null); // first paid ticket that gets subscription benefit
  const _feeConfig = signal<RsvpFeeConfig>(config);
  const _currentUserId = signal<string | null>(null);

  // ── Core computed: full calculation ──────────────────────────────────────
  const summary = computed<RsvpSummary>(() => {
    const tickets = _tickets();
    const promo = _promo();
    const subscribed = _subscribed();
    const freeTicketId = _freeTicketId();
    const cfg = _feeConfig();
    const currentUserId = _currentUserId();

    const tiers: RsvpTierSummary[] = [];
    const attendees: RsvpAttendee[] = [];

    let totalSubtotal = 0;
    let totalPromoDisc = 0;
    let totalPlatFee = 0;
    let totalHostFee = 0;
    let totalTotal = 0;
    let totalFreeSubDisc = 0;
    let totalGross = 0;
    let totalFullPriceFee = 0;

    // Build per-tier promo discount distribution
    const promoDiscountCents = Math.round(promo.discountDollars * 100);
    const eligibleCount = promo.eligibleTicketCount;
    const perTierPromoDisc: Record<string, number> = {};

    if (promoDiscountCents > 0 && eligibleCount > 0) {
      let remaining = eligibleCount;
      for (const t of tickets) {
        if (remaining <= 0 || t.price <= 0 || t.selectedQuantity <= 0) continue;
        const eligible = Math.min(t.selectedQuantity, remaining);
        perTierPromoDisc[t.id] = Math.round((promoDiscountCents / eligibleCount) * eligible);
        remaining -= eligible;
      }
    }

    // Promo eligible index (for per-attendee assignment)
    // Tracks how many promo-eligible paid attendees we've processed so far
    let promoEligibleIdx = 0;

    for (const ticket of tickets) {
      const qty = ticket.selectedQuantity ?? 0;
      if (qty <= 0) continue;

      const priceInCents = Math.round(ticket.price * 100);
      if (priceInCents < 0) continue;

      // ── Subscription free ticket ─────────────────────────────────────
      const isSubscriptionFreeTier = subscribed && priceInCents > 0 && String(ticket.id) === freeTicketId;
      const freeSubCount = isSubscriptionFreeTier ? Math.min(1, qty) : 0;
      const paidCount = qty - freeSubCount;

      const freeSubDiscountCents = freeSubCount * priceInCents;
      totalFreeSubDisc += freeSubDiscountCents;

      // ── Gross (no discount at all) ────────────────────────────────────
      const grossCents = priceInCents * qty;
      totalGross += grossCents;

      // Full-price platform fee (for scaling baseline in details modal)
      if (paidCount > 0 && priceInCents > 0) {
        const fpFee = calcPlatformFee(priceInCents * paidCount, paidCount);
        totalFullPriceFee += fpFee;
      }

      if (paidCount <= 0 && priceInCents > 0) {
        // All subscription-free — zero tier
        tiers.push({
          ticketId: String(ticket.id),
          ticketName: ticket.name,
          quantity: qty,
          unitPriceDollars: ticket.price,
          freeSubscriptionCount: freeSubCount,
          promoDiscountDollars: 0,
          subtotalDollars: 0,
          platformFeeDollars: 0,
          hostFeeDollars: 0,
          totalDollars: 0
        });

        // Add attendees (all free) — do NOT increment promoEligibleIdx
        for (let i = 0; i < qty; i++) {
          const isGuest = attendees.length > 0;
          attendees.push({
            event_ticket_id: String(ticket.id),
            parent_user_id: isGuest ? currentUserId : null,
            name: '', is_incognito: false, rsvp_status: 'Yes',
            event_promo_code_id: null,
            platform_fee_amount: 0, amount_paid: 0, host_payout_amount: 0,
          });
        }
        continue;
      }

      // Free (price=0) tickets
      if (priceInCents === 0) {
        tiers.push({
          ticketId: String(ticket.id), ticketName: ticket.name, quantity: qty,
          unitPriceDollars: 0, freeSubscriptionCount: 0, promoDiscountDollars: 0,
          subtotalDollars: 0, platformFeeDollars: 0, hostFeeDollars: 0, totalDollars: 0
        });
        for (let i = 0; i < qty; i++) {
          const isGuest = attendees.length > 0;
          attendees.push({
            event_ticket_id: String(ticket.id),
            parent_user_id: isGuest ? currentUserId : null,
            name: '', is_incognito: false, rsvp_status: 'Yes',
            event_promo_code_id: null,
            platform_fee_amount: 0, amount_paid: 0, host_payout_amount: 0,
          });
        }
        continue;
      }

      // ── Promo discount for this tier ──────────────────────────────────
      const tierPromoDiscCents = perTierPromoDisc[ticket.id] || 0;
      const grossPaidCents = priceInCents * paidCount;
      const subAfterPromoCents = Math.max(0, grossPaidCents - tierPromoDiscCents);

      // How many tickets are fully covered by promo
      const fullyDiscCount = priceInCents > 0
        ? Math.min(paidCount, Math.floor(tierPromoDiscCents / priceInCents))
        : 0;
      const stillPaidCount = paidCount - fullyDiscCount;

      // All paid tickets fully discounted by promo
      if (subAfterPromoCents === 0) {
        totalPromoDisc += tierPromoDiscCents;
        tiers.push({
          ticketId: String(ticket.id), ticketName: ticket.name, quantity: qty,
          unitPriceDollars: ticket.price, freeSubscriptionCount: freeSubCount,
          promoDiscountDollars: tierPromoDiscCents / 100,
          subtotalDollars: 0, platformFeeDollars: 0, hostFeeDollars: 0, totalDollars: 0
        });

        for (let i = 0; i < qty; i++) {
          const isSubscriptionFree = i < freeSubCount;
          const isGuest = attendees.length > 0;
          // FIX BUG 2: Only increment promoEligibleIdx for actual paid (non-subscription-free) attendees
          const isEligibleForPromo = !isSubscriptionFree && promoEligibleIdx < eligibleCount;
          if (!isSubscriptionFree) promoEligibleIdx++;

          attendees.push({
            event_ticket_id: String(ticket.id),
            parent_user_id: isGuest ? currentUserId : null,
            name: '', is_incognito: false, rsvp_status: 'Yes',
            event_promo_code_id: isSubscriptionFree ? null : (isEligibleForPromo ? (promo.promoId || null) : null),
            platform_fee_amount: 0, amount_paid: 0, host_payout_amount: 0,
          });
        }
        continue;
      }

      // ── Calculate fees ────────────────────────────────────────────────
      const hostFeeCents = calcHostFee(subAfterPromoCents, cfg);
      const subWithHostCents = subAfterPromoCents + hostFeeCents;
      const platFeeCents = calcPlatformFee(subAfterPromoCents, stillPaidCount);

      const totalCents = cfg.hostPaysFees
        ? subWithHostCents
        : subWithHostCents + platFeeCents;

      const subTotalCents = cfg.hostPaysFees
        ? Math.max(0, subWithHostCents - platFeeCents)
        : subWithHostCents;

      totalPromoDisc += tierPromoDiscCents;
      totalSubtotal += Math.trunc(subTotalCents);
      totalPlatFee += platFeeCents;
      totalHostFee += hostFeeCents;
      totalTotal += Math.trunc(totalCents);

      tiers.push({
        ticketId: String(ticket.id), ticketName: ticket.name, quantity: qty,
        unitPriceDollars: ticket.price, freeSubscriptionCount: freeSubCount,
        promoDiscountDollars: tierPromoDiscCents / 100,
        subtotalDollars: Math.trunc(subTotalCents) / 100,
        platformFeeDollars: platFeeCents / 100,
        hostFeeDollars: hostFeeCents / 100,
        totalDollars: Math.trunc(totalCents) / 100
      });

      // ── Per-attendee fee split ─────────────────────────────────────────
      // Discount per eligible ticket for this tier
      const discPerEligibleCents = eligibleCount > 0 ? promoDiscountCents / eligibleCount : 0;

      // FIX BUG 1: Per-attendee host fee (only for paid, non-fully-discounted attendees)
      const hostFeePerAttendee = stillPaidCount > 0 ? hostFeeCents / stillPaidCount : 0;

      for (let i = 0; i < qty; i++) {
        const isSubscriptionFree = i < freeSubCount;
        const isGuest = attendees.length > 0;

        if (isSubscriptionFree) {
          attendees.push({
            event_ticket_id: String(ticket.id),
            parent_user_id: isGuest ? currentUserId : null,
            name: '', is_incognito: false, rsvp_status: 'Yes',
            event_promo_code_id: null,
            platform_fee_amount: 0, amount_paid: 0, host_payout_amount: 0,
          });
          continue;
        }

        // FIX BUG 2: Only count paid attendees against promoEligibleIdx
        const isEligibleForPromo = promoEligibleIdx < eligibleCount;
        const attendeeDiscCents = isEligibleForPromo ? discPerEligibleCents : 0;
        promoEligibleIdx++;

        const attendeePriceCents = priceInCents;
        const attendeeAfterDisc = Math.max(0, attendeePriceCents - attendeeDiscCents);
        const isFullyFreeByPromo = attendeeAfterDisc < 0.01;

        // Per-attendee platform fee
        const attendeePlatFee = isFullyFreeByPromo ? 0 : (platFeeCents / stillPaidCount);

        // FIX BUG 1: Include host fee in amount_paid when guest pays fees
        const attendeeHostFee = isFullyFreeByPromo ? 0 : hostFeePerAttendee;

        let amountPaid = attendeeAfterDisc / 100;
        if (!cfg.hostPaysFees && !isFullyFreeByPromo) {
          // Guest pays: ticket price + host fee + platform fee
          amountPaid += attendeeHostFee / 100 + attendeePlatFee / 100;
        }

        // Host payout = amount paid minus platform fee (host fee stays with host)
        const hostPayout = Math.max(0, amountPaid - attendeePlatFee / 100);

        attendees.push({
          event_ticket_id: String(ticket.id),
          parent_user_id: isGuest ? currentUserId : null,
          name: '', is_incognito: false, rsvp_status: 'Yes',
          event_promo_code_id: isEligibleForPromo ? (promo.promoId || null) : null,
          platform_fee_amount: Math.max(0, attendeePlatFee / 100),
          amount_paid: Math.max(0, amountPaid),
          host_payout_amount: Math.max(0, hostPayout),
        });
      }
    }

    return {
      tiers,
      subtotalDollars: totalSubtotal / 100,
      promoDiscountDollars: totalPromoDisc / 100,
      platformFeeDollars: totalPlatFee / 100,
      hostFeeDollars: totalHostFee / 100,
      totalDollars: totalTotal / 100,
      freeSubscriptionDiscountDollars: totalFreeSubDisc / 100,
      attendees,
      grossSubtotalDollars: totalGross / 100,
      fullPricePlatformFeeDollars: totalFullPriceFee / 100
    };
  });

  // ── Convenience computed ──────────────────────────────────────────────────
  const totalPrice = computed(() => summary().totalDollars);
  const formattedTotal = computed(() => {
    const t = totalPrice();
    return t > 0
      ? t.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '';
  });
  const attendees = computed(() => summary().attendees);
  const promoState = computed(() => _promo());
  const tickets = computed(() => _tickets());

  // ── Mutators ──────────────────────────────────────────────────────────────

  /** Replace the full ticket list (call after increment/decrement) */
  function setTickets(t: RsvpTicketInput[]) {
    _tickets.set([...t]);
    // Recompute first paid ticket for subscription benefit
    const firstPaid = t.find(x => x.price > 0 && (x.selectedQuantity ?? 0) > 0);
    if (firstPaid) {
      if (!_freeTicketId() || !t.find(x => String(x.id) === _freeTicketId() && (x.selectedQuantity ?? 0) > 0)) {
        _freeTicketId.set(String(firstPaid.id));
      }
    } else {
      _freeTicketId.set(null);
    }
  }

  /** Apply a valid promo code */
  function applyPromo(state: RsvpPromoState) {
    _promo.set(state);
  }

  /** Clear the promo code */
  function clearPromo() {
    _promo.set({
      promoInput: '', promoCode: '', appliedPromoCode: null,
      promoId: null, discountDollars: 0, eligibleTicketCount: 0,
      isValid: false, message: ''
    });
  }

  /** Set subscription status */
  function setSubscribed(v: boolean) {
    _subscribed.set(v);
  }

  /** Override which ticket gets the subscription free benefit */
  function setFreeTicketId(id: string | null) {
    _freeTicketId.set(id);
  }

  /** Update fee configuration */
  function setFeeConfig(c: RsvpFeeConfig) {
    _feeConfig.set(c);
  }

  /** Set current user ID (for parent_user_id on guest attendees) */
  function setCurrentUserId(id: string | null) {
    _currentUserId.set(id);
  }

  /**
   * Update attendee names/incognito/rsvpStatus after confirmation form is filled.
   * Returns updated attendees list (also updates internal signal via setTickets is NOT needed —
   * caller should store result and pass to API directly).
   */
  function applyAttendeeDetails(
    yourDetails: { firstName: string; lastName: string },
    guestDetails: Array<{ firstName: string; lastName: string; isIncognito: boolean; attendance: 'going' | 'maybe' }> | null,
    currentUserName: string = ''
  ): RsvpAttendee[] {
    return summary().attendees.map((a, idx) => {
      if (idx === 0) {
        return {
          ...a,
          name: `${yourDetails.firstName} ${yourDetails.lastName}`.trim() || currentUserName,
          rsvp_status: 'Yes'
        };
      }
      const guest = guestDetails?.[idx - 1];
      if (guest) {
        return {
          ...a,
          name: `${guest.firstName} ${guest.lastName}`.trim() || `Guest ${idx}`,
          is_incognito: guest.isIncognito ?? false,
          rsvp_status: guest.attendance === 'maybe' ? 'Maybe' : 'Yes',
          parent_user_id: _currentUserId()
        };
      }
      return a;
    });
  }

  /**
   * Returns the rsvpData payload to pass into rsvp-details-modal.
   * The details modal can use grossSubtotalDollars + fullPricePlatformFeeDollars
   * to accurately recalculate if promo changes inside that modal.
   */
  function getRsvpDataPayload(extras: {
    promoCodes: any[];
    eventTickets: RsvpTicketInput[];
    hasSubscribed?: boolean;
    freeTicketId?: string | null;
  }) {
    const s = summary();
    const p = _promo();
    return {
      tickets: extras.eventTickets,
      promo_codes: extras.promoCodes,
      promo_code: p.promoCode,
      appliedPromoCode: p.appliedPromoCode,
      discountAmount: p.discountDollars,
      subtotal: s.subtotalDollars,
      total: s.totalDollars,
      platformFee: s.platformFeeDollars,
      fullPricePlatformFee: s.fullPricePlatformFeeDollars,
      grossSubtotal: s.grossSubtotalDollars,
      hostFees: s.hostFeeDollars,
      subtotalAfterHostFees: s.subtotalDollars + s.hostFeeDollars,
      promoCodeTicketCount: p.eligibleTicketCount,
      freeTicketDiscount: s.freeSubscriptionDiscountDollars,
      hasSubscribed: extras.hasSubscribed ?? false,
      freeTicketId: extras.freeTicketId ?? null,
    };
  }

  return {
    // signals / computeds (read-only)
    summary,
    totalPrice,
    formattedTotal,
    attendees,
    promoState,
    tickets,
    freeTicketId,

    // mutators
    setTickets,
    applyPromo,
    clearPromo,
    setSubscribed,
    setFreeTicketId,
    setFeeConfig,
    setCurrentUserId,
    applyAttendeeDetails,
    getRsvpDataPayload
  };
}

export type RsvpState = ReturnType<typeof createRsvpState>;