interface IUserSettings {
  hide_email?: boolean;
  hide_mobile?: boolean;
  hide_location?: boolean;
}

interface IUserSocials {
  website?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  snapchat?: string;
}

export interface IUser {
  id: string;
  user_id?: string;
  dob?: string;
  name?: string;
  title?: string;
  email?: string;
  mobile?: string;
  address?: string;
  latitude?: number;
  username?: string;
  longitude?: number;
  is_admin?: boolean;
  description?: string;
  company_name?: string;
  firebase_uid?: string;
  account_type?: string;
  fcm_tokens?: string[];
  socials?: IUserSocials;
  thumbnail_url?: string;
  settings?: IUserSettings;
  image_url?: File | string;
  stripe_account_id?: string;
  stripe_account_status?: string;
  stripe_customer_id?: string;
  total_events_liked?: number;
  total_events_hosted?: number;
  total_events_spoken?: number;
  total_events_staffed?: number;
  total_events_cohosted?: number;
  total_events_sponsored?: number;
  total_events_attended?: number;
  total_attendees?: number;
  college_university_name?: string;
  total_gamification_points?: number;
  total_gamification_points_weekly?: number;
  vibe_ids?: string[];
  vibes?: VibeItem[];
  interest_ids?: string[];
  interests?: VibeItem[];
  hobby_ids?: string[];
  hobbies?: VibeItem[];
  total_networks?: number;
  connection_status?: string;
  has_subscribed?: boolean;
  subscription_plan_count?: number;
  distance?: number;
  notification_enabled?: boolean;
  profile_subscription?: ProfileSubscription;
}

export interface ProfileSubscription {
  posts?: boolean;
  events?: boolean;
}

export interface IUserResponse {
  message: string;
  success: boolean;
  data: { user: IUser };
}

export interface VibeItem {
  id: string;
  name: string;
  icon: string;
  description?: string;
}

export interface UserSearchPagination {
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface UserSearchResponse {
  users: IUser[];
  pagination: UserSearchPagination;
}

export interface UserSearchApiResponse {
  success: boolean;
  message: string;
  data: {
    data?: IUser[];
    pagination?: UserSearchPagination;
  };
}

export interface NetworkConnection {
  id: string;
  user_id: string;
  peer_id?: string;
  peer?: IUser;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  is_deleted?: boolean;
  [key: string]: any;
}

export interface NetworkConnectionsData {
  data?: IUser[];
  pagination?: UserSearchPagination;
}

export interface NetworkConnectionsApiResponse {
  success: boolean;
  message: string;
  data?: NetworkConnectionsData;
}
