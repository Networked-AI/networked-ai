import { Browser } from '@capacitor/browser';
import { ModalService } from './modal.service';
import { ToasterService } from './toaster.service';
import { Injectable, inject } from '@angular/core';
import { environment } from 'src/environments/environment';
import { BaseApiService } from '@/services/base-api.service';

export interface PaymentIntentRequest {
  amount?: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, string>;
  event_id?: string;
  event_ticket_id?: string;
  event_promo_code_id?: string;
  subtotal?: number;
  total?: number;
  stripe_payment_intent_id?: string;
}

export interface PaymentIntentResponse {
  currency: string;
  amount: number;
  stripe_payment_intent_id: string;
  client_secret: string;
}

export interface StripeAccountResponse {
  stripe_account_id?: string;
  stripe_account_status?: string;
  url?: string;
}

export interface StripePaymentSuccessEvent {
  success: boolean;
  paymentIntentId: string;
  paymentIntent: any;
}

export interface StripePaymentErrorEvent {
  success: false;
  error: string;
}

@Injectable({ providedIn: 'root' })
export class StripeService extends BaseApiService {
  private toasterService = inject(ToasterService);
  private modalService = inject(ModalService);

  async createPaymentIntent(payload: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    try {
      const response: any = await this.post<PaymentIntentResponse>('/events/payment-intent', payload);
      return response?.data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async updatePaymentIntent(payload: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    try {
      const response: any = await this.put<PaymentIntentResponse>('/events/payment-intent', payload);
      return response?.data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  async createStripeAccount(return_url: string): Promise<StripeAccountResponse> {
    try {
      const response: any = await this.post<StripeAccountResponse>('/stripe/account', { return_url });
      return response?.data;
    } catch (error) {
      console.error('Error creating Stripe account:', error);
      throw error;
    }
  }

  async getStripeDashboard(): Promise<{ url: string }> {
    try {
      const response: any = await this.get<{ url: string }>('/stripe/dashboard');
      return response?.data;
    } catch (error) {
      console.error('Error getting Stripe dashboard:', error);
      throw error;
    }
  }

  private getStripeModalConfig(status?: string, context?: string) {
    const baseMessage = context
      ? `To ${context}, you must setup your payout details with Stripe.`
      : `You must setup your payout details with Stripe.`;

    switch (status) {
      case 'action_needed':
        return {
          title: 'Complete Payout Setup',
          confirmLabel: 'Continue Setup',
          description: baseMessage
        };

      case 'pending_verification':
        return {
          title: 'Verification in Progress',
          confirmLabel: 'Okay',
          description: 'Your payout details are currently under verification.',
          disableConfirm: true
        };

      default:
        return {
          title: 'Add Payout Details',
          confirmLabel: 'Connect Payment',
          description: baseMessage
        };
    }
  }

  async openStripePayoutModal(context?: string, status?: string): Promise<void> {
    const config = this.getStripeModalConfig(status, context);

    await this.modalService.openConfirmModal({
      icon: 'assets/svg/payoutIcon.svg',
      iconBgColor: '#C73838',
      title: config.title,
      description: config.description,
      confirmButtonLabel: config.confirmLabel,
      cancelButtonLabel: 'Maybe Later',
      confirmButtonColor: 'primary',
      iconPosition: 'center',
      onConfirm: config.disableConfirm ? undefined : () => this.handleStripeAccountCreation()
    });
  }

  async handleStripeAccountCreation(): Promise<void> {
    try {
      const returnUrl = `${environment.frontendUrl}/profile`;
      const accountResponse: any = await this.createStripeAccount(returnUrl);
      if (accountResponse?.url) {
        await Browser.open({ url: accountResponse.url });
      } else {
        this.toasterService.showError(accountResponse?.message || 'Failed to get Stripe account URL. Please try again.');
      }
    } catch (error) {
      console.error('Error creating Stripe account:', error);
      this.toasterService.showError('Error creating Stripe account. Please try again.');
    }
  }
}
