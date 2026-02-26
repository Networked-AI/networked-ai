import { MenuItem } from 'primeng/api';
import { MenuModule } from 'primeng/menu';
import { CommonModule } from '@angular/common';
import { Button } from '@/components/form/button';
import { PostCard } from '@/components/card/post-card';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { FeedService } from '@/services/feed.service';
import { EmptyState } from '@/components/common/empty-state';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Component, inject, signal, ChangeDetectionStrategy, OnInit, OnDestroy, ViewChild, ElementRef, computed, DOCUMENT } from '@angular/core';
import {
  IonToolbar,
  IonHeader,
  IonContent,
  NavController,
  IonFooter,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent
} from '@ionic/angular/standalone';
import { NgOptimizedImage } from '@angular/common';
import { CommentResponse, FeedComment } from '@/interfaces/IFeed';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '@/services/auth.service';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { NavigationService } from '@/services/navigation.service';
import { Mentions } from '@/components/common/mentions';
import { IUser } from '@/interfaces/IUser';
import { OverlayModule } from '@angular/cdk/overlay';
import { OgService } from '@/services/og.service';
import { Textarea } from 'primeng/textarea';
import { Capacitor } from '@capacitor/core';
import { HapticService } from '@/services/haptic.service';

@Component({
  selector: 'post-comments',
  styleUrl: './post-comments.scss',
  templateUrl: './post-comments.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    PostCard,
    EmptyState,
    IonFooter,
    IonHeader,
    MenuModule,
    IonContent,
    IonToolbar,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    CommonModule,
    ReactiveFormsModule,
    NgOptimizedImage,
    Mentions,
    OverlayModule,
    Textarea
  ]
})
export class PostComments implements OnInit, OnDestroy {
  @ViewChild('textareaEl') textareaRef!: ElementRef<HTMLTextAreaElement>;
  navCtrl = inject(NavController);
  sanitizer = inject(DomSanitizer);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);
  feedService = inject(FeedService);
  authService = inject(AuthService);
  navigationService = inject(NavigationService);
  router = inject(Router);
  route = inject(ActivatedRoute);
  ogService = inject(OgService);
  private document = inject(DOCUMENT);
  hapticService = inject(HapticService);
  currentUser = this.authService.currentUser;

  textCtrl: FormControl = new FormControl('');

  post = this.feedService.currentViewedPost;
  loading = signal<boolean>(false);
  isLoadingComments = signal<boolean>(false);
  isLoadingPost = signal<boolean>(false);
  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  totalComments = signal<number>(0);
  replyingTo = signal<{
    commentId: string;
    userName: string;
    userPhoto?: string;
  } | null>(null);

  hasMoreComments = computed(() => this.currentPage() < this.totalPages());

  // Track mentioned users: username -> user ID
  private mentionedUsers = new Map<string, string>();

  private async ensureLoggedIn(): Promise<boolean> {
    if (this.authService.getCurrentToken()) return true;
    const result = await this.modalService.openLoginModal();
    return result?.success ?? false;
  }

  onMentionSelected(user: IUser): void {
    if (user.username && user.id) {
      this.mentionedUsers.set(user.username.toLowerCase(), user.id);
    }
  }

  private extractMentionIds(commentText: string): string[] {
    const mentionRegex = /@([\w.]+)/g;
    const matches = commentText.matchAll(mentionRegex);
    const mentionIds: string[] = [];

    for (const match of matches) {
      const username = match[1].toLowerCase();
      const userId = this.mentionedUsers.get(username);
      if (userId && !mentionIds.includes(userId)) {
        mentionIds.push(userId);
      }
    }

    return mentionIds;
  }

  getMenuItems(comment: FeedComment): MenuItem[] {
    const currentUserId = this.currentUser()?.id;
    const isOwnComment = comment.user_id === currentUserId || comment.created_by === currentUserId;

    const items: MenuItem[] = [];

    if (isOwnComment) {
      // Show delete option for own comments
      items.push({
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => this.deleteComment(comment)
      });
    } else {
      // Options for other users' comments
      items.push(
        {
          label: 'View Profile',
          icon: 'pi pi-user',
          command: () => this.viewProfile(comment)
        },
        {
          label: 'Message',
          icon: 'pi pi-envelope',
          command: () => this.sendMessage(comment)
        },
        {
          separator: true
        },
        {
          label: 'Report',
          icon: 'pi pi-flag',
          command: () => this.reportComment(comment)
        },
        {
          label: 'Block account',
          icon: 'pi pi-ban',
          command: () => this.blockUser(comment)
        }
      );
    }

    return items;
  }

  // Use computed to get comments from FeedService
  comments = computed(() => {
    const postId = this.post()?.id;
    if (!postId) return [];
    return this.feedService.getCommentsSignal(postId);
  });

  async ngOnInit() {
    const postId = this.route.snapshot.paramMap.get('id');
    if (postId) {
      try {
        this.isLoadingPost.set(true);
        const postData = await this.feedService.getPostById(postId);
        if (postData) {
          // Set the post in FeedService for real-time socket updates
          this.feedService.setCurrentViewedPost(postData);
          this.ogService.setOgTagInPost(postData);
          this.loadComments(postId);
        }
      } catch (error) {
        console.error('Error loading post:', error);
      } finally {
        this.isLoadingPost.set(false);
      }
    }
  }

  ngOnDestroy(): void {
    // Clear the currently viewed post when leaving the page
    this.feedService.setCurrentViewedPost(null);
  }

  private async loadComments(feedId: string, page: number = 1, limit: number = 20): Promise<void> {
    try {
      this.isLoadingComments.set(true);
      const result = await this.feedService.getFeedComments(feedId, { page, limit });
      this.totalComments.set(result.total);

      // Add isRepliesOpen property to comments and their replies
      const addRepliesOpen = (comment: FeedComment): FeedComment => {
        return {
          ...comment,
          isRepliesOpen: false,
          replies: comment.replies?.map((reply) => ({ ...reply, isRepliesOpen: false }))
        };
      };

      const topLevelComments = result.comments.filter((comment) => !comment.parent_comment_id).map((comment) => addRepliesOpen(comment));

      // Get current comments from FeedService
      const currentComments = this.feedService.getCommentsSignal(feedId);

      if (page === 1) {
        this.feedService.setCommentsForFeed(feedId, topLevelComments);
      } else {
        this.feedService.setCommentsForFeed(feedId, [...currentComments, ...topLevelComments]);
      }
      this.currentPage.set(result.page);
      this.totalPages.set(result.totalPages);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      this.isLoadingComments.set(false);
    }
  }

  async loadMoreComments(event: Event): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;
    const postId = this.post()?.id;

    if (!postId || !this.hasMoreComments()) {
      infiniteScroll.complete();
      return;
    }

    try {
      const nextPage = this.currentPage() + 1;
      await this.loadComments(postId, nextPage);
      infiniteScroll.complete();
    } catch (error) {
      console.error('Error loading more comments:', error);
      infiniteScroll.complete();
    }
  }

  async deleteComment(comment: FeedComment): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    let deleteResponse: CommentResponse | null = null;

    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/deleteWhiteIcon.svg',
      iconBgColor: '#C73838',
      title: 'Delete Comment',
      description: 'Are you sure you want to delete this comment? This action cannot be undone.',
      confirmButtonLabel: 'Delete',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left',
      onConfirm: async () => {
        deleteResponse = await this.feedService.deleteComment(comment.id);
        return deleteResponse;
      }
    });

    if (result && result.role === 'confirm' && deleteResponse !== null) {
      const isReply = !!comment.parent_comment_id;
      const responseMessage = (deleteResponse as CommentResponse).message;

      if (!isReply) {
        this.totalComments.update((count) => Math.max(count - 1, 0));
      }

      // Show success message from API response
      this.toasterService.showSuccess(responseMessage || 'Comment deleted successfully');
    } else if (result && result.role === 'error') {
      this.toasterService.showError('Failed to delete comment. Please try again.');
    }
  }

  async viewProfile(comment: FeedComment): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    const username = comment.user?.username;
    this.document.body.click();
    setTimeout(() => this.navigationService.navigateForward(`/${username}`));
  }

  async sendMessage(comment: FeedComment): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    this.document.body.click();
    const currentUserId = this.currentUser()?.id;
    const otherUserId = comment.user?.id;
    if (currentUserId && otherUserId) {
      setTimeout(() => {
        this.navCtrl.navigateForward('/chat-room', {
          state: {
            user_ids: [currentUserId, otherUserId],
            is_personal: true
          }
        });
      });
    }
  }

  async reportComment(comment: FeedComment): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    const result = await this.modalService.openReportModal('Comment');
    if (!result || !result.reason_id) return;

    try {
      await this.feedService.reportComment({
        comment_id: comment.id,
        reason_id: result.reason_id,
        reason: result.reason
      });

      await this.modalService.openConfirmModal({
        icon: 'assets/svg/deleteWhiteIcon.svg',
        iconBgColor: '#F5BC61',
        title: 'Report Submitted',
        description: 'We use these reports to show you less of this kind of content in the future.',
        confirmButtonLabel: 'Done'
      });
    } catch (error) {
      console.error('Error reporting comment:', error);
      this.toasterService.showError('Failed to report comment. Please try again.');
    }
  }

  async blockUser(comment: FeedComment): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    if (!comment.user) return;

    const result = await this.modalService.openBlockModal(comment.user);
    if (!result) return;
  }

  toggleReplies(comment: FeedComment) {
    comment.isRepliesOpen = !comment.isRepliesOpen;
  }

  async onLikeComment(comment: FeedComment): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    const commentId = comment.id;

    this.feedService.optimisticToggleCommentLike(commentId);

    try {
      await this.feedService.toggleCommentLike(commentId);
    } catch (error) {
      this.feedService.optimisticToggleCommentLike(commentId);
      console.error('Error toggling comment like:', error);
      this.toasterService.showError('Failed to like comment. Please try again.');
    }
  }

  async sendComment(): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    if (!this.textCtrl.value?.trim()) return;

    const replyTo = this.replyingTo();
    const feedId = this.post()?.id;
    if (!feedId) return;

    // Get plain text comment (without HTML formatting)
    const commentText = this.textCtrl.value?.trim() || '';

    // Extract mention IDs from the comment text
    const mentionIds = this.extractMentionIds(commentText);

    this.loading.set(true);

    try {
      const payload: {
        feed_id: string;
        comment: string;
        parent_comment_id?: string | null;
        mention_ids?: string[];
      } = {
        feed_id: feedId,
        comment: commentText,
        ...(replyTo && { parent_comment_id: replyTo.commentId }),
        ...(mentionIds.length > 0 && { mention_ids: mentionIds })
      };

      await this.feedService.createComment(payload);

      if (!replyTo) {
        this.totalComments.update((count) => count + 1);
      }

      // Clear form
      this.textCtrl.setValue('');
      this.replyingTo.set(null);
      this.mentionedUsers.clear();
    } catch (error) {
      console.error('Error sending comment:', error);
      this.toasterService.showError('Failed to post comment. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  getTimeAgo = (dateString: string) => {
    const now = new Date().getTime();
    const timestamp = new Date(dateString).getTime();

    const diffInMilliseconds = now - timestamp;

    // If time difference is negative (future date) or very small, show "now"
    if (diffInMilliseconds < 1000) return 'now';

    const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInMonths / 12);

    let timeAgo = '';
    if (diffInYears > 0) timeAgo = `${diffInYears}y`;
    else if (diffInMonths > 0) timeAgo = `${diffInMonths}m`;
    else if (diffInDays > 0) timeAgo = `${diffInDays}d`;
    else if (diffInHours > 0) timeAgo = `${diffInHours}h`;
    else if (diffInMinutes > 0) timeAgo = `${diffInMinutes}m`;
    else timeAgo = `${diffInSeconds}s`;

    return timeAgo;
  };

  renderCommentText(text: string): SafeHtml {
    if (!text) return '';

    const mentionRegex = /@([\w.]+)/g;
    let modifiedText = text.replace(
      mentionRegex,
      (match, username) =>
        `<a href="#" class="mention-link brand-03" data-username="${username}" style="font-weight:500; text-decoration:none; cursor:pointer;">${match}</a>`
    );

    // handle URLs (avoid replacing URLs that are already in href attributes)
    const urlRegex = /(?<!href=")(https?:\/\/[^\s<]+)/gi;
    modifiedText = modifiedText.replace(
      urlRegex,
      (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8; text-decoration:underline;">${url}</a>`
    );

    return this.sanitizer.bypassSecurityTrustHtml(modifiedText);
  }

  async onMentionClick(event: Event): Promise<void> {
    const target = event.target as HTMLElement;
    const mentionLink = target.closest('.mention-link') as HTMLElement;
    if (mentionLink) {
      event.preventDefault();
      this.hapticService.onClick();
      if (!(await this.ensureLoggedIn())) return;
      const username = mentionLink.getAttribute('data-username');
      if (username) {
        this.navigationService.navigateForward(`/${username}`);
      }
    }
  }

  async onReplyClick(comment: FeedComment): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    this.replyingTo.set({
      commentId: comment.id,
      userName: comment.user?.name || 'User',
      userPhoto: comment.user?.thumbnail_url || comment.user?.image_url
    });
  }

  clearReply() {
    this.replyingTo.set(null);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    if (Capacitor.isNativePlatform()) return;
    if (event.shiftKey) return;
    event.preventDefault();
    this.hapticService.onClick();
    this.sendComment();
  }
}
