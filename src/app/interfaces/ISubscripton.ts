export interface PlanData {
  id: string;
  name: string;
  description?: string;
  plan_benefits?: string[];
  is_sponsor: boolean;
  active: boolean;
  user_id: string;

  prices: PriceData[];

  user?: UserData;
  events?: EventData[];
  product?: Product;
  total_subscribers: number;
  event_ids?: string[];
}
export interface UserData {
  id: string;
  name: string;
  email: string;
  mobile: string;
  username: string;
  image_url: string;
  thumbnail_url: string;
  total_events_attended: number;
  total_gamification_points: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;

  plan_benefits: string[];

  is_sponsor: boolean;
  active: boolean;
  is_deleted: boolean;

  events: Event[];
}

export interface SubscriptionData {
  id: string;
  user_id: string;
  owner_id: string;
  product_id: string;
  price_id: string;
  status: 'active' | 'inactive' | 'canceled';
  start_date: string; // ISO date
  end_date: string; // ISO date
  cancel_at_end_date: boolean;
  canceled_at: string | null;
  created_at: string;
}
export interface PriceData {
  id: string;
  amount: string;
  interval: 'month' | 'year';
  active: boolean;
  discount_percentage?: number | null;
  banner_display_type?: 'percentage' | 'fixed' | null;
  subscriptions: SubscriptionData[];
}
export interface EventData {
  id: string;
  title: string;
  slug: string;
  description: string;
  address: string;
  latitude: string;
  longitude: string;
  is_paid_event: boolean;
  start_date: string; // ISO date
  end_date: string; // ISO date
  capacity: number | null;
  is_public: boolean;
  thumbnail_url: string;
  image_url: string;
}

// Plan Analytics Interfaces
export interface PlanAnalyticsResponse {
  success: boolean;
  message: string;
  data: PlanAnalyticsData;
}

export interface PlanAnalyticsData {
  revenue: RevenueData;
  graph: GraphData;
  subscribers: SubscriberData;
  events: EventAnalyticsData;
}

export interface RevenueData {
  total: number;
  current_month: number;
}

export interface GraphData {
  mrr: GraphPoint[];
  all: GraphPoint[];
}

export interface GraphPoint {
  date?: string;
  month?: string;
  amount: number;
}

export interface SubscriberData {
  total: number;
  current_month: number;
}

export interface EventAnalyticsData {
  total: number;
  completed: number;
  upcoming: number;
}
