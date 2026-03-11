import { Injectable, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from '@/services/base-api.service';
import {
  FeedPost,
  FeedsResponse,
  MyFeedResponse,
  FeedResponse,
  FeedLikeResponse,
  FeedComment,
  FeedCommentsResponse,
  CommentLikeResponse,
  CommentResponse,
  FeedShareResponse,
  ReportReasonsResponse,
  ReportResponse,
  ICsvBroadcastResponse
} from '@/interfaces/IFeed';
import { AuthService } from '@/services/auth.service';

@Injectable({ providedIn: 'root' })
export class FeedService extends BaseApiService {
  private authService = inject(AuthService);

  myPosts = signal<FeedPost[]>([]);
  publicFeeds = signal<FeedPost[]>([]);
  networkedFeeds = signal<FeedPost[]>([]);

  // Pagination state for public feeds
  publicFeedsPage = signal(1);
  publicFeedsTotal = signal(0);
  publicFeedsHasMore = signal(true);

  // Pagination state for networked feeds
  networkedFeedsPage = signal(1);
  networkedFeedsTotal = signal(0);
  networkedFeedsHasMore = signal(true);

  // Pagination state for my feeds
  myFeedsPage = signal(1);
  myFeedsTotal = signal(0);
  myFeedsHasMore = signal(true);

  async ensureMyFeedsLoaded(limit = 20): Promise<void> {
    if (this.myPosts().length > 0) return;
    await this.getMyFeeds({ page: 1, limit });
  }

  async resetMyFeeds() {
    this.myPosts.set([]);
    this.myFeedsPage.set(1);
    this.myFeedsHasMore.set(true);
  }

  removePostFromFeed(postId: string) {
    this.publicFeeds.update((list) => list.filter((p) => p.id !== postId));
    this.networkedFeeds.update((list) => list.filter((p) => p.id !== postId));
  }

  async getMyFeeds(
    params: {
      page?: number;
      limit?: number;
      append?: boolean; // If true, append to existing feeds instead of replacing
    } = {}
  ): Promise<{ posts: FeedPost[]; total: number; page: number; limit: number }> {
    try {
      let httpParams = new HttpParams();

      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }

      const response = await this.get<MyFeedResponse>('/feeds/me', { params: httpParams });
      const posts = response?.data?.data || [];
      const pagination = response?.data?.pagination;

      // Store feeds
      if (params.append) {
        // Append new posts to existing ones
        this.myPosts.update((current) => [...current, ...posts]);
      } else {
        // Replace existing posts
        this.myPosts.set(posts);
      }

      // Update pagination state
      const currentPage = pagination?.currentPage || params?.page || 1;
      this.myFeedsPage.set(currentPage);
      this.myFeedsTotal.set(pagination?.totalCount || 0);
      const totalPages = pagination?.totalPages || Math.ceil((pagination?.totalCount || 0) / (params?.limit || 20));
      const hasMore = posts.length > 0 && currentPage < totalPages;
      this.myFeedsHasMore.set(hasMore);

      return {
        posts,
        total: pagination?.totalCount || 0,
        page: pagination?.currentPage || params?.page || 1,
        limit: params?.limit || 20
      };
    } catch (error) {
      console.error('Error fetching feeds:', error);
      throw error;
    }
  }

  async getUserFeeds(
    userId: string,
    params: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ posts: FeedPost[]; total: number; page: number; limit: number; hasMore: boolean }> {
    try {
      let httpParams = new HttpParams();

      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }

      const response = await this.get<FeedsResponse>(`/feeds/user/${userId}`, { params: httpParams });
      const posts = response?.data?.data || [];
      const pagination = response?.data?.pagination;

      const currentPage = pagination?.currentPage || params?.page || 1;
      const totalPages = pagination?.totalPages || 0;
      const hasMore = posts.length > 0 && currentPage < totalPages;

      return {
        posts,
        total: pagination?.totalCount || 0,
        page: currentPage,
        limit: params?.limit || 20,
        hasMore
      };
    } catch (error) {
      console.error('Error fetching user feeds:', error);
      throw error;
    }
  }

  async getFeeds(params: {
    is_public: boolean;
    page?: number;
    limit?: number;
    append?: boolean; // If true, append to existing feeds instead of replacing
  }): Promise<{ posts: FeedPost[]; total: number; page: number; limit: number }> {
    try {
      let httpParams = new HttpParams().set('is_public', params.is_public.toString());

      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }

      const response = await this.get<FeedsResponse>('/feeds', { params: httpParams });
      const posts = response?.data?.data || [];
      const pagination = response?.data?.pagination;

      // Store feeds based on is_public
      if (params.is_public) {
        if (params.append) {
          // Append new posts to existing ones
          this.publicFeeds.update((current) => [...current, ...posts]);
        } else {
          // Replace existing posts
          this.publicFeeds.set(posts);
        }
        // Update pagination state
        const currentPage = pagination?.currentPage || params?.page || 1;
        this.publicFeedsPage.set(currentPage);
        this.publicFeedsTotal.set(pagination?.totalCount || 0);
        const totalPages = pagination?.totalPages || 0;
        const hasMore = posts.length > 0 && currentPage < totalPages;
        this.publicFeedsHasMore.set(hasMore);
      } else {
        if (params.append) {
          // Append new posts to existing ones
          this.networkedFeeds.update((current) => [...current, ...posts]);
        } else {
          // Replace existing posts
          this.networkedFeeds.set(posts);
        }
        // Update pagination state
        const currentPage = pagination?.currentPage || params?.page || 1;
        this.networkedFeedsPage.set(currentPage);
        this.networkedFeedsTotal.set(pagination?.totalCount || 0);
        const totalPages = pagination?.totalPages || 0;
        const hasMore = posts.length > 0 && currentPage < totalPages;
        this.networkedFeedsHasMore.set(hasMore);
      }

      // Also update the general posts signal for backward compatibility

      return {
        posts,
        total: pagination?.totalCount || 0,
        page: pagination?.currentPage || params?.page || 1,
        limit: params?.limit || 20
      };
    } catch (error) {
      console.error('Error fetching feeds:', error);
      throw error;
    }
  }

  async createPost(payload: Partial<FeedPost> & { content: string; is_public: boolean }): Promise<FeedResponse> {
    try {
      const response = await this.post<FeedResponse>('/feeds', payload);
      return response;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  async updatePost(id: string, payload: Partial<FeedPost> & { content: string; is_public: boolean }): Promise<FeedResponse> {
    try {
      const response = await this.put<FeedResponse>(`/feeds/${id}`, payload);
      return response;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  async deletePost(id: string): Promise<FeedResponse> {
    try {
      const response = await this.delete<FeedResponse>(`/feeds/${id}`);
      return response;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  async toggleLike(feedId: string): Promise<FeedLikeResponse> {
    try {
      const response = await this.post<FeedLikeResponse>(`/feed-likes/${feedId}`);
      return response;
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  optimisticToggleLike(feedId: string) {
    const toggle = (list: FeedPost[]) =>
      list.map((post) => {
        if (post.id !== feedId) return post;
        const isLiked = post.is_like;
        return {
          ...post,
          is_like: !isLiked,
          total_likes: isLiked ? Math.max((post.total_likes || 1) - 1, 0) : (post.total_likes || 0) + 1
        };
      });

    this.publicFeeds.update(toggle);
    this.networkedFeeds.update(toggle);
    this.myPosts.update(toggle);

    // Also update currently viewed post
    const current = this.currentViewedPost();
    if (current?.id === feedId) {
      const isLiked = current.is_like;
      this.currentViewedPost.set({
        ...current,
        is_like: !isLiked,
        total_likes: isLiked ? Math.max((current.total_likes || 1) - 1, 0) : (current.total_likes || 0) + 1
      });
    }
  }

  /**
   * Signal to store the currently viewed post (for post-comments page)
   */
  currentViewedPost = signal<FeedPost | null>(null);

  /**
   * Set the currently viewed post
   */
  setCurrentViewedPost(post: FeedPost | null): void {
    this.currentViewedPost.set(post);
  }

  /**
   * Update the currently viewed post from socket event
   */
  updateCurrentViewedPost(updatedPost: FeedPost): void {
    const current = this.currentViewedPost();
    if (current && current.id === updatedPost.id) {
      this.currentViewedPost.set(updatedPost);
    }
  }

  /**
   * Signal to store comments for the currently viewed post
   */
  private currentPostComments = signal<{ feedId: string; comments: FeedComment[] } | null>(null);

  /**
   * Get comments signal for a specific feed
   */
  getCommentsSignal(feedId: string): FeedComment[] {
    const current = this.currentPostComments();
    return current?.feedId === feedId ? current.comments : [];
  }

  /**
   * Set comments for a specific feed
   */
  setCommentsForFeed(feedId: string, comments: FeedComment[]): void {
    this.currentPostComments.set({ feedId, comments });
  }

  applyCommentCreated(feedId: string, comment: FeedComment): void {
    const current = this.currentPostComments();

    // Only update if we're viewing this feed's comments
    if (!current || current.feedId !== feedId) return;

    const isReply = !!comment.parent_comment_id;
    if (isReply) return;

    // Only handle parent comments - add to the start
    this.currentPostComments.update((state) => {
      if (!state || state.feedId !== feedId) return state;
      return { ...state, comments: [comment, ...state.comments] };
    });
  }

  applyCommentUpdated(feedId: string, updatedComment: FeedComment): void {
    const current = this.currentPostComments();

    // Only update if we're viewing this feed's comments
    if (!current || current.feedId !== feedId) return;

    this.currentPostComments.update((state) => {
      if (!state || state.feedId !== feedId) return state;

      const updateCommentInTree = (c: FeedComment): FeedComment => {
        if (c.id === updatedComment.id) {
          // Preserve UI-only properties, but use updated replies from server
          return {
            ...updatedComment,
            isRepliesOpen: c.isRepliesOpen // Keep UI state
          };
        }
        // Check replies recursively
        if (c.replies && c.replies.length > 0) {
          return {
            ...c,
            replies: c.replies.map((reply) => updateCommentInTree(reply))
          };
        }
        return c;
      };

      return {
        ...state,
        comments: state.comments.map(updateCommentInTree)
      };
    });
  }

  applyCommentDeleted(feedId: string, commentId: string): void {
    const current = this.currentPostComments();

    // Only update if we're viewing this feed's comments
    if (!current || current.feedId !== feedId) return;

    // Check if it's a parent comment or reply
    const isParentComment = current.comments.some((c) => c.id === commentId);
    const isReply = current.comments.some((c) => c.replies && c.replies.some((reply) => reply.id === commentId));

    if (isReply) return;

    // Only handle parent comment deletion
    if (isParentComment) {
      // feed:updated event will handle updating total_comments in feed arrays
      this.currentPostComments.update((state) => {
        if (!state || state.feedId !== feedId) return state;
        return {
          ...state,
          comments: state.comments.filter((c) => c.id !== commentId)
        };
      });
    }
  }

  async getPostById(postId: string): Promise<FeedPost | null> {
    try {
      const response = await this.get<FeedResponse>(`/feeds/${postId}`);
      if (response?.data) return response.data as FeedPost;
      return null;
    } catch (error) {
      console.error('Error fetching post:', error);
      throw error;
    }
  }

  async getFeedComments(
    feedId: string,
    params: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ comments: FeedComment[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      let httpParams = new HttpParams();

      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }

      const response = await this.get<FeedCommentsResponse>(`/feed-comments/feed/${feedId}`, { params: httpParams });
      const comments = response?.data?.data || [];
      const pagination = response?.data?.pagination;

      return {
        comments,
        total: pagination?.totalCount || 0,
        page: pagination?.currentPage || params?.page || 1,
        limit: params?.limit || 20,
        totalPages: pagination?.totalPages || 0
      };
    } catch (error) {
      console.error('Error fetching feed comments:', error);
      throw error;
    }
  }

  async toggleCommentLike(commentId: string): Promise<CommentLikeResponse> {
    try {
      const response = await this.post<CommentLikeResponse>(`/comment-likes/${commentId}`);
      return response;
    } catch (error) {
      console.error('Error toggling comment like:', error);
      throw error;
    }
  }

  optimisticToggleCommentLike(commentId: string): void {
    const current = this.currentPostComments();
    if (!current) return;

    const toggleInTree = (c: FeedComment): FeedComment => {
      if (c.id === commentId) {
        const isLiked = c.is_like;
        return {
          ...c,
          is_like: !isLiked,
          total_likes: isLiked ? Math.max((c.total_likes || 1) - 1, 0) : (c.total_likes || 0) + 1
        };
      }

      if (c.replies?.length) {
        return {
          ...c,
          replies: c.replies.map(toggleInTree)
        };
      }
      return c;
    };

    this.currentPostComments.update((state) => {
      if (!state) return state;

      return {
        ...state,
        comments: state.comments.map(toggleInTree)
      };
    });
  }

  async createComment(payload: {
    feed_id: string;
    comment: string;
    parent_comment_id?: string | null;
    mention_ids?: string[];
  }): Promise<CommentResponse> {
    try {
      const response = await this.post<CommentResponse>('/feed-comments/', payload);
      return response;
    } catch (error) {
      console.error('Error creating comment:', error);
      throw error;
    }
  }

  async deleteComment(commentId: string): Promise<CommentResponse> {
    try {
      const response = await this.delete<CommentResponse>(`/feed-comments/${commentId}`);
      return response;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  async shareFeed(payload: { feed_id: string; peer_ids?: string[]; send_entire_network?: boolean }): Promise<FeedShareResponse> {
    try {
      const response = await this.post<FeedShareResponse>('/feed-shares/', payload);
      return response;
    } catch (error) {
      console.error('Error sharing feed:', error);
      throw error;
    }
  }

  async networkBroadcast(feedId: string, type: 'email' | 'sms'): Promise<any> {
    try {
      const response = await this.post<any>('/feeds/network-broadcast', {
        feed_id: feedId,
        type: type
      });
      return response;
    } catch (error) {
      console.error('Error broadcasting feed:', error);
      throw error;
    }
  }

  async getReportReasons(): Promise<ReportReasonsResponse> {
    try {
      const response = await this.get<ReportReasonsResponse>('/report-reasons');
      return response;
    } catch (error) {
      console.error('Error fetching report reasons:', error);
      throw error;
    }
  }

  async reportFeed(payload: { feed_id: string; reason_id: string; reason?: string }): Promise<ReportResponse> {
    try {
      const response = await this.post<ReportResponse>('/feed-reports/', payload);
      return response;
    } catch (error) {
      console.error('Error reporting feed:', error);
      throw error;
    }
  }

  async reportComment(payload: { comment_id: string; reason_id: string; reason?: string }): Promise<ReportResponse> {
    try {
      const response = await this.post<ReportResponse>('/comment-reports/', payload);
      return response;
    } catch (error) {
      console.error('Error reporting comment:', error);
      throw error;
    }
  }

  // =============================================================================
  // SOCKET-DRIVEN FEED UPDATES
  // =============================================================================

  private upsertAtEndIfMissing(list: FeedPost[], incoming: FeedPost): FeedPost[] {
    const id = incoming.id;
    if (!id) return list;
    if (list.some((p) => p.id === id)) return list;
    return [...list, incoming];
  }

  private replaceByIdIfExists(list: FeedPost[], incoming: FeedPost): FeedPost[] {
    const id = incoming.id;
    if (!id) return list;
    let replaced = false;
    const next = list.map((p) => {
      if (p.id === id) {
        replaced = true;
        return incoming;
      }
      return p;
    });
    return replaced ? next : list;
  }

  private removeById(list: FeedPost[], feedId: string): FeedPost[] {
    if (!feedId) return list;
    return list.filter((p) => p.id !== feedId);
  }

  applyFeedCreated(feed: FeedPost): void {
    if (!feed?.id) return;

    // Always keep backward-compatible "posts" updated if it’s being used anywhere.

    // Append to the correct feed list based on is_public
    if (feed.is_public) {
      this.publicFeeds.update((curr) => this.upsertAtEndIfMissing(curr, feed));
    } else {
      this.networkedFeeds.update((curr) => this.upsertAtEndIfMissing(curr, feed));
    }

    // Append to myPosts ONLY if this feed belongs to current user
    const currentUserId = this.authService.currentUser()?.id;
    const feedOwnerId = feed.user_id || feed.user?.id || feed.created_by;
    if (currentUserId && feedOwnerId && currentUserId === feedOwnerId) {
      this.myPosts.update((curr) => this.upsertAtEndIfMissing(curr, feed));
    }
  }

  applyFeedUpdated(feed: FeedPost): void {
    if (!feed?.id) return;

    this.publicFeeds.update((curr) => this.replaceByIdIfExists(curr, feed));
    this.networkedFeeds.update((curr) => this.replaceByIdIfExists(curr, feed));
    this.myPosts.update((curr) => this.replaceByIdIfExists(curr, feed));

    // Also update the currently viewed post (for post-comments page)
    this.updateCurrentViewedPost(feed);
  }

  applyFeedDeleted(feedId: string): void {
    if (!feedId) return;

    this.publicFeeds.update((curr) => this.removeById(curr, feedId));
    this.networkedFeeds.update((curr) => this.removeById(curr, feedId));
    this.myPosts.update((curr) => this.removeById(curr, feedId));
  }

  async shareFeedCsvBroadcast(payload: {
    feed_id: string;
    type: 'sms' | 'email' | 'both';
    recipients: { email: string | null; phone: string | null }[];
  }): Promise<ICsvBroadcastResponse> {
    try {
      const response = await this.post<ICsvBroadcastResponse>('/feeds/share-csv-broadcast', payload);
      return response;
    } catch (error) {
      console.error('Error sharing feed CSV broadcast:', error);
      throw error;
    }
  }
}
