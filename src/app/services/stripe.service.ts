import { Injectable } from '@angular/core';
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
  stripe_payment_intent_id?:string,
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
}
