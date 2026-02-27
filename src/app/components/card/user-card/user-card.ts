import { Button } from '@/components/form/button';
import { NgOptimizedImage } from '@angular/common';
import { Component, input, output, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { NetworkService } from '@/services/network.service';
import { ToasterService } from '@/services/toaster.service';
import { NavigationService } from '@/services/navigation.service';

@Component({
  imports: [Button, NgOptimizedImage],
  selector: 'user-card',
  styleUrl: './user-card.scss',
  templateUrl: './user-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserCard {
  // inputs
  user = input.required<any>();
  buttonLabel = input<string>('Add');
  buttonIcon = input<string>('pi-plus');
  buttonIconPos = input<'left' | 'right'>('right');

  // outputs
  added = output<string>();
  cardClicked = output<any>();

  // services
  private networkService = inject(NetworkService);
  private toasterService = inject(ToasterService);
  private navigationService = inject(NavigationService);

  // signals
  isAdding = signal<boolean>(false);

  // computed
  userImage = computed(() => {
    const user = this.user();
    return getImageUrlOrDefault(user?.thumbnail_url || '');
  });

  userName = computed(() => {
    const user = this.user();
    return user?.name || user?.username || '';
  });

  userLocation = computed(() => {
    const user = this.user();
    return user?.address || '';
  });

  onImageError(event: Event): void {
    onImageError(event);
  }

  onCardClick(): void {
    const username = this.user()?.username;
    if (username) {
      this.navigationService.navigateForward(`/${username}`);
    }
  }

  async onAddClick(): Promise<void> {
    // If this is a custom button (not "Add"), emit cardClicked instead
    if (this.buttonLabel() !== 'Add') {
      this.cardClicked.emit(this.user());
      return;
    }

    const user = this.user();
    const userId = user?.id;
    if (!userId) return;

    try {
      this.isAdding.set(true);
      await this.networkService.sendNetworkRequest(userId);
      this.toasterService.showSuccess('Network request sent successfully');
      this.added.emit(userId);
    } catch (error) {
      console.error('Error sending network request:', error);
      this.toasterService.showError('Failed to send network request');
    } finally {
      this.isAdding.set(false);
    }
  }
}
