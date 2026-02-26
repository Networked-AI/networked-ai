import { IUser } from '@/interfaces/IUser';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Searchbar } from '@/components/common/searchbar';
import { SocketService } from '@/services/socket.service';
import { EmptyState } from '@/components/common/empty-state';
import { UserCardList } from '@/components/card/user-card-list';
import { NavigationService } from '@/services/navigation.service';
import { SubscriptionService } from '@/services/subscription.service';
import { IonContent, IonHeader, IonToolbar } from '@ionic/angular/standalone';
import { Component, inject, signal, ChangeDetectionStrategy, computed, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'plan-subscribers',
  styleUrl: './plan-subscribers.scss',
  templateUrl: './plan-subscribers.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonToolbar, IonHeader, IonContent, CommonModule, Searchbar, EmptyState, UserCardList]
})
export class PlanSubscribers implements OnInit, OnDestroy {
  navigationService = inject(NavigationService);
  route = inject(ActivatedRoute);
  private socketService = inject(SocketService);
  private subscriptionService = inject(SubscriptionService);

  planId = signal<string | null>(null);
  planName = signal<string>('');
  searchQuery = signal<string>('');
  users = signal<IUser[]>([]);
  isLoading = signal<boolean>(false);

  filteredUsers = computed(() => {
    const search = this.searchQuery().toLowerCase().trim();
    if (!search) return this.users();

    return this.users().filter((user) => user.name?.toLowerCase().includes(search) || user.username?.toLowerCase().includes(search));
  });

  ngOnInit(): void {
    const planId = this.route.snapshot.paramMap.get('planId');
    if (planId) {
      this.planId.set(planId);
      this.loadSubscribers(planId);
    }

    this.setupNetworkConnectionListener();
  }

  async loadSubscribers(planId: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const response = await this.subscriptionService.getPlanSubscribers(planId, 1, 20);
      const subscriptions = response?.data?.data || [];

      // Extract user data from subscription objects
      const users = subscriptions.filter((subscription: any) => subscription?.user).map((subscription: any) => subscription.user);

      this.users.set(users);

      // Get plan name if available
      if (response?.data?.plan_name) {
        this.planName.set(response.data.plan_name);
      }
    } catch (error) {
      console.error('Error loading subscribers:', error);
    } finally {
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

    const userId = payload.id;
    const newStatus = payload.connection_status;

    this.users.update((users) => users.map((user) => (user.id === userId ? { ...user, connection_status: newStatus } : user)));
  };

  ngOnDestroy(): void {
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }
}
