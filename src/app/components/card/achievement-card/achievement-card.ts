import { DatePipe } from '@angular/common';
import { GamificationBadge } from '@/interfaces/IGamification';
import { ChangeDetectionStrategy, Component, input, output, computed } from '@angular/core';

@Component({
  imports: [DatePipe],
  selector: 'achievement-card',
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
    this.onClick.emit(this.badge());
  }
}
