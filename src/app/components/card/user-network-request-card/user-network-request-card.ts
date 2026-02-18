import { Button } from '@/components/form/button';
import { NgOptimizedImage } from '@angular/common';
import { input, output, Component, ChangeDetectionStrategy, computed, inject } from '@angular/core';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { NavigationService } from '@/services/navigation.service';
import { HapticService } from '@/services/haptic.service';

@Component({
  imports: [Button, NgOptimizedImage],
  selector: 'user-network-request-card',
  styleUrl: './user-network-request-card.scss',
  templateUrl: './user-network-request-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserNetworkRequestCard {
  // inputs
  user = input.required<any>();

  // outputs
  accept = output<string>();
  reject = output<string>();

  // services
  private navigationService = inject(NavigationService);
  hapticService = inject(HapticService);
  // computed
  userImage = computed(() => {
    const user = this.user();
    return getImageUrlOrDefault(user?.thumbnail_url || '');
  });

  diamondPath = computed(() => {
    const points = this.user()?.total_gamification_points || 0;

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

  onCardClick(): void {
    const username = this.user()?.username;
    if (username) {
      this.navigationService.navigateForward(`/${username}`);
    }
  }

  onAccept(): void {
    this.accept.emit(this.user().id);
  }

  onReject(event: Event): void {
    event?.stopPropagation();
    this.hapticService.onClick();
    this.reject.emit(this.user().id);
  }

  onImageError(event: Event): void {
    onImageError(event);
  }
}
