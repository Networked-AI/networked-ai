import { IUser } from '@/interfaces/IUser';
import { CommonModule } from '@angular/common';
import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { UserService } from '@/services/user.service';
import { ModalService } from '@/services/modal.service';
import { TextInput } from '@/components/form/text-input';
import { EmailInput } from '@/components/form/email-input';
import { ToasterService } from '@/services/toaster.service';
import { ToggleInput } from '@/components/form/toggle-input';
import { BaseApiService } from '@/services/base-api.service';
import { validateFields } from '@/utils/form-validation';
import { StripePaymentComponent } from '@/components/common/stripe-payment';
import { StripePaymentSuccessEvent, StripePaymentErrorEvent, StripeService } from '@/services/stripe.service';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Input, signal, inject, Component, OnInit, ChangeDetectionStrategy, computed, effect, ViewChild, viewChild } from '@angular/core';
import { IonHeader, IonFooter, IonToolbar, IonIcon, ModalController, IonContent } from '@ionic/angular/standalone';

export interface RsvpDetailsData {
  tickets: any[];
  questionnaireResponses?: any[];
  promo_code?: string;
  appliedPromoCode?: any;
  discountAmount?: number;
  subtotal?: number;
  total?: number;
  platformFee?: number;
  promoCodeTicketCount?: number;
  hostFees?: number;
  subtotalAfterHostFees?: number;
  freeTicketDiscount?: number;
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
    ReactiveFormsModule,
    StripePaymentComponent
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
  @Input() hostName: string = 'Networked AI';
  @Input() isGuestMode: boolean = false;

  modalCtrl = inject(ModalController);
  rsvpDataSignal = signal<RsvpDetailsData | null>(null);

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

  // Stripe payment properties
  isLoadingPayment = signal<boolean>(false);
  paymentErrorMessage = signal<string>('');
  clientSecret = signal<string>('');
  stripePaymentIntentId = signal<string>('');

  // Guest (sign-up) flow: step 1 = details + Continue, step 2 = after OTP verification, show payment + Confirm
  guestStep = signal<'details' | 'verified'>('details');
  isGuestVerifying = signal<boolean>(false);

  // Snapshot of "Your Details" when modal opened (logged-in only), to detect changes on confirm
  initialYourDetails = signal<{ firstName: string; lastName: string; email: string } | null>(null);
  isUpdatingUserDetails = signal<boolean>(false);

  constructor() {
    super();
    this.form = this.fb.group({
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
    });

    this.guestForms = this.fb.array([]);

    effect(() => {
      const guestCount = this.totalGuestCount();
      const currentFormCount = this.guestForms.length;

      if (guestCount !== currentFormCount && guestCount > 0) {
        this.initializeGuestForms();
      }
    });
  }

  hostFees = computed(() => this.rsvpDataSignal()?.hostFees ?? 0);

  summary = computed(() => {
    const rsvp = this.rsvpDataSignal();

    if (!rsvp) {
      return [];
    }

    const subtotal = Number(rsvp.subtotal || 0);
    const total = Number(rsvp.total || 0);
    const fees = Number(total - subtotal || 0);

    const items: Array<{ label: string; amount: number }> = [
      {
        label: `Tickets (${this.totalTicketCount()})`,
        amount: +subtotal
      }
    ];

    if (fees > 0) {
      items.push({
        label: 'Fees',
        amount: fees
      });
    }

    items.push({
      label: this.eventTitle,
      amount: total
    });
    return items;
  });

  validateAllForms(): boolean {
    const isGuestFormsValid = Array.from({ length: this.guestForms.length }, (_, i) => {
      return this.guestForms.at(i)?.valid ?? true;
    }).every((valid) => valid);

    if (!this.form.valid || !isGuestFormsValid) {
      Object.keys(this.form.controls).forEach((key) => {
        this.form.get(key)?.markAsTouched();
      });
      for (let i = 0; i < this.guestForms.length; i++) {
        const guestForm = this.guestForms.at(i) as FormGroup;
        Object.keys(guestForm.controls).forEach((key) => {
          guestForm.get(key)?.markAsTouched();
        });
      }
      return false;
    }
    return true;
  }

