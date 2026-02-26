import { NavController, RefresherCustomEvent } from '@ionic/angular/standalone';
import { IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner } from '@ionic/angular/standalone';
import { inject, Component, ChangeDetectionStrategy, signal, computed, input, effect, untracked } from '@angular/core';
import { PostCard } from '@/components/card/post-card';
import { FeedService } from '@/services/feed.service';
import { ProfileEmptyState } from '@/components/common/profile-empty-state';
import { AuthService } from '@/services/auth.service';

@Component({
  selector: 'profile-posts',
  styleUrl: './profile-posts.scss',
  templateUrl: './profile-posts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PostCard, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner, ProfileEmptyState]
})
export class ProfilePosts {
  // services
  navCtrl = inject(NavController);
  feedService = inject(FeedService);
  authService = inject(AuthService);

  userId = input<string | null>(null);

  // signals
  posts = signal<any[]>([]);
  isLoading = signal(false);
  isLoadingMore = signal(false);
  hasMore = signal(true);
  currentPage = signal(1);
  totalPages = signal(0);

  isCurrentUser = computed(() => {
    const viewedUserId = this.userId();
    const loggedInUserId = this.authService.currentUser()?.id;
    return viewedUserId === loggedInUserId;
  });

  // Constants
  private readonly pageLimit = 20;

  constructor() {
    effect(() => {
      const userId = this.userId();
      if (!userId) return;

      const isCurrent = this.isCurrentUser();
      untracked(async () => {
        if (isCurrent) {
          await this.feedService.resetMyFeeds();
          this.attachCurrentUserFeeds();
        } else {
          this.resetLocalState();
          this.loadOtherUserFeeds(true);
        }
      });
    });
  }

  private async attachCurrentUserFeeds() {
    this.isLoading.set(true);
    await this.feedService.ensureMyFeedsLoaded(this.pageLimit);
    this.posts = this.feedService.myPosts;
    this.currentPage.set(this.feedService.myFeedsPage());
    this.hasMore.set(this.feedService.myFeedsHasMore());
    this.isLoading.set(false);
  }

  private resetLocalState() {
    this.posts.set([]);
    this.currentPage.set(1);
    this.hasMore.set(true);
  }

  private async loadOtherUserFeeds(reset = true) {
    if (this.isLoading()) return;

    try {
      if (reset) this.isLoading.set(true);

      const response = await this.feedService.getUserFeeds(this.userId()!, {
        page: reset ? 1 : this.currentPage() + 1,
        limit: this.pageLimit
      });

      if (reset) {
        this.posts.set(response.posts);
      } else {
        this.posts.update((p) => [...p, ...response.posts]);
      }

      this.currentPage.set(response.page);
      this.hasMore.set(response.hasMore);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMoreFeeds(event: Event) {
    const infiniteScroll = event.target as HTMLIonInfiniteScrollElement;

    try {
      if (this.isCurrentUser()) {
        await this.feedService.getMyFeeds({
          page: this.feedService.myFeedsPage() + 1,
          limit: this.pageLimit,
          append: true
        });

        this.attachCurrentUserFeeds();
      } else {
        await this.loadOtherUserFeeds(false);
      }
    } finally {
      infiniteScroll.complete();
    }
  }

  async onRefresh(event: RefresherCustomEvent) {
    try {
      if (this.isCurrentUser()) {
        await this.feedService.resetMyFeeds();
        this.attachCurrentUserFeeds();
      } else {
        this.resetLocalState();
        await this.loadOtherUserFeeds(true);
      }
    } finally {
      event.target.complete();
    }
  }

  onLocalToggleLike(postId: string) {
    this.posts.update((posts) =>
      posts.map((p) => {
        if (p.id !== postId) return p;
        const isLiked = p.is_like;
        return {
          ...p,
          is_like: !isLiked,
          total_likes: isLiked ? Math.max((p.total_likes || 1) - 1, 0) : (p.total_likes || 0) + 1
        };
      })
    );
  }
}
