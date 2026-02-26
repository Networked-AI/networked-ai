import { IUser } from '@/interfaces/IUser';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { Injectable, inject, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class UserRecommendationsService {
  // services
  private authService = inject(AuthService);
  private networkService = inject(NetworkService);

  // Shared state for recommendations
  isLoading = signal(false);
  peopleCards = signal<IUser[]>([]);

  constructor() {
    effect(() => {
      const userId = this.authService.currentUser()?.id;
      this.peopleCards.set([]);
    });
  }

  async loadRecommendations(limit: number = 20): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    const shouldLoad = this.peopleCards().length === 0;
    if (!shouldLoad) return;

    this.isLoading.set(true);

    try {
      const recommendations = await this.networkService.getNetworkRecommendations(limit);
      this.peopleCards.set(recommendations);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  removeUser(userId: string): void {
    this.peopleCards.update((list) => list.filter((user) => user.id !== userId));
    if (this.peopleCards().length === 0) {
      this.loadRecommendations();
    }
  }
}