  platformFee = computed(() => this.rsvpDataSignal()?.platformFee ?? 0);

  promoCodeTicketCount = computed(() => {
    const rsvpData = this.rsvpDataSignal();

    if (rsvpData?.promoCodeTicketCount !== undefined && rsvpData.promoCodeTicketCount > 0) {
      return rsvpData.promoCodeTicketCount;
    }

    const tickets = rsvpData?.tickets || [];
    if (tickets.length === 0) return 0;

    return tickets.reduce((sum, ticket) => {
      const quantity = ticket.selectedQuantity || 0;
      const price = ticket.price;
      return sum + (price > 0 ? quantity : 0);
    }, 0);
  });

  promoCodeDisplayName = computed(() => {
    const rsvpData = this.rsvpDataSignal();
    const promoCode = rsvpData?.promo_code || rsvpData?.appliedPromoCode?.promoCode || rsvpData?.appliedPromoCode?.promo_code || '';
    const ticketCount = this.promoCodeTicketCount();

    if (!promoCode) return '';

    return ticketCount > 0 ? `${promoCode} x${ticketCount}` : promoCode;
  });

  totalPrice = computed(() => {
    const baseTotal = this.rsvpDataSignal()?.total || 0;
    return baseTotal;
  });

  formattedTotal = computed(() => {
    return this.totalPrice()?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00';
  });

  isGuestFreeFlow = computed(() => this.isGuestMode && this.totalPrice() === 0);

  confirmButtonLabel = computed(() => {
    if (this.isGuestVerifying()) return 'Verifying...';
    if (this.isUpdatingUserDetails()) return 'Updating details...';
    if (this.isLoadingPayment()) return 'Processing Payment...';
    if (this.isGuestMode && this.guestStep() === 'details') {
      return this.isGuestFreeFlow() ? 'Confirm RSVP' : 'Create Account';
    }
    if (this.totalPrice() > 0) return `Pay $${this.formattedTotal()} and Confirm`;
    return 'Confirm RSVP';
  });

  showPaymentSection = computed(() => {
    if (!this.isGuestMode) return this.totalPrice() > 0 && this.clientSecret().length > 0;
    return this.guestStep() === 'verified' && this.totalPrice() > 0 && this.clientSecret().length > 0;
  });

  totalTicketCount = computed(() => {
    const tickets = this.rsvpDataSignal()?.tickets || [];
    return tickets.reduce((sum, ticket) => sum + (ticket.selectedQuantity || 0), 0);
  });

  totalGuestCount = computed(() => {
    return Math.max(0, this.totalTicketCount() - 1);
  });

  selectedTickets = computed(() => {
    const tickets = this.rsvpDataSignal()?.tickets || [];
    const result: Array<{ ticket: any; guestIndex: number }> = [];
    let guestIndex = 0;

    tickets.forEach((ticket) => {
      const quantity = ticket.selectedQuantity || 0;
      for (let i = 0; i < quantity; i++) {
        result.push({ ticket, guestIndex: guestIndex++ });
      }
    });

    return result;
  });

  getTicketPrice(ticket: any): string {
    if (ticket.ticket_type === 'Free') {
      return '0.00';
    }
    const price = ticket.price;
    const quantity = ticket.selectedQuantity || 0;
    return (price * quantity).toFixed(2);
  }

  formatCurrency(amount: number): string {
    return amount.toFixed(2);
  }

  async ngOnInit(): Promise<void> {
    this.rsvpDataSignal.set(this.rsvpData);

    if (!this.isGuestMode) {
      try {
        const user = await this.userService.getCurrentUser();
        this.currentUser.set(user);
        this.populateFormsWithUserData();
      } catch (error) {
        console.warn('No active user account found, forms will remain empty', error);
      }

      if (this.totalPrice() > 0) {
        await this.fetchPaymentIntent();
      }
    }
  }

