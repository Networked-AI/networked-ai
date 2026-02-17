import { IUser } from './IUser';
import { FormControl } from '@angular/forms';
import { SegmentButtonItem } from '@/components/common/segment-button';

export interface EventForm {
  medias?: FormControl<any>;
  title?: FormControl<string | null>;
  date?: FormControl<string | null>;
  start_time?: FormControl<string | null>;
  end_time?: FormControl<string | null>;
  until_finished?: FormControl<boolean | null>;
  address?: FormControl<string | null>;
  latitude?: FormControl<string | null>;
  longitude?: FormControl<string | null>;
  city?: FormControl<string | null>;
  state?: FormControl<string | null>;
  country?: FormControl<string | null>;
  category_id?: FormControl<string | null>;
  category?: FormControl<string | null>;
  vibes?: FormControl<string[] | null>;
  description?: FormControl<string | null>;
  tickets?: FormControl<Ticket[] | null>;
  promo_codes?: FormControl<PromoCode[] | null>;
  is_subscriber_exclusive?: FormControl<boolean | null>;
  is_subscription?: FormControl<boolean | null>;
  subscription_plan?: FormControl<string | null>;
  plan_ids?: FormControl<string[] | null>;
  host_pays_platform_fee?: FormControl<boolean | null>;
  additional_fees?: FormControl<string | null>;
  guest_fee_enabled?: FormControl<boolean | null>;
  participants?: FormControl<Array<{ user_id: string; role: string; thumbnail_url?: string; name?: string }> | null>;
  is_public?: FormControl<boolean | null>;
  repeating_frequency?: FormControl<RepeatingFrequencyType | null>;
  repeat_count?: FormControl<number | 'custom' | null>;
  repeating_events?: FormControl<IEvent[] | null>;
  frequency_date?: FormControl<string | null>;
  custom_repeat_count?: FormControl<number | null>;
  questionnaire?: FormControl<any | null>;
  is_rsvp_approval_required?: FormControl<boolean | null>;
  is_show_timer?: FormControl<boolean | null>;
  max_attendees_per_user?: FormControl<number | null>;
  allow_plus_ones?: FormControl<boolean | null>;
  is_repeating_event?: FormControl<boolean | null>;
}

// Raw form values interface (for patchValue)
export interface EventFormValues {
  medias?: any[];
  title?: string | null;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  until_finished?: boolean | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  category_id?: string | null;
  category?: string | null;
  vibes?: string[] | null;
  description?: string | null;
  tickets?: Ticket[] | null;
  promo_codes?: PromoCode[] | null;
  is_subscriber_exclusive?: boolean | null;
  is_subscription?: boolean | null;
  subscription_plan?: string | null;
  plan_ids?: string[] | null;
  host_pays_platform_fee?: boolean | null;
  additional_fees?: string | null;
  guest_fee_enabled?: boolean | null;
  participants?: Array<{ user_id: string; role: string; thumbnail_url?: string; name?: string }> | null;
  is_public?: boolean | null;
  repeating_frequency?: RepeatingFrequencyType | null;
  repeat_count?: number | 'custom' | null;
  repeating_events?: IEvent[] | null;
  frequency_date?: string | null;
  custom_repeat_count?: number | null;
  questionnaire?: QuestionnaireQuestion[] | null;
  is_rsvp_approval_required?: boolean | null;
  is_show_timer?: boolean | null;
  max_attendees_per_user?: number | null;
  allow_plus_ones?: boolean | null;
  is_repeating_event?: boolean | null;
}

export interface TicketFormData {
  name: string;
  price: number;
  quantity: number | null;
  description?: string;
  sales_start_date?: string | null;
  sale_start_time?: string | null;
  sales_end_date?: string | null;
  sale_end_time?: string | null;
  end_at_event_start: boolean;
  free_for_subscribers?: boolean;
  ticket_type: TicketType;
}

export interface PromoCodeFormModalData {
  id?: string;
  promo_code: string;
  value: number;
  max_uses_per_user?: number;
  capped_amount?: number | null;
  quantity?: number | null;
  type: 'Percentage' | 'Fixed';
}

export interface Ticket {
  id?: string;
  name: string;
  ticket_type: TicketType;
  price: number;
  quantity?: number | null;
  description?: string | null;
  sales_start_date?: string | null;
  sale_start_time?: string | null;
  sales_end_date?: string | null;
  sale_end_time?: string | null;
  end_at_event_start?: boolean;
  order?: number;
}

export interface TicketDisplay extends Ticket {
  status: 'sale-ended' | 'available' | 'sold-out' | 'upcoming';
  available_quantity?: number;
  selectedQuantity?: number;
  startsIn?: string;
}

export interface PromoCode {
  id?:string;
  promo_code: string;
  type: 'Percentage' | 'Fixed';
  value: number;
  capped_amount?: number | null;
  quantity?: number | null;
  max_uses_per_user?: number | null;
}

