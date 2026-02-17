import { Avatar } from 'primeng/avatar';
import { IUser } from '@/interfaces/IUser';
import { AvatarGroup } from 'primeng/avatargroup';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { NavigationService } from '@/services/navigation.service';
import { Component, input, ChangeDetectionStrategy, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'avatar-group',
  imports: [Avatar, AvatarGroup, NgOptimizedImage],
  styleUrl: './avatar-group.scss',
  templateUrl: './avatar-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarGroupComponent {
  users = input<IUser[]>([]);
  size = input<'normal' | 'large' | 'xlarge'>('large');
  shape = input<'square' | 'circle'>('circle');
  maxVisible = input<number>(5);
  showOverflow = input<boolean>(true);
  disabled = input<boolean>(true);
  totalCount = input<number | null>(null);

  private navigationService = inject(NavigationService);

  getVisibleUsers(): IUser[] {
    const allUsers = this.users();
    const totalUsers = allUsers.length;
    if (totalUsers > 5) {
      return allUsers.slice(0, 4);
    }
    return allUsers.slice(0, this.maxVisible());
  }

  trackByUser(index: number, user: IUser): string {
    return user.id || `user-${index}`;
  }

  getRemainingCount(): number {
    const customTotal = this.totalCount();
    if (customTotal !== null && customTotal !== undefined) {
      const visibleCount = this.getVisibleUsers().length;
      return Math.max(0, customTotal - visibleCount);
    }

    const allUsers = this.users();
    const totalUsers = allUsers.length;

    if (totalUsers > 5) {
      return totalUsers - 4;
    }

    const remaining = totalUsers - this.maxVisible();
    return remaining > 0 ? remaining : 0;
  }

  shouldShowOverflow(): boolean {
    const customTotal = this.totalCount();
    if (customTotal !== null && customTotal !== undefined) {
      const visibleCount = this.getVisibleUsers().length;
      return this.showOverflow() && customTotal > visibleCount;
    }

    const allUsers = this.users();
    return this.showOverflow() && allUsers.length > 5;
  }

  getUserImage(user: IUser): string {
    const thumbnailUrl = user?.thumbnail_url;
    const imageUrl = user?.image_url;
    const imageUrlString = typeof imageUrl === 'string' ? imageUrl : '';
    return getImageUrlOrDefault(thumbnailUrl || imageUrlString || '');
  }

  onUserClick(user: IUser): void {
    if (this.disabled()) return;
    const username = user?.username;
    if (username) {
      this.navigationService.navigateForward(`/${username}`);
    }
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }
}
