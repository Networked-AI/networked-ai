import { Button } from '@/components/form/button';
import { AuthService } from '@/services/auth.service';
import { EventService } from '@/services/event.service';
import { SocketService } from '@/services/socket.service';
import { UserCardList } from '@/components/card/user-card-list';
import { NavigationService } from '@/services/navigation.service';
import { Component, effect, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { IonContent, IonToolbar, IonHeader, IonInfiniteScrollContent, IonInfiniteScroll } from '@ionic/angular/standalone';
import { IUser } from '@/interfaces/IUser';
import { Router } from '@angular/router';
import { AnalyticsQuestion, AnalyticsQuestionOption } from '@/interfaces/event';

@Component({
  selector: 'questionnaire-user-list',
  styleUrl: './questionnaire-user-list.scss',
  templateUrl: './questionnaire-user-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonInfiniteScroll, IonInfiniteScrollContent, IonHeader, IonToolbar, IonContent, UserCardList]
})
export class QuestionnaireUserList {
  navigationService = inject(NavigationService);
  eventService = inject(EventService);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private router = inject(Router);

  question = signal<any>(null);
  option = signal<any>(null);
  users = signal<any[]>([]);
  currentPage = signal<number>(1);
  isLoading = signal<boolean>(false);
  totalPages = signal<number>(0);
  hasMore = computed(() => this.currentPage() < this.totalPages());

  ngOnInit() {
    const navigation = this.router.currentNavigation();
    const state = navigation?.extras?.state as { questionOption: AnalyticsQuestion; option: AnalyticsQuestionOption };

    if (state.questionOption || state.option) {
      this.question.set(state.questionOption);
      this.option.set(state.option);

      this.loadUsers(1, false);
    }
    this.setupNetworkConnectionListener();
  }

  loadUsers = async (page: number, append = false) => {
    if (this.isLoading()) return;

    try {
      this.isLoading.set(true);

      const limit = page > 1 ? 10 : 20;

      const response = await this.eventService.getEventQuestionOptionUsers(this.question()?.id, this.option()?.id, page, limit);

      this.totalPages.set(response?.pagination?.totalPages || 0);
      this.currentPage.set(page);

      this.users.update((current) => (append ? [...current, ...(response?.users || [])] : response?.users || []));
    } catch (error) {
      console.error('Error loading option users:', error);
    } finally {
      this.isLoading.set(false);
    }
  };

  loadMoreUsers = async (event: Event): Promise<void> => {
    const infiniteScroll = event.target as HTMLIonInfiniteScrollElement;

    if (!this.hasMore() || this.isLoading()) {
      infiniteScroll.complete();
      return;
    }

    await this.loadUsers(this.currentPage() + 1, true);
    infiniteScroll.complete();
  };

  addSuggestion(id: string) {
    const user = this.users().find((item) => item.id === id);
    if (!user) return;

    user.requested = true;
    user.networked = false;
  }

  messageUser(id: string) {
    const currentUserId = this.authService.currentUser()?.id;

    if (currentUserId && id) {
      this.navigationService.navigateForward('/chat-room', false, {
        user_ids: [currentUserId, id],
        is_personal: true
      });
    }
  }

  private setupNetworkConnectionListener(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    if (!payload || !payload.id) return;

    const userId = payload.id;
    const newStatus = payload.connection_status;

    this.users.update((users) => users.map((user) => (user.id === userId ? { ...user, connection_status: newStatus } : user)));
  };

  ngOnDestroy(): void {
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }
}