  /** Guest sign-up: validate → OTP → register → update name. If paid, move to payment step; if free, caller finalizes. */
  private async continueAsGuest(): Promise<boolean> {
    this.emailInputRef()?.shouldValidate.set(true);
    if (!(await validateFields(this.form, ['firstName', 'lastName', 'email']))) {
      this.emailInputRef()?.shouldValidate.set(false);
      this.toasterService.showError('Please fill all details and use a valid email that is not already registered.');
      return false;
    }
    this.emailInputRef()?.shouldValidate.set(false);
    const email = this.form.get('email')?.value?.trim();
    if (!email) return false;

    this.isGuestVerifying.set(true);
    try {
      await this.authService.sendOtp({ email });
      const verified = await this.modalService.openOtpModal(email, '');
      if (!verified) {
        this.toasterService.showError('Invalid or expired verification code.');
        return false;
      }
      await this.modalService.openLoadingModal('Creating your account...');
      await this.authService.register({ email });
      const firstName = this.form.get('firstName')?.value?.trim() || '';
      const lastName = this.form.get('lastName')?.value?.trim() || '';
      await this.userService.updateCurrentUser(
        this.userService.generateUserPayload({ first_name: firstName, last_name: lastName })
      );
      await this.modalService.close();
      this.currentUser.set(this.authService.currentUser());
      if (this.totalPrice() > 0) {
        this.guestStep.set('verified');
        await this.fetchPaymentIntent();
      }
      return true;
    } catch (error) {
      this.toasterService.showError(BaseApiService.getErrorMessage(error, 'Failed to verify or create account.'));
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
        subtotal: this.rsvpDataSignal()?.subtotal || 0,
        total: this.rsvpDataSignal()?.total || 0
      });

