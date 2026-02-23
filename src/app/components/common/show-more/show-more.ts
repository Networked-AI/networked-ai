import { Component, input, computed, signal } from '@angular/core';

@Component({
  selector: 'show-more',
  styleUrl: './show-more.scss',
  templateUrl: './show-more.html'
})
export class ShowMoreComponent {
  content = input.required<string>();
  maxLength = input(0);
  contentClass = input('');

  expanded = signal(false);

  showToggle = computed(() => {
    const text = this.content();
    const len = this.maxLength();
    if (len > 0) return text.length > len;
    return false;
  });

  visibleText = computed(() => {
    const text = this.content();
    const len = this.maxLength();
    const isExpanded = this.expanded();
    if (len <= 0 || isExpanded || text.length <= len) return text;
    return text.slice(0, len).trimEnd() + '...';
  });

  toggle(): void {
    this.expanded.update((v) => !v);
  }
}
