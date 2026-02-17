import { Scrollbar } from 'swiper/modules';
import { Button } from '@/components/form/button';
import type { SwiperContainer } from 'swiper/element';
import { AuthService } from '@/services/auth.service';
import { IonicSlides } from '@ionic/angular/standalone';
import { BusinessCard } from '@/components/card/business-card';
import { CUSTOM_ELEMENTS_SCHEMA, ElementRef } from '@angular/core';
import { ProfileLink } from '@/pages/profile/components/profile-link';
import { AuthEmptyState } from '@/components/common/auth-empty-state';
import { EmptyState } from '@/components/common/empty-state';
import { NetworkingScoreCard } from '@/components/card/networking-score-card';
import { ProfileHeaderToolbar } from '@/components/common/profile-header-toolbar';
import { ProfileAchievement } from '@/pages/profile/components/profile-achievement';
import { ProfilePosts } from '@/pages/profile/components/profile-posts/profile-posts';
import { ProfileHostedEvents } from '@/pages/profile/components/profile-hosted-events';
import { ProfileUpcomingEvents } from '@/pages/profile/components/profile-upcoming-events';
import { ProfileAttendedEvents } from '@/pages/profile/components/profile-attended-events';
import {
  IonFab,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonContent,
  NavController,
  IonSkeletonText,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { inject, Component, OnDestroy, signal, computed, ChangeDetectionStrategy, effect, input, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { onImageError } from '@/utils/helper';
import { NavigationService } from '@/services/navigation.service';
import { UserService } from '@/services/user.service';
import { NetworkService } from '@/services/network.service';
import { ProfileImagePreviewOverlay } from '@/components/modal/profile-image-preview-overlay';
import { PopoverService } from '@/services/popover.service';
import { ModalService } from '@/services/modal.service';
import { ScrollHandlerDirective, showFooter } from '@/directives/scroll-handler.directive';
import { ConnectionStatus } from '@/enums/connection-status.enum';
import { ToasterService } from '@/services/toaster.service';
import { SocketService } from '@/services/socket.service';
import { StripeService } from '@/services/stripe.service';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { OgService } from '@/services/og.service';
import { IUser } from '@/interfaces/IUser';
import { Browser } from '@capacitor/browser';
import { BaseApiService } from '@/services/base-api.service';

type ProfileTabs = 'hosted-events' | 'attended-events' | 'upcoming-events' | 'user-posts' | 'user-achievement';

interface TabConfig {
  icon: string;
  value: ProfileTabs;
  iconActive: string;
}

@Component({
  selector: 'profile',
  styleUrl: './profile.scss',
  templateUrl: './profile.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonFab,
    Button,
    IonIcon,
    IonHeader,
    IonContent,
    IonToolbar,
    IonRefresher,
    IonRefresherContent,
    ProfileLink,
    BusinessCard,
    ProfilePosts,
    AuthEmptyState,
    EmptyState,
    ProfileAchievement,
    NetworkingScoreCard,
    ProfileHostedEvents,
    ProfileHeaderToolbar,
    ProfileAttendedEvents,
    ProfileUpcomingEvents,
    NgOptimizedImage,
    ProfileImagePreviewOverlay,
    ScrollHandlerDirective,
    IonSkeletonText
  ]
})
export class Profile implements OnDestroy {
  // Route username param
  username = input<string>();
  // services
  navigationService = inject(NavigationService);
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private networkService = inject(NetworkService);
  private popoverService = inject(PopoverService);
  private modalService = inject(ModalService);
  navCtrl = inject(NavController);
  private toasterService = inject(ToasterService);
  private socketService = inject(SocketService);
  private stripeService = inject(StripeService);
  private route = inject(ActivatedRoute);
  ogService = inject(OgService);

  // variables
  swiperModules = [IonicSlides, Scrollbar];
  private routeParamSubscription?: Subscription;

  profileHostedEvents = viewChild(ProfileHostedEvents);
  profileAttendedEvents = viewChild(ProfileAttendedEvents);
  profileUpcomingEvents = viewChild(ProfileUpcomingEvents);
  profileSwiperEl = viewChild<ElementRef<SwiperContainer>>('profileSwiper');
  profilePosts = viewChild(ProfilePosts);

  // computed & signals
  currentSlide = signal<ProfileTabs>('hosted-events');
  isLoggedIn = computed(() => !!this.authService.currentUser());
  currentUser = signal<any>(null);
  isLoading = signal(false);
  userName = signal<string>('');
  userNotFound = signal(false);
  isViewingOtherProfile = computed(() => {
    const loggedInUser = this.authService.currentUser();
    const viewedUser = this.currentUser();
    // if (!loggedInUser || !viewedUser) return false;
    return viewedUser?.id && viewedUser?.id !== loggedInUser?.id;
  });

  // Connection status computed properties
  connectionStatus = computed(() => {
    const user = this.currentUser();
    return user?.connection_status as ConnectionStatus | undefined;
  });

  isConnected = computed(() => this.connectionStatus() === ConnectionStatus.CONNECTED);
  isRequestSent = computed(() => this.connectionStatus() === ConnectionStatus.REQUEST_SENT);
  isRequestReceived = computed(() => this.connectionStatus() === ConnectionStatus.REQUEST_RECEIVED);
  isNotConnected = computed(() => !this.connectionStatus() || this.connectionStatus() === ConnectionStatus.NOT_CONNECTED);

  // Check if other user has a subscription plan available
  hasSubscriptionPlan = computed(() => {
    const user = this.currentUser();
    return !!(user?.subscription_plan_count && user.subscription_plan_count > 0);
  });

  // Check if current user has subscribed to this other user's plan
  isSubscribedToUser = computed(() => {
    const user = this.currentUser();
    return !!user?.has_subscribed;
  });

  // Show Subscribe button if user has a plan and current user hasn't subscribed yet
  shouldShowSubscribe = computed(() => {
    return this.hasSubscriptionPlan() && !this.isSubscribedToUser();
  });

  // Loading states for network operations
  isAddingToNetwork = signal<boolean>(false);
  isAcceptingRequest = signal<boolean>(false);
  isWithdrawingInvitation = signal<boolean>(false);
  showFab = showFooter;
  showFabButton(): boolean {
    return this.currentSlide() === 'user-posts' && this.showFab() && !this.isViewingOtherProfile();
  }
  // Get primary action button config based on connection status
  getPrimaryActionButton = computed(() => {
    if (this.isConnected()) {
      return {
        label: 'Message',
        iconName: 'pi-comment',
        action: 'message',
        isLoading: false,
        disabled: false
      };
    } else if (this.isRequestSent()) {
      return {
        label: 'Pending',
        iconName: 'pi-clock',
        action: 'pending',
        isLoading: this.isWithdrawingInvitation(),
        disabled: this.isWithdrawingInvitation()
      };
    } else if (this.isRequestReceived()) {
      return {
        label: 'Accept',
        iconName: 'pi-check',
        action: 'accept',
        isLoading: this.isAcceptingRequest(),
        disabled: this.isAcceptingRequest()
      };
    } else {
      return {
        label: 'Add',
        iconName: 'pi-user-plus',
        action: 'add',
        isLoading: this.isAddingToNetwork(),
        disabled: this.isAddingToNetwork()
      };
    }
  });
  showImagePreview = signal<boolean>(false);
  profileImage = computed(() => {
    const user = this.currentUser();
    return user?.thumbnail_url || '/assets/images/profile.jpeg';
  });

  eventsCount = computed(() => {
    const user = this.currentUser();
    return (user?.total_events_hosted || 0) + (user?.total_events_cohosted || 0) + (user?.total_events_sponsored || 0);
  });

  private readonly DESCRIPTION_MAX_LENGTH = 220;
  private readonly DEFAULT_DESCRIPTION = '';

  userDescription = computed(() => this.currentUser()?.description?.toString() ?? this.DEFAULT_DESCRIPTION);
  isDescriptionExpanded = signal(false);
  showDescriptionToggle = computed(() => this.userDescription().length > this.DESCRIPTION_MAX_LENGTH);
  visibleDescription = computed(() => {
    const desc = this.userDescription();
    if (!this.showDescriptionToggle() || this.isDescriptionExpanded()) {
      return desc;
    }
    return desc.slice(0, this.DESCRIPTION_MAX_LENGTH).trimEnd() + '...';
  });

  achievementDiamondPath = computed(() => {
    const points = this.currentUser()?.total_gamification_points || 0;

    if (points >= 50000) {
      return '/assets/svg/gamification/diamond-50k.svg';
    } else if (points >= 40000) {
      return '/assets/svg/gamification/diamond-40k.svg';
    } else if (points >= 30000) {
      return '/assets/svg/gamification/diamond-30k.svg';
    } else if (points >= 20000) {
      return '/assets/svg/gamification/diamond-20k.svg';
    } else if (points >= 10000) {
      return '/assets/svg/gamification/diamond-10k.svg';
    } else if (points >= 5000) {
      return '/assets/svg/gamification/diamond-5k.svg';
    } else {
      return '/assets/svg/gamification/diamond-1k.svg';
    }
  });

  toggleDescription(): void {
    this.isDescriptionExpanded.update((value) => !value);
  }

  shouldShowCreateCard = computed(() => {
    const user = this.currentUser();
    if (!user) return false;

    const socials = user.socials || {};
    const hasEmail = !!user.email?.trim();
    const hasMobile = !!user.mobile?.trim();

    // Check if all social links are missing
    const allSocialsMissing = !(
      socials.website?.trim() ||
      socials.facebook?.trim() ||
      socials.twitter?.trim() ||
      socials.instagram?.trim() ||
      socials.linkedin?.trim() ||
      socials.snapchat?.trim()
    );

    // Show card if: (no email AND no phone) OR (all socials missing)
    return (!hasEmail && !hasMobile) || allSocialsMissing;
  });

  constructor() {
    const routeParamSubscription = this.route.params.subscribe(() => {
      this.handleProfileLoad();
    });

    effect(() => {
      // const currentUserId = this.authService.currentUser()?.id;
      // if (currentUserId) this.handleProfileLoad();
      this.handleProfileLoad();
    });

    // ✅ SSR-safe OG tags
    effect(() => {
      const user = this.currentUser();
      const loading = this.isLoading();

      if (!loading && user) {
        this.ogService.setOgTagInProfile(user);
      }
    });

    this.setupNetworkConnectionListener();
  }

  private handleProfileLoad() {
    this.isLoading.set(true);
    this.userNotFound.set(false);

    const username = this.username();
    if (username) {
      this.userName.set(username);
      this.loadUserByUsername(username);
    } else {
      this.currentUser.set(this.authService.currentUser());
      this.isLoading.set(false);
    }
  }

  private setupNetworkConnectionListener(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    if (!payload || !payload.id) return;

    const currentUser = this.currentUser();
    if (currentUser && (currentUser.id === payload.id || currentUser.username === payload.username)) {
      this.currentUser.update((user) => ({ ...user, connection_status: payload.connection_status }));
    }
  };

  ngOnDestroy(): void {
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    const username = this.username();
    try {
      if (username) {
        await this.loadUserByUsername(username);
      } else {
        const currentUserId = this.authService.currentUser()?.id;
        if (currentUserId) {
          const user = await this.userService.getUser(currentUserId);
          this.currentUser.set(user);
        }
      }
      this.profileHostedEvents()?.loadHostedEvents(true);
      this.profileAttendedEvents()?.loadAttendedEvents(true);
      this.profileUpcomingEvents()?.loadUpcomingEvents(true);
      this.profilePosts()?.onRefresh(event);
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      (event.target as HTMLIonRefresherElement).complete();
    }
  }

  ionViewDidLeave() {
    this.routeParamSubscription?.unsubscribe();
  }

  private async loadUserByUsername(username: string): Promise<void> {
    try {
      this.userNotFound.set(false);
      const user = await this.userService.getUser(username);
      this.currentUser.set(user);
    } catch (error: any) {
      console.error('Error loading user:', error);
      this.userNotFound.set(true);
      this.currentUser.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  readonly tabs: ProfileTabs[] = ['hosted-events', 'attended-events', 'upcoming-events', 'user-posts', 'user-achievement'];

  readonly slides: TabConfig[] = [
    { value: 'hosted-events', icon: '/assets/svg/profile/hosted-events.svg', iconActive: '/assets/svg/profile/hosted-events-active.svg' },
    { value: 'attended-events', icon: '/assets/svg/profile/attended-events.svg', iconActive: '/assets/svg/profile/attended-events-active.svg' },
    { value: 'upcoming-events', icon: '/assets/svg/profile/upcoming-events.svg', iconActive: '/assets/svg/profile/upcoming-events-active.svg' },
    { value: 'user-posts', icon: '/assets/svg/profile/user-posts.svg', iconActive: '/assets/svg/profile/user-posts-active.svg' },
    { value: 'user-achievement', icon: '/assets/svg/profile/user-achievement.svg', iconActive: '/assets/svg/profile/user-achievement-active.svg' }
  ];

  changeTab(value: ProfileTabs): void {
    this.currentSlide.set(value);
    const slideIndex = this.tabs.indexOf(value);
    this.profileSwiperEl()?.nativeElement?.swiper?.slideTo(slideIndex, 100);
  }

  goToCreateEvent(): void {
    this.navigationService.navigateForward('/create-event');
  }

  navigateToNetworks(): void {
    const user = this.currentUser();
    if (this.isViewingOtherProfile() && user?.id) {
      this.navigationService.navigateForward(`/network?userId=${user.id}`, false, { user });
    } else {
      this.navigationService.navigateForward('/network');
    }
  }

  navigateToHostedEvents(): void {
    const user = this.currentUser();
    this.navigationService.navigateForward(`/event/all?eventFilter=hosted&userId=${user?.id}`, false, { user });
  }

  navigateToAttendedEvents(): void {
    const user = this.currentUser();
    this.navigationService.navigateForward(`/event/all?eventFilter=attended&userId=${user?.id}`, false, { user });
  }

  async navigateToSubscriptionPlans(): Promise<void> {
    const user = this.currentUser();
    if (!user?.email) {
      this.toasterService.showError('Please add your email to your profile to add subscription plans.');
      return;
    }
    if (user?.stripe_account_id && user?.stripe_account_status === 'active') {
      this.navigationService.navigateForward('/subscription/plans');
    } else {
      await this.userService.getCurrentUser(true);
      await this.openStripePayoutModal();
    }
  }

  async openStripePayoutModal(): Promise<void> {
    await this.modalService.openConfirmModal({
      icon: 'assets/svg/payoutIcon.svg',
      iconBgColor: '#C73838',
      title: 'Add Payout Details',
      description: 'To add subscription plans in app, you must setup your payout details with Stripe.',
      confirmButtonLabel: 'Connect Payment',
      cancelButtonLabel: 'Maybe Later',
      confirmButtonColor: 'primary',
      iconPosition: 'center',
      onConfirm: () => this.handleStripeAccountCreation()
    });
  }

  async handleStripeAccountCreation(): Promise<void> {
    try {
      const accountResponse: any = await this.stripeService.createStripeAccount();
      if (accountResponse?.url) {
        await Browser.open({ url: accountResponse.url });
      } else {
        this.toasterService.showError(accountResponse?.message || 'Failed to get Stripe account URL. Please try again.');
      }
    } catch (error) {
      console.error('Error creating Stripe account:', error);
      this.toasterService.showError('Error creating Stripe account. Please try again.');
    }
  }

  navigateToUserSubscriptionPlans(): void {
    const userId = this.currentUser()?.id;
    if (userId) {
      this.navigationService.navigateForward(`/subscription/user/${userId}`);
    }
  }

  onSlideChange(event: Event) {
    const swiper = (event.target as SwiperContainer).swiper;
    const newTab = this.tabs[swiper.activeIndex];
    if (newTab) this.currentSlide.set(newTab);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  onProfileImageClick(): void {
    this.showImagePreview.set(true);
  }

  onCloseImagePreview(): void {
    this.showImagePreview.set(false);
  }

  async openProfileOptionsPopover(event: Event): Promise<void> {
    const user = this.isViewingOtherProfile() ? this.currentUser() : undefined;
    await this.popoverService.openProfileOptionsPopover(event, this.isViewingOtherProfile(), user);
    this.popoverService.close();
  }

  openBusinessCard(): void {
    const user = this.currentUser();
    if (user) {
      this.navigationService.navigateForward('/profile/business-card', false, { user });
    }
  }

  async openShareProfileModal(): Promise<void> {
    const user = this.currentUser();
    if (user) {
      await this.modalService.openShareProfileModal(user);
    }
  }

  handlePrimaryAction(action: string | null): void {
    if (!action) return;

    const userId = this.currentUser()?.id;
    if (!userId) return;

    switch (action) {
      case 'message':
        this.messageUser();
        break;
      case 'add':
        this.addToNetwork();
        break;
      case 'accept':
        this.acceptNetworkRequest();
        break;
      case 'pending':
        this.showWithdrawInvitationAlert();
        break;
    }
  }

  messageUser(): void {
    const currentUserId = this.authService.currentUser()?.id;
    const otherUserId = this.currentUser()?.id;

    if (currentUserId && otherUserId) {
      this.navCtrl.navigateForward('/chat-room', {
        state: {
          user_ids: [currentUserId, otherUserId],
          is_personal: true
        }
      });
    }
  }

  async addToNetwork(): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    const user = this.currentUser();
    const userId = user?.id;
    if (!userId) return;
    try {
      this.isAddingToNetwork.set(true);
      await this.networkService.sendNetworkRequest(userId);
      this.currentUser.update((current) => ({ ...current, connection_status: ConnectionStatus.REQUEST_SENT }));
      this.toasterService.showSuccess('Network request sent successfully');
    } catch (error) {
      console.error('Error sending network request:', error);
      const message = BaseApiService.getErrorMessage(error, 'Failed to send network request');
      this.toasterService.showError(message);
    } finally {
      this.isAddingToNetwork.set(false);
    }
  }

  private async ensureLoggedIn(): Promise<boolean> {
    if (this.authService.getCurrentToken()) return true;
    const result = await this.modalService.openLoginModal();
    return result?.success ?? false;
  }

  async acceptNetworkRequest(): Promise<void> {
    const user = this.currentUser();
    const userId = user?.id;
    if (!userId) return;
    try {
      this.isAcceptingRequest.set(true);
      await this.networkService.acceptNetworkRequest(userId);
      this.currentUser.update((current) => ({ ...current, connection_status: ConnectionStatus.CONNECTED }));
      this.toasterService.showSuccess('Network request accepted');
    } catch (error) {
      console.error('Error accepting network request:', error);
      this.toasterService.showError('Failed to accept network request');
    } finally {
      this.isAcceptingRequest.set(false);
    }
  }

  subscribeToUser(): void {
    const userId = this.currentUser()?.id;
    if (userId) {
      console.log('Subscribe to user', userId);
    }
  }

  async showRemoveConnectionAlert(): Promise<void> {
    const user = this.currentUser();
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
          await this.networkService.removeNetworkConnection(user.id);
          this.currentUser.update((current) => ({ ...current, connection_status: ConnectionStatus.NOT_CONNECTED }));
          this.toasterService.showSuccess('Network connection removed');
        } catch (error) {
          console.error('Error removing network connection:', error);
          this.toasterService.showError('Failed to remove network connection');
          throw error;
        }
      }
    });
  }

  async showWithdrawInvitationAlert(): Promise<void> {
    const user = this.currentUser();
    const username = user?.username || user?.name || 'this user';

    const result = await this.modalService.openConfirmModal({
      icon: 'assets/svg/alert-white.svg',
      title: 'Withdraw Invitation?',
      description: `Are you sure you want to withdraw your network invitation to ${username}?`,
      confirmButtonLabel: 'Withdraw',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconBgColor: '#C73838',
      iconPosition: 'left',
      onConfirm: async () => {
        try {
          this.isWithdrawingInvitation.set(true);
          await this.networkService.cancelNetworkRequest(user.id);
          this.currentUser.update((current) => ({ ...current, connection_status: ConnectionStatus.NOT_CONNECTED }));
          this.toasterService.showSuccess('Network invitation withdrawn');
        } catch (error) {
          console.error('Error withdrawing network invitation:', error);
          this.toasterService.showError('Failed to withdraw network invitation');
          throw error;
        } finally {
          this.isWithdrawingInvitation.set(false);
        }
      }
    });
  }

  onCreatePost() {
    this.navigationService.navigateForward('/new-post');
  }
}
