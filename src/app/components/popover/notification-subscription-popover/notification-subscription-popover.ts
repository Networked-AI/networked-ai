import { Component, Input, signal, computed } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';

export interface NotificationPreferences {
  posts: boolean;
  events: boolean;
}

@Component({
  selector: 'app-notification-subscription-popover',
  imports: [IonIcon, ToggleSwitch, FormsModule],
  templateUrl: './notification-subscription-popover.html',
  styleUrl: './notification-subscription-popover.scss'
})
export class NotificationSubscriptionPopover {
  @Input() username: string = '';
  @Input() initialPreferences: NotificationPreferences = { posts: false, events: false };
  @Input() preferencesChange?: (prefs: NotificationPreferences) => void;

  // Internal state
  private preferences = signal<NotificationPreferences>({ posts: false, events: false });

  // Computed properties
  currentPreferences = computed(() => this.preferences());
  isNotificationOn = computed(() => this.preferences().posts || this.preferences().events);

  ngOnInit() {
    this.preferences.set({ ...this.initialPreferences });
  }

  onNotificationToggle(enabled: boolean): void {
    this.preferences.set({
      posts: enabled,
      events: enabled
    });
    this.preferencesChange?.(this.preferences());
  }

  onPostsToggle(posts: boolean): void {
    this.preferences.update(prev => ({
      ...prev,
      posts
    }));
    this.preferencesChange?.(this.preferences());
  }

  onEventsToggle(events: boolean): void {
    this.preferences.update(prev => ({
      ...prev,
      events
    }));
    this.preferencesChange?.(this.preferences());
  }

  getPreferences(): NotificationPreferences {
    return this.preferences();
  }
}
