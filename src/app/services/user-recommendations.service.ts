import { Injectable, inject, signal, effect, untracked } from '@angular/core';
import { IUser } from '@/interfaces/IUser';
import { NetworkService } from './network.service';
import { ToasterService } from './toaster.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class UserRecommendationsService {
  private networkService = inject(NetworkService);
  private toasterService = inject(ToasterService);
  private authService = inject(AuthService);

  // Shared state for recommendations
  peopleCards = signal<IUser[]>([]);

  constructor() {
    effect(() => {
      const userId = this.authService.currentUser()?.id;
      this.peopleCards.set([]);
    });
  }

  async loadRecommendations(limit: number = 10): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    const shouldLoad = this.peopleCards().length === 0;
    if (!shouldLoad) return;

    try {
      const recommendations = await this.networkService.getNetworkRecommendations(limit);
      this.peopleCards.set(recommendations);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  }

  removeUser(userId: string): void {
    this.peopleCards.update((list) => list.filter((user) => user.id !== userId));
    if (this.peopleCards().length === 0) {
      this.loadRecommendations();
    }
  }
}
