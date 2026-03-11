import {
  Input,
  signal,
  inject,
  Component,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  effect,
  ViewChild,
  viewChild,
  PLATFORM_ID
} from '@angular/core';
import { IUser } from '@/interfaces/IUser';
import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';
import { ModalService } from '@/services/modal.service';
import { TextInput } from '@/components/form/text-input';
import { validateFields } from '@/utils/form-validation';
import { EmailInput } from '@/components/form/email-input';
import { ToasterService } from '@/services/toaster.service';
import { ToggleInput } from '@/components/form/toggle-input';
import { BaseApiService } from '@/services/base-api.service';
import { PromoCodeSectionStateChange } from '@/interfaces/event';
import { StripePaymentComponent } from '@/components/common/stripe-payment';
import { EventMediaBlockComponent } from '@/components/common/event-media-block';
import { CommonModule, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { createRsvpState, RsvpPromoState, RsvpTicketInput } from '@/utils/rsvp-state';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { PromoCodeSectionComponent } from '@/components/common/promo-code-section/promo-code-section';
import { StripePaymentSuccessEvent, StripePaymentErrorEvent, StripeService } from '@/services/stripe.service';
import { IonHeader, IonFooter, IonToolbar, IonIcon, ModalController, IonContent } from '@ionic/angular/standalone';

export interface RsvpDetailsData {
  tickets: any[];
  questionnaireResponses?: any[];
  promo_codes?: any[];
  promo_code?: string;
  appliedPromoCode?: any;
  discountAmount?: number;
  subtotal?: number;
  total?: number;
  platformFee?: number;
  fullPricePlatformFee?: number;
  grossSubtotal?: number;
  promoCodeTicketCount?: number;
  hostFees?: number;
  subtotalAfterHostFees?: number;
  freeTicketDiscount?: number;
  hasSubscribed?: boolean;
  freeTicketId?: string | null;
}

@Component({
  selector: 'rsvp-details-modal',
  styleUrl: './rsvp-details-modal.scss',
  templateUrl: './rsvp-details-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    IonIcon,
    IonHeader,
    IonFooter,
    TextInput,
    IonContent,
    IonToolbar,
    EmailInput,
    ToggleInput,
    CommonModule,
    NgTemplateOutlet,
    ReactiveFormsModule,
    StripePaymentComponent,
    PromoCodeSectionComponent,
    EventMediaBlockComponent
  ]
})
export class RsvpDetailsModal extends BaseApiService implements OnInit {
  @ViewChild(StripePaymentComponent) paymentComponent!: StripePaymentComponent;
  @Input() eventTitle: string = '';
  @Input() date: string = '';
  @Input() location: string = '';
  @Input() eventId: string = '';
  @Input() rsvpData: RsvpDetailsData | null = null;
  @Input() hostPaysFees: boolean = false;
  @Input() additionalFees: string | number | null = null;
  @Input() hostName: string = '';
  @Input() isGuestMode: boolean = false;
  @Input() participants: Array<{ user_id?: string; user?: { id?: string }; role?: string }> = [];
  @Input() imageUrl: string = '';
  // Replace the existing emailInputRef viewChild line and add isTabletLayout:
  private platformId = inject(PLATFORM_ID);
  isTabletLayout = signal(false);

  modalCtrl = inject(ModalController);
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private modalService = inject(ModalService);
  private stripeService = inject(StripeService);
  private toasterService = inject(ToasterService);

  emailInputRef = viewChild<EmailInput>('emailInputRef');

  form: FormGroup;
  guestForms: FormArray;

  currentUser = signal<IUser | null>(null);
  guestAttendances = signal<Map<number, 'going' | 'maybe'>>(new Map());
  guestIncognitos = signal<Map<number, boolean>>(new Map());
  isActuallyNewUser = signal<boolean>(false);
  // Stripe
  isLoadingPayment = signal<boolean>(false);
  paymentErrorMessage = signal<string>('');
  clientSecret = signal<string>('');
  stripePaymentIntentId = signal<string>('');

  // Guest flow
  guestStep = signal<'details' | 'verified'>('details');
  isGuestVerifying = signal<boolean>(false);

  initialYourDetails = signal<{ firstName: string; lastName: string; email: string } | null>(null);
  isUpdatingUserDetails = signal<boolean>(false);

  rsvp = createRsvpState({ hostPaysFees: false, additionalFees: null });

