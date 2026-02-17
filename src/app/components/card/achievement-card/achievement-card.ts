import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';
import { GamificationBadge } from '@/interfaces/IGamification';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'achievement-card',
  imports: [CommonModule, DatePipe, IonIcon],
  styleUrl: './achievement-card.scss',
  templateUrl: './achievement-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AchievementCard {
  badge = input.required<GamificationBadge>();
  onClick = output<GamificationBadge>();

  badgeImageUrl = computed(() => {
    const badge = this.badge();
    if (!badge) return '';
    return badge.url || '';
  });

  handleClick(): void {
    if (!this.badge().is_locked) {
      this.onClick.emit(this.badge());
    }
  }
}
