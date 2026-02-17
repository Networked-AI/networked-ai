import { IUser } from '@/interfaces/IUser';
import { Component, inject } from '@angular/core';
import { SocketService } from '@/services/socket.service';
import { IonSkeletonText } from '@ionic/angular/standalone';
import { UserCardList } from '@/components/card/user-card-list';
import { UserRecommendationsService } from '@/services/user-recommendations.service';

@Component({
  imports: [UserCardList, IonSkeletonText],
  selector: 'profile-setup-user-suggestion',
  styleUrl: './profile-setup-user-suggestion.scss',
  templateUrl: './profile-setup-user-suggestion.html'
})
export class ProfileSetupUserSuggestion {
  
  // services
  private socketService = inject(SocketService);
  recommendationsService = inject(UserRecommendationsService);
  
  // signals
  peopleCards = this.recommendationsService.peopleCards;

  constructor() {
    this.recommendationsService.loadRecommendations(20);
  }

  ngOnInit(): void {
    this.setupNetworkConnectionListener();
  }

  private setupNetworkConnectionListener(): void {
    this.socketService.onAfterRegistration(() => {
      this.socketService.on('network:connection:update', this.networkConnectionHandler);
    });
  }

  private networkConnectionHandler = (payload: IUser) => {
    this.peopleCards.update((list) => list.map((u) => (u.id === payload.id ? { ...u, connection_status: payload.connection_status } : u)));
  };

  ngOnDestroy(): void {
    this.socketService.off('network:connection:update', this.networkConnectionHandler);
  }
}
