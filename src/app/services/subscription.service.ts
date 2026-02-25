import { HttpParams } from '@angular/common/http';
import { AuthService } from '@/services/auth.service';
import { PlanAnalyticsResponse, PlanData } from '@/interfaces/ISubscripton';
import { SubscriptionPlan } from '@/interfaces/event';
import { Injectable, signal, inject } from '@angular/core';
import { BaseApiService } from '@/services/base-api.service';

@Injectable({ providedIn: 'root' })
export class SubscriptionService extends BaseApiService {
  private authService = inject(AuthService);
  plans = signal<SubscriptionPlan[]>([]);

  // Fetch subscription plans from API for current user
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const currentUser = this.authService.currentUser();
      if (!currentUser?.id) {
        console.warn('No current user found, cannot fetch subscription plans');
        this.plans.set([]);
        return [];
      }

      const response: any = await this.get<PlanData[]>(`/subscription/plan/user/${currentUser.id}`);

      const plansData = response?.data || [];

      if (!Array.isArray(plansData) || plansData.length === 0) {
        console.warn('No subscription plans found');
        this.plans.set([]);
        return [];
      }

      const plans: SubscriptionPlan[] = plansData.map((plan) => {
        const priceRange = this.formatPriceRange(plan.prices || []);

        return {
          product_id: plan.id,
          name: plan.name,
          description: plan.description,
          type: plan.is_sponsor ? 'sponsor' : 'event',
          is_sponsor: plan.is_sponsor,
          active: plan.active,
          subscribers: plan.total_subscribers || 0,
          priceRange: priceRange,
          plan_benefits: plan.plan_benefits
        };
      });

      this.plans.set(plans);
      return plans;
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      throw error;
    }
  }

  // Fetch subscription plans from API for a specific user by user ID
  async getSubscriptionPlansByUserId(userId: string): Promise<PlanData[]> {
    try {
      const response: any = await this.get<PlanData[]>(`/subscription/plan/user/${userId}`);
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching subscription plans by user ID:', error);
      throw error;
    }
  }

  // Format price range from prices array
  private formatPriceRange(prices: Array<{ amount: string; interval: string }>): string {
    if (prices.length === 0) return '';

    const monthlyPrice = prices.find((p) => p.interval === 'month');
    const yearlyPrice = prices.find((p) => p.interval === 'year');

    const parts: string[] = [];

    if (monthlyPrice) {
      parts.push(`$${parseFloat(monthlyPrice.amount).toFixed(0)}/m`);
    }

    if (yearlyPrice) {
      parts.push(`$${parseFloat(yearlyPrice.amount).toFixed(0)}/y`);
    }

    return parts.join(' / ') || '';
  }

  // Create a new subscription plan
  async createPlan(payload: {
    name: string;
    description?: string;
    prices: Array<{
      amount: number;
      interval: 'month' | 'year';
    }>;
    is_sponsor: boolean;
    plan_benefits?: string[];
    event_ids?: string[];
  }): Promise<any> {
    try {
      const response = await this.post<any>('/subscription/plan', payload);
      return response;
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  // Get a single subscription plan by ID
  async getPlanSubscribers(planId: string, page: number = 1, limit: number = 10): Promise<any> {
    try {
      const params = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

      const response = await this.get(`/subscription/plan/${planId}/subscribers`, { params });
      return response;
    } catch (error) {
      console.error('Error fetching plan subscribers:', error);
      throw error;
    }
  }

  async getPlanById(planId: string): Promise<any> {
    try {
      const response = await this.get<any>(`/subscription/plan/${planId}`);
      return response?.data || null;
    } catch (error) {
      console.error('Error fetching subscription plan:', error);
      throw error;
    }
  }

  // Update an existing subscription plan
  async updatePlan(
    planId: string,
    payload: {
      name: string;
      description?: string;
      prices: Array<{
        amount: number;
        interval: 'month' | 'year';
        discount_percentage?: number | null;
        banner_display_type?: 'percentage' | 'fixed' | null;
      }>;
      is_sponsor: boolean;
      plan_benefits?: string[];
      event_ids?: string[];
    }
  ): Promise<any> {
    try {
      const response = await this.put<any>(`/subscription/plan/${planId}`, payload);
      return response;
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      throw error;
    }
  }

  // Delete a subscription plan
  async deletePlan(planId: string): Promise<any> {
    try {
      const response = await this.delete<any>(`/subscription/plan/${planId}`);
      return response;
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
      throw error;
    }
  }

  // Create payment intent for subscription
  async createSubscriptionPaymentIntent(priceId: string): Promise<any> {
    try {
      const response: any = await this.post<any>('/subscription/payment-intent', { priceId });
      return response?.data;
    } catch (error) {
      console.error('Error creating subscription payment intent:', error);
      throw error;
    }
  }

  // Cancel a subscription
  async cancelSubscription(subscriptionId: string): Promise<any> {
    try {
      const response = await this.post<any>(`/subscription/${subscriptionId}/cancel`, {});
      return response;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Get logged-in user's subscriptions
  async getUserSubscriptions(page: number = 1, limit: number = 10): Promise<any[]> {
    try {
      const response: any = await this.get<any>(`/subscription?page=${page}&limit=${limit}`);
      return response?.data?.data || [];
    } catch (error) {
      console.error('Error fetching user subscriptions:', error);
      throw error;
    }
  }

  async downloadPlanAnalytics(planId: string): Promise<any> {
    try {
      const response = await this.get<any>(`/subscription/plan/${planId}/analytics/export-csv`, { responseType: 'text' });
      return response;
    } catch (error) {
      console.error('Error downloading plan analytics:', error);
      throw error;
    }
  }

  async getPlanAnalytics(planId: string): Promise<PlanAnalyticsResponse> {
    try {
      const response = await this.get<PlanAnalyticsResponse>(`/subscription/plan/${planId}/analytics`);
      return response;
    } catch (error) {
      console.error('Error fetching plan analytics:', error);
      throw error;
    }
  }
}
