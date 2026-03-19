import { Router } from '@angular/router';
import { AuthService } from '@/services/auth.service';
import { Component, computed, inject } from '@angular/core';
import { NavigationService } from '@/services/navigation.service';

@Component({
  selector: 'host-first-event-card',
  styleUrl: './host-first-event-card.scss',
  templateUrl: './host-first-event-card.html'
})
export class HostFirstEventCard {
  private router = inject(Router);
  private authService = inject(AuthService);
  private navigationService = inject(NavigationService);

  isLoggedIn = computed(() => !!this.authService.currentUser());

  onClick(): void {
    if (this.isLoggedIn()) {
      this.navigationService.navigateForward('/event');
    } else {
      this.navigationService.navigateForward(`/login?returnTo=${encodeURIComponent(this.router.url)}`);
    }
  }
}
