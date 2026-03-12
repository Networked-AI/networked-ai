import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { Button } from '@/components/form/button';
import { NavController } from '@ionic/angular/standalone';

export type AuthEmptyStateType = 'network' | 'messages' | 'profile';

@Component({
  selector: 'auth-empty-state',
  styleUrl: './auth-empty-state.scss',
  templateUrl: './auth-empty-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button]
})
export class AuthEmptyState {
  type = input.required<AuthEmptyStateType>();

  private navCtrl = inject(NavController);

  get imagePath(): string {
    switch (this.type()) {
      case 'network':
        return '/assets/images/no-network.png';
      case 'messages':
        return '/assets/images/no-messages.png';
      case 'profile':
        return '/assets/images/no-profile.png';
      default:
        return '/assets/images/no-network.png';
    }
  }

  get title(): string {
    switch (this.type()) {
      case 'network':
        return 'Grow Your Network';
      case 'messages':
        return 'Message on Get Networked';
      case 'profile':
        return 'Get Started';
      default:
        return 'Get Started';
    }
  }

  get description(): string {
    switch (this.type()) {
      case 'network':
        return 'Add new friends & expand your network with Get Networked.';
      case 'messages':
        return 'Chat with your network and receive messages on event updates.';
      case 'profile':
        return 'Create an account to start hosting events and expand your network with Get Networked.';
      default:
        return 'Create an account to start hosting events and expand your network with Get Networked.';
    }
  }

  onSignInClick(): void {
    this.navCtrl.navigateForward('/login');
  }
}