export interface SubscriptionPlan {
  product_id: string;
  name: string;
  description?: string;
  type?: 'event' | 'sponsor';
  is_sponsor?: boolean;
  active?: boolean;
  subscribers?: number;
  priceRange?: string;
  plan_benefits?: string[];
}

// Media item interface for event media arrays
export interface MediaItem {
  id?: string;
  url: string;
  type: 'Image' | 'Video' | 'image' | 'video' | 'gif';
  order?: number;
  file?: File;
  media_url?: string;
}

export interface UserSection {
  title: string;
  users: IUser[];
  overflowLabelClass?: string;
  totalCount?: number;
}

export interface EventDisplayData {
  id: string;
  thumbnail_url: string;
  image_url?: string;
  title: string;
  description: string;
  displayMedias: MediaItem[];
  total_views?: string | number;
  total_likes?: string | number;
  isPublic: boolean;
  location: string;
  hostName: string;
  mapCenter: [number, number] | null;
  admission: string;
  formattedDateTime: string;
  start_date: string;
  slug: string;
  end_date: string;
  userSections: UserSection[];
  isRepeatingEvent: boolean;
  dateItems: SegmentButtonItem[];
  rsvpButtonLabel: string;
  isCurrentUserHost: boolean;
  isCurrentUserCoHost: boolean;
  isCurrentUserAttendee?: boolean;
  isRsvpApprovalRequired?: boolean;
  hasCurrentUserRsvpRequest?: boolean;
  isCurrentUserRequestApproved?: boolean;
  isCurrentUserRequestPending?: boolean;
  isCurrentUserRequestRejected?: boolean;
  tickets: Ticket[];
  questionnaire: QuestionnaireQuestion[];
  promo_codes: PromoCode[];
  subscriptionPlanType?: 'event' | 'sponsor' | null;
  has_plans?: boolean;
  is_subscriber_exclusive?: boolean;
  has_subscribed?: boolean;
}

// Event Settings interface
export interface EventSettings {
  id?: string;
  is_repeating_event?: boolean;
  repeating_frequency?: 'Weekly' | 'Monthly';
  is_rsvp_approval_required?: boolean;
  is_show_timer?: boolean;
  max_attendees_per_user?: number;
  host_pays_platform_fee?: boolean;
  additional_fees?: number | null;
  is_subscriber_exclusive?: boolean;
}

// Event Media interface
export interface EventMedia {
  id?: string;
  media_url?: string;
  media_type?: 'Image' | 'Video';
  order?: number;
  url?: string;
  file?: File;
  type?: 'Image' | 'Video' | 'image' | 'video' | 'gif';
}

// Event Promo Code interface (API response format)
export interface EventPromoCode {
  id?: string;
  promo_code: string;
  type: 'Percentage' | 'Fixed';
  value: number;
  capped_amount?: string | null;
  available_quantity?: number | null;
  quantity?: number | null;
  max_uses_per_user?: number;
}

// Event Participant interface
export interface EventParticipant {
  id?: string;
  user_id?: string;
  role?: string;
  user?: IUser;
  name?: string;
  thumbnail_url?: string;
}

// Event Plan interface
export interface EventPlan {
  id?: string;
  name: string;
  description?: string;
  plan_benefits?: string;
  is_sponsor?: boolean;
  active?: boolean;
  prices?: Array<{
    id?: string;
    amount: string;
    interval: 'year' | 'month';
    active?: boolean;
  }>;
}

// Event Ticket interface (API response format)
export interface EventTicket {
  id?: string;
  name: string;
  price: number;
  available_quantity?: number | null;
  quantity?: number | null;
  description?: string;
  ticket_type: TicketType;
  sales_start_date?: string;
  sales_end_date?: string;
  end_at_event_start?: boolean;
  order?: number;
}

// RSVP Request interface
export interface RsvpRequest {
  id?: string;
  user_id?: string;
  event_id?: string;
  status?: 'Pending' | 'Approved' | 'Rejected' | 'pending' | 'approved' | 'rejected';
  user?: IUser;
  value?: number;
}

// Main Event interface matching API response
export interface IEvent {
  id: string;
  title: string;
  slug: string;
  description?: string;
  address?: string;
  latitude?: string;
  longitude?: string;
  city?: string;
  state?: string;
  country?: string;
  category_id?: string;
  is_paid_event?: boolean;
  start_date: string;
  end_date: string;
  capacity?: number | null;
  is_public?: boolean;
  parent_event_id?: string | null;
  thumbnail_url?: string;
  image_url?: string;
  total_views?: string | number;
  total_likes?: string | number;
  settings?: EventSettings;
  medias?: EventMedia[];
  promo_codes?: EventPromoCode[];
  vibes?: Vibe[];
  participants?: EventParticipant[];
  attendees?: EventAttendee[];
  parent_event?: IEvent | null;
  plans?: EventPlan[];
  tickets?: EventTicket[];
  questionnaire?: QuestionnaireQuestion[];
  rsvp_requests?: RsvpRequest[];
  child_events?: IEvent[];
  plan_ids?: string[];
  is_like?: boolean;
  has_plans?: boolean;
  has_subscribed?: boolean;
  subscription_id?: string;
  // Legacy fields for backward compatibility
  date?: string;
  day?: string;
  image?: string;
  location?: string;
  dayOfWeek?: string;
  organization?: string;
  start_time?: string;
  end_time?: string;
  until_finished?: boolean;
  questions?: QuestionnaireQuestion[];
  is_subscriber_exclusive?: boolean;
  created_by?: string;
}

