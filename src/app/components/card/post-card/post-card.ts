import { Pagination } from 'swiper/modules';
import { IonicSlides, NavController } from '@ionic/angular/standalone';
import { Button } from '@/components/form/button';
import { ModalService } from '@/services/modal.service';
import { ToasterService } from '@/services/toaster.service';
import { AuthService } from '@/services/auth.service';
import { FeedService } from '@/services/feed.service';
import { NavigationService } from '@/services/navigation.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MenuItem } from '@/components/modal/menu-modal/menu-modal';
import { DatePipe, NgOptimizedImage } from '@angular/common';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { ChangeDetectionStrategy, Component, inject, input, output, signal, computed, effect, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FeedPost } from '@/interfaces/IFeed';
import { Router } from '@angular/router';
import { NetworkService } from '@/services/network.service';
import { SocketService } from '@/services/socket.service';
import { IUser } from '@/interfaces/IUser';
import { HapticService } from '@/services/haptic.service';
import { VideoJsPlayerComponent } from '@/components/common/video-js-player';

@Component({
  selector: 'post-card',
  styleUrl: './post-card.scss',
  templateUrl: './post-card.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [Button, NgOptimizedImage, VideoJsPlayerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PostCard {
  postLiked = output<string>();
  postRemoved = output<string>();

  post = input.required<FeedPost>();
  postPreview = signal<FeedPost | null>(null);

  navCtrl = inject(NavController);
  sanitizer = inject(DomSanitizer);
  modalService = inject(ModalService);
  toasterService = inject(ToasterService);
  authService = inject(AuthService);
  feedService = inject(FeedService);
  navigationService = inject(NavigationService);
  router = inject(Router);
  private socketService = inject(SocketService);
  hapticService = inject(HapticService);

  private networkService = inject(NetworkService);

  private datePipe = new DatePipe('en-US');

  onMore = output<void>();

  // variables
  swiperModules = [IonicSlides, Pagination];

  currentSlide = signal(0);
  isLoading = signal(false);

  // Computed property to check if post belongs to current user
  isCurrentUserPost = computed(() => {
    const currentUser = this.authService.currentUser();
    const postUserId = this.post().user_id;
    return currentUser?.id === postUserId;
  });

  // Menu items for current user's posts (Edit/Delete only)
  currentUserMenuItems: MenuItem[] = [
    { label: 'Edit', icon: 'assets/svg/editIconBlack.svg', iconType: 'svg', action: 'edit' },
    { label: 'Delete', icon: 'assets/svg/deleteIcon.svg', iconType: 'svg', danger: true, action: 'delete' }
  ];

  getOtherUserMenuItems(): MenuItem[] {
    const items: MenuItem[] = [];

    items.push({
      label: 'Not Interested',
      icon: 'pi pi-eye-slash',
      iconType: 'pi',
      action: 'notInterested'
    });

    if (this.postPreview()?.user?.connection_status === 'NotConnected') {
      items.push({
        label: 'Add to network',
        icon: 'assets/svg/addUserIcon.svg',
        iconType: 'svg',
        action: 'addToNetwork'
      });
    }

    items.push({
      label: 'Block',
      icon: 'pi pi-ban',
      iconType: 'pi',
      action: 'block'
    });

    items.push({
      label: 'Report post',
      icon: 'assets/svg/social-feed/report.svg',
      iconType: 'svg',
      action: 'report'
    });

    console.log('connectionStatus', this.postPreview()?.user?.connection_status);

    if (this.postPreview()?.user?.connection_status === 'Connected') {
      items.push({
        label: 'Unfollow',
        icon: 'assets/svg/social-feed/user-minus.svg',
        iconType: 'svg',
        action: 'unfollow'
      });
    }

    return items;
  }

  // Computed properties for API data
  sortedMedias = computed(() => {
    const medias = this.post().medias;
    if (!medias || medias.length === 0) return [];
    return [...medias].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  createdAtTimestamp = computed(() => {
    const dateStr = this.post().created_at;
    return dateStr ? new Date(dateStr).getTime() : Date.now();
  });

  updatedAtTimestamp = computed(() => {
    const dateStr = this.post().updated_at;
    return dateStr ? new Date(dateStr).getTime() : undefined;
  });

  constructor() {
    effect(() => {
      this.postPreview.set(this.post());
    });
    this.setupNetworkConnectionListener();
  }

  formatEventDate(dateString: string): string {
    return this.datePipe.transform(dateString, 'EEE MMM d') || '';
  }

  private async ensureLoggedIn(): Promise<boolean> {
    if (this.authService.getCurrentToken()) return true;
    const result = await this.modalService.openLoginModal();
    return result?.success ?? false;
  }

  getTimeAgo = (timestamp: number, updatedTimestamp?: number) => {
    const now = new Date().getTime();

    // Decide which timestamp to use
    let displayTimestamp = timestamp;
    let isEdited = false;

    if (updatedTimestamp && updatedTimestamp > timestamp) {
      displayTimestamp = updatedTimestamp;
      isEdited = true;
    }

    const diffInMilliseconds = now - displayTimestamp;

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

    return isEdited ? `edited ${timeAgo} ago` : `${timeAgo}`;
  };

  async openMenu() {
    if (!(await this.ensureLoggedIn())) return;
    // Show different menu items based on whether it's the current user's post
    const menuItems = this.isCurrentUserPost() ? this.currentUserMenuItems : this.getOtherUserMenuItems();

    const result = await this.modalService.openMenuModal(menuItems);
    if (!result) return;

    const actions: Record<string, () => void> = {
      edit: () => this.editPost(),
      delete: () => this.deletePost(),
      report: () => this.reportPost(),
      block: () => this.blockUser(),
      unfollow: () => this.showRemoveConnectionAlert(),
      notInterested: () => this.notInterestedPost(),
      addToNetwork: () => this.addToNetwork()
    };

    actions[result.role]?.();
  }

  editPost() {
    this.navCtrl.navigateForward(`/new-post`, {
      state: { postId: this.post().id, post: this.post() }
    });
  }

  async addToNetwork() {
    // TODO: Implement add to network functionality
    this.isLoading.set(true);
    const id = this.post().user_id;
    if (!id) return;

    try {
      await this.networkService.sendNetworkRequest(id);
      this.toasterService.showSuccess('Network request sent successfully');
    } catch (error) {
      console.error('Error sending network request:', error);
      this.toasterService.showError('Failed to send network request');
    } finally {
      this.isLoading.set(false);
    }
  }

  async showRemoveConnectionAlert(): Promise<void> {
    const id = this.post().user_id;
    if (!id) return;
    const user = this.post().user;
    const username = user?.username || user?.name || 'this user';

    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/alert-white.svg',
      title: 'Remove Network?',
      description: `Are you sure you want to remove ${username} from your network list? The user won't be notified.`,
      confirmButtonLabel: 'Remove',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconBgColor: '#C73838',
      iconPosition: 'left',
      onConfirm: async () => {
        try {
          await this.networkService.removeNetworkConnection(id);
          this.toasterService.showSuccess('Network connection removed');
        } catch (error) {
          console.error('Error removing network connection:', error);
          this.toasterService.showError('Failed to remove network connection');
          throw error;
        }
      }
    });
  }

  async deletePost() {
    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/deleteWhiteIcon.svg',
      iconBgColor: '#C73838',
      title: 'Delete Confirmation',
      description: 'Are you sure you want to delete this post?',
      confirmButtonLabel: 'Delete',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left',
      onConfirm: async () => {
        const postId = this.post().id;
        const response = await this.feedService.deletePost(postId!);
        this.toasterService.showSuccess(response.message);

        const currentRoute = this.router.url;
        const isOnCommentsPage = currentRoute.includes('/post/');
        const isCurrentUserPost = this.isCurrentUserPost();
        if (isOnCommentsPage && isCurrentUserPost) {
          this.navigationService.back();
        }
        return response;
      }
    });

    if (result && result.role === 'error') {
      this.toasterService.showError('Failed to delete post. Please try again.');
    }
  }

  private removePostFromUI(): void {
    const currentRoute = this.router.url;
    const isOnCommentsPage = currentRoute.includes('/post/');

    // Navigate back if on comments page
    if (isOnCommentsPage) {
      this.navigationService.back();
    }

    // Emit post id to parent
    this.feedService.removePostFromFeed(this.post().id!);
  }

  async notInterestedPost() {
    const result = await this.modalService.openConfirmModal({
      iconName: 'pi pi-eye-slash',
      iconBgColor: '#6B7280',
      title: 'Not Interested',
      description: 'We will show you fewer posts like this.',
      confirmButtonLabel: 'Confirm',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'primary',
      iconPosition: 'left',
      onConfirm: async () => {
        const postId = this.post().id!;
        this.removePostFromUI();
      }
    });

    if (result?.role === 'error') {
      this.toasterService.showError('Something went wrong. Please try again.');
    }
  }

  async reportPost() {
    const result = await this.modalService.openReportModal('Post');
    if (!result || !result.reason_id) return;

    const postId = this.post().id;
    if (!postId) return;

    try {
      await this.feedService.reportFeed({
        feed_id: postId,
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
      this.removePostFromUI();
    } catch (error) {
      console.error('Error reporting post:', error);
      this.toasterService.showError('Failed to report post. Please try again.');
    }
  }

  async blockUser() {
    const currentPost = this.post();
    if (!currentPost?.user) return;

    const result = await this.modalService.openBlockModal(currentPost.user);
    if (!result) return;
    this.removePostFromUI();
  }

  async sharePost() {
    if (!(await this.ensureLoggedIn())) return;
    const postId = this.post().id;
    if (!postId) return;

    await this.modalService.openShareModal(postId, 'Post');
  }

  openFullscreen(index: number) {
    const media = this.sortedMedias()[index];
    if (media && media.media_type === 'Image' && media.media_url) {
      this.modalService.openImagePreviewModal(media.media_url);
    }
  }

  renderText(text: string): SafeHtml {
    if (!text) return '';

    // Use a negative lookbehind to avoid matching mentions already inside HTML tags
    const mentionRegex = /(?<!<[^>]*>)@([\w.]+)/g;
    let modifiedText = text.replace(mentionRegex, (match, username) => {
      // Check if this mention is already inside an anchor tag
      if (match.includes('<a')) return match;
      return `<a href="#" class="mention-link brand-03" data-username="${username}" style="font-weight:500; text-decoration:none; cursor:pointer;">${match}</a>`;
    });

    // Finally, handle URLs (avoid replacing URLs that are already in href attributes)
    const urlRegex = /(?<!href=")(https?:\/\/[^\s<]+)/gi;
    modifiedText = modifiedText.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8; text-decoration:underline;">${url}</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(modifiedText);
  }

  onMentionClick(event: Event): void {
    event.stopPropagation();
    this.hapticService.onClick();
    const target = event.target as HTMLElement;
    const mentionLink = target.closest('.mention-link') as HTMLElement;
    if (mentionLink) {
      event.preventDefault();
      const username = mentionLink.getAttribute('data-username');
      if (username) {
        this.navigationService.navigateForward(`/${username}`);
      }
    }
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  async toggleLike(): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    const postId = this.post().id;
    this.feedService.optimisticToggleLike(postId!);
    this.postLiked.emit(postId!);
    try {
      await this.feedService.toggleLike(postId!);
    } catch (error) {
      console.error('Error toggling like:', error);
      this.feedService.optimisticToggleLike(postId!);
    }
  }

  onComment(): void {
    const postId = this.post().id;
    this.navCtrl.navigateForward(['/post', postId!], { state: { post: this.post() } });
  }

  navigateToEvent(slug: string): void {
    this.navigationService.navigateForward(`/event/${slug}`);
  }

  handleEventCardClick(event: Event, slug: string): void {
    event.stopPropagation();
    this.hapticService.onClick();
    this.navigateToEvent(slug);
  }

  private setupNetworkConnectionListener(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    if (!payload?.id) return;

    const current = this.postPreview();
    if (!current?.user) return;

    // Update only if this post belongs to the same user
    if (current.user.id !== payload.id) return;

    this.postPreview.set({
      ...current,
      user: {
        ...current.user,
        connection_status: payload.connection_status
      }
    });
  };
}
