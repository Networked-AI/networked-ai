import { IEvent } from './event';

export interface FeedMedia {
  id?: string;
  media_url?: string;
  media_type?: 'Image' | 'Video';
  order?: number;
}

export interface FeedPost {
  id?: string;
  event_ids?: string[] | null;
  mention_ids?: string[] | null;
  address?: string;
  latitude?: string;
  longitude?: string;
  user_id?: string;
  content?: string;
  medias?: FeedMedia[] | null;
  total_likes?: number;
  total_comments?: number;
  total_shares?: number;
  is_public?: boolean;
  is_like?: boolean; // Whether current user has liked this post
  created_by?: string;
  updated_by?: string | null;
  deleted_by?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: {
    id: string;
    name: string;
    username: string;
    email: string;
    image_url?: string;
    thumbnail_url?: string;
    connection_status?: string;
  };
  events?: IEvent[] | null | undefined; // Events array from API
  mentions?: FeedMention[] | null; // Mentioned users from API response
}

export interface FeedsResponse {
  success: boolean;
  message: string;
  data: {
    data: FeedPost[]; // Nested data structure
    pagination: {
      totalCount: number;
      currentPage: number;
      totalPages: number;
    };
  };
}

export interface MyFeedResponse {
  success: boolean;
  message: string;
  data: {
    data: FeedPost[]; // Nested data structure
    pagination: {
      totalCount: number;
      currentPage: number;
      totalPages: number;
    };
  };
}

export interface FeedResponse {
  success: boolean;
  message: string;
  data: boolean | FeedPost;
}

export interface FeedLike {
  id?: string;
  is_deleted?: boolean;
  feed_id?: string;
  user_id?: string;
  created_by?: string;
  updated_at?: string;
  created_at?: string;
}

export interface FeedLikeResponse {
  success: boolean;
  message: string;
  data: {
    content: boolean; // true if liked, false if unliked
    like?: FeedLike;
  };
}

export interface FeedCommentUser {
  id: string;
  name: string;
  username: string;
  email: string;
  image_url?: string;
  thumbnail_url?: string;
}

export interface FeedMention {
  id: string;
  name: string;
  username: string;
  email: string;
  image_url?: string;
  thumbnail_url?: string;
}

export interface FeedComment {
  id: string;
  feed_id: string;
  user_id: string;
  parent_comment_id: string | null;
  total_likes: number;
  total_replies: number;
  comment: string;
  created_by: string;
  updated_by: string | null;
  deleted_by: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  user?: FeedCommentUser;
  comment_mentions: any[];
  replies?: FeedComment[];
  is_like: boolean;
  isRepliesOpen?: boolean; // UI state for toggling replies visibility
}

export interface FeedCommentsResponse {
  success: boolean;
  message: string;
  data: {
    data: FeedComment[];
    pagination: {
      totalCount: number;
      currentPage: number;
      totalPages: number;
    };
  };
}

export interface CommentLike {
  id?: string;
  is_deleted?: boolean;
  comment_id?: string;
  user_id?: string;
  created_by?: string;
  updated_at?: string;
  created_at?: string;
}

export interface CommentLikeResponse {
  success: boolean;
  message: string;
  data: {
    content: boolean; // true if liked, false if unliked
    like?: CommentLike;
  };
}

export interface CommentResponse {
  success: boolean;
  message: string;
  data: {
    content?: FeedComment | boolean;
  };
}

export interface FeedShareResponse {
  success: boolean;
  message: string;
  data: {
    content?: any[];
    count?: number;
  };
}

export interface ReportReason {
  id: string;
  reason: string;
  order: number;
}

export interface ReportReasonsResponse {
  success: boolean;
  message: string;
  data: ReportReason[];
}

export interface Report {
  id: string;
  feed_id?: string;
  comment_id?: string;
  user_id: string;
  reason_id: string;
  reason?: string | null;
  created_by: string;
  updated_at: string;
  created_at: string;
  is_deleted: boolean;
}

export interface ReportResponse {
  success: boolean;
  message: string;
  data: {
    content: Report;
  };
}

export interface ICsvBroadcastResponse {
  success: boolean;
  message: string;
  data: ICsvBroadcastData;
}

export interface ICsvBroadcastData {
  sms_sent: boolean;
  email_sent: boolean;
  recipients_count: number;
}