export interface QuestionnaireQuestion {
  question: string;
  type: QuestionType;
  required: boolean;
  visibility: 'public' | 'private';
  options?: string[];
  min?: number;
  max?: number;
  rating?: number;
  order?: number;
  event_phase?: 'PreEvent' | 'PostEvent';
}

export interface EventCategory {
  id: string;
  name: string;
  icon?: string;
  value?: string;
  description?: string | null;
}

export interface Vibe {
  id: string;
  name: string;
  icon?: string;
  description?: string | null;
}

export interface VibesResponse {
  message?: string;
  success?: boolean;
  data?: Vibe[];
}

// Analytics interfaces for questionnaire analytics
export interface AnalyticsOption {
  label: string;
  value: number;
}

export interface AnalyticsScale {
  scale: number;
  value: number;
}

export interface AnalyticsQuestion {
  flag: 'pre' | 'post';
  visibility: 'public' | 'private';
  type: 'options' | 'scale';
  question: string;
  question_type: QuestionType;
  options?: AnalyticsOption[];
  scaleData?: AnalyticsScale[];
}

export interface EventResponse {
  message?: string;
  success?: boolean;
  data?: IEvent | IEvent[];
}

export interface EventCategoriesResponse {
  message?: string;
  success?: boolean;
  data?: EventCategory[];
}

export type TicketType = 'Free' | 'Paid' | 'Early Bird' | 'Sponsor' | 'Standard';

export type RepeatingFrequencyType = 'weekly' | 'monthly' | 'custom';

export enum RepeatingFrequency {
  Weekly = 'Weekly',
  Monthly = 'Monthly'
}

export type QuestionType = 'Text' | 'Number' | 'SingleChoice' | 'MultipleChoice' | 'PhoneNumber' | 'Rating';

export interface EventSettingsPayload {
  is_repeating_event: boolean;
  is_rsvp_approval_required: boolean;
  is_show_timer: boolean;
  host_pays_platform_fee: boolean;
  repeating_frequency?: RepeatingFrequency;
  max_attendees_per_user?: number;
  additional_fees?: number;
}

export interface EventsResponse {
  message?: string;
  success?: boolean;
  data?: any;
}

export interface EventData {
  slug: string;
  id?: string;
  title: string;
  location: string;
  latLng: {
    lat: number;
    lng: number;
  };
  address: string;
  public: boolean;
  dates: {
    [id: string]: {
      start: number;
      end: number;
    };
  };
  img?: string[];
  description?: string;
  promoCodes?: PromoCode[];
  tickets?: Ticket[];
  guestFeeEnabled?: boolean;
  iap?: boolean;
  start_date?: string;
  medias?: MediaItem[];
}

// Event Attendee interface for RSVP
export interface EventAttendee {
  id?: string;
  event_id?: string;
  user_id?: string;
  parent_user_id?: string | null;
  name?: string;
  is_incognito?: boolean;
  rsvp_status?: 'Yes' | 'No' | 'Maybe' | string;
  is_checked_in?: boolean;
  event_ticket_id?: string;
  event_promo_code_id?: string | null;
  platform_fee_amount?: string;
  amount_paid?: string;
  host_payout_amount?: string;
  apple_wallet_pass_url?: string;

  user?: {
    id?: string;
    name?: string;
    email?: string;
    mobile?: string;
    username?: string;
    image_url?: string;
    thumbnail_url?: string;
    total_gamification_points?: number;
    total_gamification_points_weekly?: number;
    company_name?: string;
    connection_status?: 'Connected' | 'NotConnected' | string;
  };

  event_ticket?: {
    id?: string;
    name?: string;
    price?: string | number;
    available_quantity?: number;
    quantity?: number;
    description?: string;
    ticket_type?: string;
    sales_start_date?: string;
    sales_end_date?: string;
    end_at_event_start?: boolean;
    order?: number;
  };
}

// Event Attendees Payload interface
export interface EventAttendeesPayload {
  event_id: string;
  attendees: EventAttendee[];
  stripe_payment_intent_id?: string;
}

// Event Feedback Item interface for questionnaire responses
export interface EventFeedbackItem {
  question_id: string;
  answer_option_id?: string;
  answer: string | number | string[];
}

// Event Feedback Payload interface
export interface EventFeedbackPayload {
  feedback: EventFeedbackItem[];
}