  constructor() {
    super();
    this.form = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]]
    });
    this.guestForms = this.fb.array([]);

    effect(() => {
      const guestCount = this.totalGuestCount();
      if (guestCount !== this.guestForms.length && guestCount > 0) {
        this.initializeGuestForms();
      }
    });
  }

  totalPrice = computed(() => this.rsvp.totalPrice());
  formattedTotal = computed(() => this.totalPrice().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00');

  platformFee = computed(() => this.rsvp.summary().platformFeeDollars);
  hostFees = computed(() => this.rsvp.summary().hostFeeDollars);

  summary = computed(() => {
    const s = this.rsvp.summary();
    const items: Array<{ label: string; amount: number }> = [{ label: `Tickets (${this.totalTicketCount()})`, amount: s.subtotalDollars }];
    if (s.platformFeeDollars > 0) {
      items.push({ label: 'Fees', amount: s.platformFeeDollars });
    }
    items.push({ label: this.eventTitle, amount: s.totalDollars });
    return items;
  });

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

  hasPromoCodes = computed(() => {
    const codes = this.rsvpData?.promo_codes;
    return codes && codes.length > 0 && this.hasPaidTickets();
  });

  hasPaidTickets = computed(() => (this.rsvpData?.tickets || []).some((t) => (t.selectedQuantity ?? 0) > 0 && (t.price ?? 0) > 0));

  promoCodeDisplayName = computed(() => {
    const code = this.rsvp.promoState().promoCode || this.rsvpData?.promo_code || '';
    const count = this.rsvp.promoState().eligibleTicketCount || this.rsvpData?.promoCodeTicketCount || 0;
    if (!code) return '';
    return count > 0 ? `${code} x${count}` : code;
  });

  isGuestFreeFlow = computed(() => this.isGuestMode && this.totalPrice() === 0);

  confirmButtonLabel = computed(() => {
    if (this.isGuestVerifying()) return 'Verifying...';
    if (this.isUpdatingUserDetails()) return 'Updating details...';
    if (this.isLoadingPayment()) return 'Processing Payment...';
    if (this.isGuestMode && this.guestStep() === 'details') {
      return 'Create Account';
    }
    if (this.totalPrice() > 0) return `Pay $${this.formattedTotal()} and Confirm`;
    return 'Confirm RSVP';
  });

  showPaymentSection = computed(() => {
    if (!this.isGuestMode) return this.totalPrice() > 0 && this.clientSecret().length > 0;
    return this.guestStep() === 'verified' && this.totalPrice() > 0 && this.clientSecret().length > 0;
  });

  totalTicketCount = computed(() => (this.rsvpData?.tickets || []).reduce((s: number, t: any) => s + (t.selectedQuantity || 0), 0));

  totalGuestCount = computed(() => Math.max(0, this.totalTicketCount() - 1));

  selectedTickets = computed(() => {
    const result: Array<{ ticket: any; guestIndex: number }> = [];
    let i = 0;
    for (const ticket of this.rsvpData?.tickets || []) {
      for (let q = 0; q < (ticket.selectedQuantity || 0); q++) {
        result.push({ ticket, guestIndex: i++ });
      }
    }
    return result;
  });

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      this.isTabletLayout.set(window.innerWidth >= 768);
    }
    this.rsvp.setFeeConfig({ hostPaysFees: this.hostPaysFees, additionalFees: this.additionalFees });
    this.rsvp.setCurrentUserId(this.authService.currentUser()?.id ?? null);

    // ── SET SUBSCRIPTION STATE FIRST before setTickets ──
    const hasSubscribed = !!(this.rsvpData as any)?.hasSubscribed;
    this.rsvp.setSubscribed(hasSubscribed);
    const freeTicketId = (this.rsvpData as any)?.freeTicketId ?? null;
    if (freeTicketId) this.rsvp.setFreeTicketId(String(freeTicketId));

    // Load tickets — summary now calculates with correct subscription state
    const ticketInputs: RsvpTicketInput[] = (this.rsvpData?.tickets || []).map((t: any) => ({
      id: String(t.id),
      name: t.name,
      price: t.price,
      ticket_type: t.ticket_type,
      selectedQuantity: t.selectedQuantity ?? 0
    }));
    this.rsvp.setTickets(ticketInputs);

    // Pre-populate promo if already applied upstream
    if (this.rsvpData?.promo_code || this.rsvpData?.appliedPromoCode) {
      const code = this.rsvpData.promo_code || this.rsvpData.appliedPromoCode?.promoCode || this.rsvpData.appliedPromoCode?.promo_code || '';
      const discount = this.rsvpData.discountAmount || 0;
      if (code) {
        this.rsvp.applyPromo({
          promoInput: code,
          promoCode: code,
          appliedPromoCode: this.rsvpData.appliedPromoCode || null,
          promoId: this.rsvpData.appliedPromoCode?.id ?? null,
          discountDollars: discount,
          eligibleTicketCount: this.rsvpData.promoCodeTicketCount ?? 0,
          isValid: discount > 0,
          message: discount > 0 ? `You saved $${discount.toFixed(2)}` : ''
        });
      }
    }

    if (!this.isGuestMode) {
      try {
        const user = await this.userService.getCurrentUser();
        this.currentUser.set(user);
        this.populateFormsWithUserData();
      } catch (e) {
        console.warn('No user found', e);
      }
      if (this.totalPrice() > 0) await this.fetchPaymentIntent();
    }
  }

  onPromoStateChange(change: PromoCodeSectionStateChange): void {
    const { reason, state } = change;

    // Store previous applied promo id BEFORE mutating state
    const previousPromoId = this.rsvp.promoState().appliedPromoCode?.id ?? null;

    if (!state.promoCode && !state.promoValidation.isValid) {
      this.rsvp.clearPromo();
    } else {
      this.rsvp.applyPromo({
        promoInput: state.promoInput,
        promoCode: state.promoCode,
        appliedPromoCode: state.appliedPromoCode,
        promoId: (state.appliedPromoCode as any)?.id ?? null,
        discountDollars: state.discountAmount,
        eligibleTicketCount: state.promoValidation.eligibleTicketCount ?? 0,
        isValid: state.promoValidation.isValid,
        message: state.promoValidation.message
      });
    }

    // Compare AFTER mutation
    const currentPromoId = this.rsvp.promoState().appliedPromoCode?.id ?? null;

    const promoWasRemoved = previousPromoId && !currentPromoId;
    const promoWasApplied = !previousPromoId && currentPromoId;
    const promoWasChanged = previousPromoId && currentPromoId && previousPromoId !== currentPromoId;

    if (promoWasRemoved || promoWasApplied || promoWasChanged) {
      void this.syncPaymentIntent();
    }
  }

  private async syncPaymentIntent(): Promise<void> {
    try {
      const total = this.totalPrice();
      const subtotal = this.rsvp.summary().subtotalDollars;
      if (total <= 0) {
        this.clientSecret.set('');
        return;
      }
      const hasIntent = !!this.stripePaymentIntentId();

      const payload = {
        event_id: this.eventId,
        subtotal,
        total,
        ...(hasIntent && {
          stripe_payment_intent_id: this.stripePaymentIntentId()
        })
      };

      const response = hasIntent ? await this.stripeService.updatePaymentIntent(payload) : await this.stripeService.createPaymentIntent(payload);
      if (response?.client_secret) {
        this.clientSecret.set(response.client_secret);
        if (response.stripe_payment_intent_id) {
          this.stripePaymentIntentId.set(response.stripe_payment_intent_id);
        }
      } else {
        this.paymentErrorMessage.set('Failed to initialize payment');
      }
    } catch (e) {
      console.error('Failed to sync payment intent', e);
    }
  }

  validateAllForms(): boolean {
    const guestValid = Array.from({ length: this.guestForms.length }, (_, i) => this.guestForms.at(i)?.valid ?? true).every((v) => v);

    if (!this.form.valid || !guestValid) {
      Object.keys(this.form.controls).forEach((k) => this.form.get(k)?.markAsTouched());
      for (let i = 0; i < this.guestForms.length; i++) {
        const g = this.guestForms.at(i) as FormGroup;
        Object.keys(g.controls).forEach((k) => g.get(k)?.markAsTouched());
      }
      return false;
    }
    return true;
  }

  getTicketPrice(ticket: any): string {
    if (ticket.ticket_type === 'Free') return '0.00';
    return (ticket.price * (ticket.selectedQuantity || 0)).toFixed(2);
  }

  formatCurrency(n: number): string {
    return n.toFixed(2);
  }

  private async continueAsGuest(): Promise<boolean> {
    this.emailInputRef()?.shouldValidate.set(true);
    if (!(await validateFields(this.form, ['firstName', 'lastName', 'email']))) {
      this.emailInputRef()?.shouldValidate.set(false);

      // ── Email already registered → open login modal pre-filled ──
      const emailControl = this.form.get('email');
      if (emailControl?.errors?.['taken']) {
        const email = emailControl.value?.trim() ?? '';

        const confirmResult = await this.modalService.openConfirmModal({
          iconName: 'pi-user',
          iconPosition: 'center',
          iconBgColor: 'linear-gradient(138.06deg, #F5BC61 8.51%, #C89034 48.28%, #9E660A 85.69%)',
          title: 'Account already exists',
          description: 'An account with this email already exists. Do you want to login instead?',
          cancelButtonLabel: 'Cancel',
          confirmButtonLabel: 'Login',
          confirmButtonColor: 'primary'
        });

        if (confirmResult?.role === 'confirm') {
          const loginResult = await this.modalService.openLoginModal(undefined, email);

          if (loginResult?.success) {
            const user = await this.userService.getCurrentUser();
            this.currentUser.set(user);
            this.populateFormsWithUserData();
            this.guestStep.set('verified');
            this.isActuallyNewUser.set(loginResult.isNewUser ?? false);

            if (this.totalPrice() > 0) {
              await this.fetchPaymentIntent();
            }
          }
        }

        return false;
      }

      this.toasterService.showError('Please fill all details and use a valid email that is not already registered.');
      return false;
    }
    this.emailInputRef()?.shouldValidate.set(false);
    const email = this.form.get('email')?.value?.trim();
    if (!email) return false;

    this.isGuestVerifying.set(true);
    try {
      await this.authService.sendOtp({ email });
      if (!(await this.modalService.openOtpModal(email, ''))) {
        this.toasterService.showError('Invalid or expired verification code.');
        return false;
      }
      await this.modalService.openLoadingModal('Creating your account...');
      await this.authService.register({ email });
      this.isActuallyNewUser.set(true);
      const fn = this.form.get('firstName')?.value?.trim() || '';
      const ln = this.form.get('lastName')?.value?.trim() || '';
      await this.userService.updateCurrentUser(this.userService.generateUserPayload({ first_name: fn, last_name: ln }));
      await this.modalService.close();
      this.currentUser.set(this.authService.currentUser());
      if (this.totalPrice() > 0) {
        this.guestStep.set('verified');
        await this.fetchPaymentIntent();
      }
      return true;
    } catch (e) {
      this.toasterService.showError(BaseApiService.getErrorMessage(e, 'Failed to verify or create account.'));
      return false;
    } finally {
      this.isGuestVerifying.set(false);
    }
  }

  async fetchPaymentIntent(): Promise<void> {
    try {
      this.isLoadingPayment.set(true);
      this.paymentErrorMessage.set('');
      const response = await this.stripeService.createPaymentIntent({
        event_id: this.eventId,
        subtotal: this.rsvpData?.subtotal || 0,
        total: this.rsvpData?.total || 0
      });
      if (response?.client_secret) {
        this.clientSecret.set(response.client_secret);
        if (response.stripe_payment_intent_id) {
          this.stripePaymentIntentId.set(response.stripe_payment_intent_id);
        }
      } else {
        this.paymentErrorMessage.set('Failed to initialize payment');
      }
    } catch (e: any) {
      this.paymentErrorMessage.set(e?.message || 'Failed to initialize payment');
      this.toasterService.showError(BaseApiService.getErrorMessage(e, 'Failed to initialize payment'), 'top', 5000);
    } finally {
      this.isLoadingPayment.set(false);
    }
  }

  onPaymentSuccess(e: StripePaymentSuccessEvent): void {
    if (e.paymentIntentId) this.stripePaymentIntentId.set(e.paymentIntentId);
  }

  onPaymentError(e: StripePaymentErrorEvent): void {
    this.paymentErrorMessage.set(e.error);
  }
  onPaymentProcessing(v: boolean): void {
    this.isLoadingPayment.set(v);
  }

  populateFormsWithUserData(): void {
    const user = this.currentUser();
    if (!user) return;
    const parts = user.name?.split(' ') || [];
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    this.form.patchValue({ firstName, lastName, email: user.email || '' });
    this.initialYourDetails.set({ firstName, lastName, email: user.email || '' });
  }

  initializeGuestForms(): void {
    while (this.guestForms.length > 0) this.guestForms.removeAt(0);
    this.guestAttendances.set(new Map());
    this.guestIncognitos.set(new Map());

    for (let i = 0; i < this.totalGuestCount(); i++) {
      this.guestForms.push(
        this.fb.group({
          guestFirstName: ['', [Validators.required]],
          guestLastName: ['', [Validators.required]],
          isIncognito: [false]
        })
      );
      const a = this.guestAttendances();
      a.set(i, 'going');
      this.guestAttendances.set(new Map(a));
      const b = this.guestIncognitos();
      b.set(i, false);
      this.guestIncognitos.set(new Map(b));
    }
  }

  getGuestForm(i: number): FormGroup {
    return this.guestForms.at(i) as FormGroup;
  }

  setGuestAttendance(i: number, v: 'going' | 'maybe'): void {
    const m = this.guestAttendances();
    m.set(i, v);
    this.guestAttendances.set(new Map(m));
  }

  getGuestAttendance(i: number): 'going' | 'maybe' {
    return this.guestAttendances().get(i) || 'going';
  }

  async dismiss(): Promise<void> {
    if (this.isCurrentUserHostOrCoHost()) {
      this.toasterService.showError('You are the host or co-host. You cannot RSVP as a guest.');
      return;
    }
    if (this.isGuestMode && this.guestStep() === 'details') {
      const ok = await this.continueAsGuest();
      if (!ok) return;
      if (this.isGuestFreeFlow()) this.finalizeRsvpAndClose();
      return;
    }

    if (!this.validateAllForms()) {
      this.toasterService.showError('Please fill all details.');
      return;
    }

    const { firstName, lastName, email } = this.form.getRawValue();
    const fn = (firstName as string)?.trim() ?? '';
    const ln = (lastName as string)?.trim() ?? '';
    const em = (email as string)?.trim() ?? '';

    if (!this.isGuestMode) {
      if (!(await this.syncLoggedInUserDetailsIfChanged(fn, ln, em))) return;
    }

    if (this.totalPrice() > 0) {
      if (!(await this.paymentComponent.processPayment({ name: `${fn} ${ln}`.trim(), email: em }))) return;
    }

    this.finalizeRsvpAndClose();
  }

  private async syncLoggedInUserDetailsIfChanged(fn: string, ln: string, em: string): Promise<boolean> {
    const initial = this.initialYourDetails();
    if (!initial) return true;
    const nameChanged = fn !== initial.firstName || ln !== initial.lastName;
    const emailChanged = em !== initial.email && em.length > 0;
    if (!nameChanged && !emailChanged) return true;

    this.isUpdatingUserDetails.set(true);
    try {
      if (emailChanged) {
        this.emailInputRef()?.shouldValidate.set(true);
        if (!(await validateFields(this.form, ['email']))) {
          this.emailInputRef()?.shouldValidate.set(false);
          this.toasterService.showError('Please enter a valid email address.');
          return false;
        }
        this.emailInputRef()?.shouldValidate.set(false);
        await this.authService.sendOtp({ email: em });
        if (!(await this.modalService.openOtpModal(em, ''))) {
          this.toasterService.showError('Email verification was not completed.');
          return false;
        }
      }
      const payload = this.userService.generateUserPayload({
        ...(nameChanged && { first_name: fn, last_name: ln }),
        ...(emailChanged && { email: em })
      });
      if (Object.keys(payload).length > 0) {
        await this.userService.updateCurrentUser(payload);
        this.currentUser.set(this.authService.currentUser());
        this.initialYourDetails.set({ firstName: fn, lastName: ln, email: em });
      }
      return true;
    } catch (e) {
      this.toasterService.showError(BaseApiService.getErrorMessage(e, 'Failed to update your details.'));
      return false;
    } finally {
      this.isUpdatingUserDetails.set(false);
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

  async finalizeRsvpAndClose(): Promise<void> {
    const guestDetails = Array.from({ length: this.guestForms.length }, (_, i) => {
      const g = this.guestForms.at(i) as FormGroup;
      return {
        firstName: g.get('guestFirstName')?.value,
        lastName: g.get('guestLastName')?.value,
        attendance: this.getGuestAttendance(i),
        isIncognito: g.get('isIncognito')?.value || false
      };
    });

    const promo = this.rsvp.promoState();
    await this.modalCtrl.dismiss({
      yourDetails: {
        firstName: this.form.get('firstName')?.value,
        lastName: this.form.get('lastName')?.value,
        email: this.form.get('email')?.value
      },
      guestDetails: guestDetails.length > 0 ? guestDetails : null,
      rsvpData: this.rsvpData,
      promo_code: promo.promoCode,
      appliedPromoCode: promo.appliedPromoCode,
      discountAmount: promo.discountDollars,
      promoValidation: this.promoValidation(),
      promoInput: promo.promoInput,
      stripePaymentIntentId: this.stripePaymentIntentId(),
      isNewUser: this.isActuallyNewUser()
    });
  }

  close(): void {
    this.modalService.close();
  }
}