      if (response?.client_secret) {
        this.clientSecret.set(response.client_secret);
        if (response.stripe_payment_intent_id) {
          this.stripePaymentIntentId.set(response.stripe_payment_intent_id);
        }
      } else {
        this.paymentErrorMessage.set('Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Error fetching payment intent:', error);
      this.paymentErrorMessage.set(error?.message || 'Failed to initialize payment');
      const message = BaseApiService.getErrorMessage(error, 'Failed to initialize payment');
      this.toasterService.showError(message, 'top', 5000);
    } finally {
      this.isLoadingPayment.set(false);
    }
  }

  populateFormsWithUserData(): void {
    const user = this.currentUser();
    if (!user) return;

    const nameParts = user.name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const email = user.email || '';

    this.form.patchValue({
      firstName,
      lastName,
      email
    });
    this.initialYourDetails.set({ firstName, lastName, email });
  }

  initializeGuestForms(): void {
    const totalGuests = this.totalGuestCount();

    while (this.guestForms.length > 0) {
      this.guestForms.removeAt(0);
    }

    this.guestAttendances.set(new Map());
    this.guestIncognitos.set(new Map());

    for (let i = 0; i < totalGuests; i++) {
      const guestForm = this.fb.group({
        guestFirstName: ['', [Validators.required]],
        guestLastName: ['', [Validators.required]],
        isIncognito: [false]
      });

      this.guestForms.push(guestForm);

      const attendances = this.guestAttendances();
      const incognitos = this.guestIncognitos();
      attendances.set(i, 'going');
      incognitos.set(i, false);
      this.guestAttendances.set(new Map(attendances));
      this.guestIncognitos.set(new Map(incognitos));
    }
  }

  getGuestForm(index: number): FormGroup {
    return this.guestForms.at(index) as FormGroup;
  }

  setGuestAttendance(index: number, attendance: 'going' | 'maybe'): void {
    const attendances = this.guestAttendances();
    attendances.set(index, attendance);
    this.guestAttendances.set(new Map(attendances));
  }

  getGuestAttendance(index: number): 'going' | 'maybe' {
    return this.guestAttendances().get(index) || 'going';
  }

  async dismiss(): Promise<void> {
    if (this.isGuestMode && this.guestStep() === 'details') {
      const success = await this.continueAsGuest();
      if (!success) return;
      if (this.isGuestFreeFlow()) this.finalizeRsvpAndClose();
      return;
    }

    if (!this.validateAllForms()) {
      this.toasterService.showError('Please fill all details.');
      return;
    }

    const formValue = this.form.getRawValue();
    const { firstName, lastName, email } = formValue;
    const firstNameVal = (firstName as string)?.trim() ?? '';
    const lastNameVal = (lastName as string)?.trim() ?? '';
    const emailVal = (email as string)?.trim() ?? '';

    if (!this.isGuestMode) {
      const updated = await this.syncLoggedInUserDetailsIfChanged(firstNameVal, lastNameVal, emailVal);
      if (!updated) return;
    }

    if (this.totalPrice() > 0) {
      const paymentSuccess = await this.paymentComponent.processPayment({
        name: `${firstNameVal} ${lastNameVal}`.trim(),
        email: emailVal
      });
      if (!paymentSuccess) {
        return;
      }
    }

    this.finalizeRsvpAndClose();
  }

  /**
   * When logged in, sync changed first name, last name or email to DB. Email requires OTP verification.
   * Single updateCurrentUser call with all changed fields. Returns false to abort (e.g. OTP failed).
   */
  private async syncLoggedInUserDetailsIfChanged(
    firstName: string,
    lastName: string,
    newEmail: string
  ): Promise<boolean> {
    const initial = this.initialYourDetails();
    if (!initial) return true;

    const nameChanged = firstName !== initial.firstName || lastName !== initial.lastName;
    const emailChanged = newEmail !== initial.email && newEmail.length > 0;
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
        await this.authService.sendOtp({ email: newEmail });
        const verified = await this.modalService.openOtpModal(newEmail, '');
        if (!verified) {
          this.toasterService.showError('Email verification was not completed. Please try again.');
          return false;
        }
      }

      const payload = this.userService.generateUserPayload({
        ...(nameChanged && { first_name: firstName, last_name: lastName }),
        ...(emailChanged && { email: newEmail })
      });
      if (Object.keys(payload).length > 0) {
        await this.userService.updateCurrentUser(payload);
        this.currentUser.set(this.authService.currentUser());
        this.initialYourDetails.set({ firstName, lastName, email: newEmail });
      }
      return true;
    } catch (error) {
      this.toasterService.showError(BaseApiService.getErrorMessage(error, 'Failed to update your details.'));
      return false;
    } finally {
      this.isUpdatingUserDetails.set(false);
    }
  }

  async finalizeRsvpAndClose(): Promise<void> {
    const guestDetails = Array.from({ length: this.guestForms.length }, (_, i) => {
      const guestForm = this.guestForms.at(i) as FormGroup;
      return {
        firstName: guestForm.get('guestFirstName')?.value,
        lastName: guestForm.get('guestLastName')?.value,
        attendance: this.getGuestAttendance(i),
        isIncognito: guestForm.get('isIncognito')?.value || false
      };
    });

    const formData = {
      yourDetails: {
        firstName: this.form.get('firstName')?.value,
        lastName: this.form.get('lastName')?.value,
        email: this.form.get('email')?.value
      },
      guestDetails: guestDetails.length > 0 ? guestDetails : null,
      rsvpData: this.rsvpDataSignal(),
      stripePaymentIntentId: this.stripePaymentIntentId(),
      isNewUser: this.isGuestMode
    };
    await this.modalCtrl.dismiss(formData);
  }

  onPaymentSuccess(event: StripePaymentSuccessEvent): void {
    // Payment succeeded - update payment intent ID from the event
    if (event.paymentIntentId) {
      this.stripePaymentIntentId.set(event.paymentIntentId);
    }
  }

  onPaymentError(event: StripePaymentErrorEvent): void {
    this.paymentErrorMessage.set(event.error);
  }

  onPaymentProcessing(isProcessing: boolean): void {
    this.isLoadingPayment.set(isProcessing);
  }

  close(): void {
    this.modalService.close();
  }
}
