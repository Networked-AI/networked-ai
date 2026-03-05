import { NotificationType } from '@/enums/enums';
import { Button } from '@/components/form/button';
import { NgOptimizedImage } from '@angular/common';
import { TimeAgoPipe } from '@/pipes/time-ago.pipe';
import { EventService } from '@/services/event.service';
import { INotification } from '@/interfaces/INotification';
import { ToasterService } from '@/services/toaster.service';
import { NetworkService } from '@/services/network.service';
import { EmptyState } from '@/components/common/empty-state';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { NotificationsService } from '@/services/notifications.service';
import { AuthService } from '@/services/auth.service';
import { NavigationService } from '@/services/navigation.service';
import { ModalService } from '@/services/modal.service';
import { IonContent, IonHeader, IonIcon, IonToolbar, NavController } from '@ionic/angular/standalone';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { IonRefresher, IonInfiniteScroll, IonRefresherContent, RefresherCustomEvent, IonInfiniteScrollContent } from '@ionic/angular/standalone';
import { BaseApiService } from '@/services/base-api.service';
import { HapticService } from '@/services/haptic.service';
@Component({
  selector: 'notification',
  styleUrl: './notification.scss',
  templateUrl: './notification.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    IonIcon,
    IonHeader,
    IonContent,
    IonToolbar,
    EmptyState,
    TimeAgoPipe,
    IonRefresher,
    NgOptimizedImage,
    IonInfiniteScroll,
    IonRefresherContent,
    IonInfiniteScrollContent
  ]
})
export class Notification {
  // services
  private navCtrl = inject(NavController);
  private eventService = inject(EventService);
  private networkService = inject(NetworkService);
  private toasterService = inject(ToasterService);
  private notificationsService = inject(NotificationsService);
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);
  private modalService = inject(ModalService);
  hapticService = inject(HapticService);

  // signals
  isLoadingMore = signal(false);
  refreshTick = signal(0);
  notifications = this.notificationsService.notifications;
  notificationFilter = signal<NotificationType>(NotificationType.ALL);
  // computed
  isLoading = computed(() => this.notificationsService.isLoading());
  pagination = computed(() => this.notificationsService.pagination());
  unreadCount = computed(() => this.notificationsService.unreadCount());
  hasMore = computed(() => this.pagination().currentPage < this.pagination().totalPages);

  // constants
  readonly tabs: Array<{ value: NotificationType; label: string }> = [
    { value: NotificationType.ALL, label: 'All' },
    { value: NotificationType.UNREAD, label: 'Unread' },
    { value: NotificationType.MY_EVENTS, label: 'My Events' },
    { value: NotificationType.RSVP_REQUEST, label: 'RSVP Requests' },
    { value: NotificationType.INVITATION, label: 'Invitations' },
    { value: NotificationType.EVENTS, label: 'Events' },
    { value: NotificationType.NETWORK, label: 'Network' }
  ];

  constructor() {
    effect(() => {
      const limit = untracked(() => this.pagination().limit);
      this.notificationsService.resetAndLoad(this.notificationFilter(), limit);
    });

    // fetch unread count on component initialization
    this.notificationsService.fetchUnreadCount();
  }

  async loadMore(): Promise<void> {
    const pagination = this.pagination();
    if (this.isLoading()) return;
    if (pagination.currentPage >= pagination.totalPages) return;

    await this.notificationsService.loadNotifications({
      page: pagination.currentPage + 1,
      limit: pagination.limit,
      type: this.notificationFilter(),
      append: true
    });
  }

  loadMoreNotifications = async (event: Event): Promise<void> => {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);
      await this.loadMore();
    } catch (error) {
      console.error('Error loading more notifications:', error);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  };

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.notificationsService.resetAndLoad(this.notificationFilter(), this.pagination().limit);
      this.refreshTick.update((t) => t + 1);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    } finally {
      event.target.complete();
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await this.notificationsService.markAllNotificationsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  async acceptNetwork(userId: string): Promise<void> {
    try {
      await this.networkService.acceptNetworkRequest(userId);
    } catch (error) {
      console.error('Error accepting network request:', error);
      this.toasterService.showError('Failed to accept network request');
    }
  }

  async rejectNetwork(userId: string): Promise<void> {
    try {
      await this.networkService.rejectNetworkRequest(userId);
    } catch (error) {
      console.error('Error rejecting network request:', error);
      this.toasterService.showError('Failed to reject network request');
    }
  }

  async acceptRsvpRequest(notification: INotification): Promise<void> {
    try {
      const eventId = notification.event?.id;
      const requestId = notification.event?.rsvp_requests?.[0]?.id;
      if (!eventId || !requestId) return;

      await this.eventService.approveOrRejectRsvpRequest(eventId, requestId, 'Approved');
    } catch (error) {
      console.error('Error approving RSVP request:', error);
      this.toasterService.showError('Failed to approve RSVP request');
    }
  }

  async rejectRsvpRequest(notification: INotification): Promise<void> {
    try {
      const eventId = notification.event?.id;
      const requestId = notification.event?.rsvp_requests?.[0]?.id;
      if (!eventId || !requestId) return;

      await this.eventService.approveOrRejectRsvpRequest(eventId, requestId, 'Rejected');
    } catch (error) {
      console.error('Error approving RSVP request:', error);
      this.toasterService.showError('Failed to reject RSVP request');
    }
  }

  async handleNotificationClick(notification: INotification): Promise<void> {
    this.notificationsService.markNotificationRead(notification.id);

    if (notification.type === NotificationType.CHAT_MESSAGE || notification.type === NotificationType.CHAT_ROOM_CREATED) {
      this.navigationService.navigateForward('/chat-room', false, {
        chatRoom: notification.chat_room,
        user_ids: notification.chat_room?.user_ids,
        event_id: notification.chat_room?.event_id
      });
    } else if (notification.type === NotificationType.NETWORK) {
      this.navCtrl.navigateForward(`/${notification.related_user?.username}`);
    } else if (notification.type === NotificationType.MY_EVENTS || notification.type === NotificationType.EVENTS) {
      this.navCtrl.navigateForward(`/event/${notification.event?.slug}`);
    } else if (notification.type === NotificationType.RSVP_REQUEST) {
      this.navigationService.navigateForward(`/event/rsvp-approval/${notification.event?.id}`);
    } else if (notification.type === NotificationType.RSVP_REQUEST_STATUS) {
      this.navCtrl.navigateForward(`/event/${notification.event?.slug}`);
    } else if (
      notification.type === NotificationType.POST_COMMENTED ||
      notification.type === NotificationType.POST_LIKED ||
      notification.type === NotificationType.MENTION ||
      notification.type === NotificationType.POSTS
    ) {
      const postId = notification.post_id ?? (notification.post as { id?: string })?.id;
      if (postId) {
        this.navigationService.navigateForward(`/post/${postId}`);
      }
    } else if (notification.type === NotificationType.POST_EVENT_QUESTIONNAIRE) {
      if (notification.event?.slug) {
        this.navCtrl.navigateForward(`/event/${notification.event.slug}`);
      }
    }
  }

  async openShareFeedback(notification: INotification): Promise<void> {
    this.notificationsService.markNotificationRead(notification.id);
    const eventId = notification.event?.id ?? notification.event_id;
    if (!eventId) return;

    try {
      const event = await this.eventService.getEventById(eventId);
      if (!event) {
        this.toasterService.showError('Event not found.');
        return;
      }

      const rawQuestionnaire = event.questionnaire || event.questions || [];
      const postEventQuestions = rawQuestionnaire.filter((q: { event_phase?: string }) => q.event_phase === 'PostEvent');

      if (!postEventQuestions.length) {
        this.toasterService.showError('No feedback questionnaire available for this event.');
        return;
      }

      const result = await this.modalService.openQuestionnairePreviewModal(postEventQuestions, false);

      if (result?.responses?.length) {
        const saved: any = await this.savePostEventFeedback(eventId, result.responses);
        if (saved) {
          this.toasterService.showSuccess(saved?.message || 'Thank you for sharing your feedback!');
          this.notificationsService.fetchUnreadCount();
        }
      }
    } catch (error) {
      console.error('Error opening share feedback:', error);
      BaseApiService.getErrorMessage(error, "Failed to load feedback form. Please try again.");
    }
  }

  private buildFeedbackPayloadFromResponses(
    responses: any[]
  ): { question_id: string; answer_option_id?: string; answer: string | number | string[] }[] {
    const feedback: { question_id: string; answer_option_id?: string; answer: string | number | string[] }[] = [];

    responses.forEach((response: any) => {
      if (!response.question_id) return;

      const questionType = response.type || '';

      if (questionType === 'SingleChoice') {
        let answerValue = '';
        let optionId: string | undefined;

        if (typeof response.answer === 'object' && response.answer !== null) {
          answerValue = response.answer.option || '';
          optionId = response.answer.id;
        } else {
          answerValue = response.answer || '';
          const selectedOption = response.options?.find((opt: any) => {
            const optionText = typeof opt === 'object' ? opt.option : opt;
            return optionText === answerValue;
          });
          optionId = selectedOption?.id;
        }

        feedback.push({ question_id: response.question_id, answer_option_id: optionId, answer: answerValue });
      } else if (questionType === 'MultipleChoice') {
        const selectedOptions = Array.isArray(response.answer) ? response.answer : [response.answer];
        selectedOptions.forEach((selectedAnswer: any) => {
          let answerValue = '';
          let optionId: string | undefined;

          if (typeof selectedAnswer === 'object' && selectedAnswer !== null) {
            answerValue = selectedAnswer.option || '';
            optionId = selectedAnswer.id;
          } else {
            answerValue = selectedAnswer || '';
            const selectedOption = response.options?.find((opt: any) => {
              const optionText = typeof opt === 'object' ? opt.option : opt;
              return optionText === answerValue;
            });
            optionId = selectedOption?.id;
          }

          feedback.push({ question_id: response.question_id, answer_option_id: optionId, answer: answerValue });
        });
      } else {
        const answer = response.answer ?? '';
        feedback.push({ question_id: response.question_id, answer: String(answer) });
      }
    });

    return feedback;
  }

  private async savePostEventFeedback(eventId: string, responses: any[]): Promise<boolean> {
    try {
      const feedback = this.buildFeedbackPayloadFromResponses(responses);
      if (feedback.length === 0) return true;

      return this.eventService.saveEventFeedback(eventId, { feedback });
    } catch (error) {
      console.error('Error saving post-event feedback:', error);
      this.toasterService.showError('Failed to save feedback. Please try again.');
      return false;
    }
  }

  private readonly defaultEmptyState = {
    title: 'No Notifications Yet',
    description: 'Your events, RSVPs, and connections are quiet for now.'
  };

  getEmptyStateMessage(): { title: string; description: string } {
    const filter = this.notificationFilter();
    const messages: Partial<Record<NotificationType, { title: string; description: string }>> = {
      [NotificationType.ALL]: this.defaultEmptyState,
      [NotificationType.UNREAD]: {
        title: 'No Unread Notifications',
        description: "You're all caught up! No new notifications to read."
      },
      [NotificationType.MY_EVENTS]: {
        title: 'No My Events Notifications',
        description: "You don't have any notifications related to your events."
      },
      [NotificationType.RSVP_REQUEST]: {
        title: 'No RSVP Requests',
        description: "You don't have any pending RSVP requests at the moment."
      },
      [NotificationType.INVITATION]: {
        title: 'No Invitations',
        description: "You don't have any pending invitations right now."
      },
      [NotificationType.EVENTS]: {
        title: 'No Event Notifications',
        description: "You don't have any event-related notifications."
      },
      [NotificationType.NETWORK]: {
        title: 'No Network Notifications',
        description: "You don't have any network activity notifications."
      }
    };
    return messages[filter] ?? this.defaultEmptyState;
  }

  goBack(): void {
    this.navCtrl.back();
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl, '');
  }

  /** Image URL for ChatMessage notifications: event/group image or related_user avatar. */
  getChatMessageNotificationImage(notification: INotification): string {
    const room = notification.chat_room;
    if (room) {
      if (!room.is_personal) {
        return room.event_id ? room.event?.thumbnail_url || '' : room.profile_image || '';
      } else {
        return notification.related_user?.thumbnail_url || '';
      }
    }
    return '';
  }
}
