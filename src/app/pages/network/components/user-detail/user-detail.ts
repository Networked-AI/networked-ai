import { Chip } from '@/components/common/chip';
import { Button } from '@/components/form/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { Component, Input, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { IUser } from '@/interfaces/IUser';
import { NgOptimizedImage } from '@angular/common';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { AuthService } from '@/services/auth.service';
import { MessagesService } from '@/services/messages.service';
import { ModalService } from '@/services/modal.service';
import { NavigationService } from '@/services/navigation.service';

@Component({
  selector: 'user-detail',
  styleUrl: './user-detail.scss',
  templateUrl: './user-detail.html',
  imports: [ToggleSwitchModule, Button, Chip, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UserDetail {
  // inputs
  @Input() user: IUser | null = null;

  // services
  private authService = inject(AuthService);
  private messagesService = inject(MessagesService);
  private modalService = inject(ModalService);
  private navigationService = inject(NavigationService);

  messages = ["Hey, let's network!", 'Wanna hang out?', 'Hey, are you free for some coffee?'];
  sendingMessage = signal<string | null>(null);

  getUserImage(): string {
    const imageUrl = this.user?.thumbnail_url || '';
    return getImageUrlOrDefault(imageUrl);
  }

  getAchievementDiamondPath(): string {
    const points = this.user?.total_gamification_points || 0;

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
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  messageUser(): void {
    this.modalService.dismissAllModals();
    const currentUserId = this.authService.currentUser()?.id;
    const otherUserId = this.user?.id;

    if (currentUserId && otherUserId) {
      this.navigationService.navigateForward('/chat-room', false, {
        user_ids: [currentUserId, otherUserId],
        is_personal: true
      });
    }
  }

  async onMessageChipClick(message: string): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;
    const otherUserId = this.user?.id;

    if (!currentUserId || !otherUserId || this.sendingMessage()) return;

    try {
      this.sendingMessage.set(message);

      const result = await this.messagesService.createOrGetChatRoom({
        user_ids: [currentUserId, otherUserId],
        is_personal: true
      });

      await this.messagesService.sendMessage(result.room_id, message);

      this.modalService.dismissAllModals();

      // Navigate to chat room
      this.navigationService.navigateForward('/chat-room', false, {
        user_ids: [currentUserId, otherUserId],
        is_personal: true,
        roomId: result.room_id
      });
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      this.sendingMessage.set(null);
    }
  }

  isSending(message: string): boolean {
    return this.sendingMessage() === message;
  }

  onUserClick() {
    this.modalService.close();
    this.navigationService.navigateForward(`/${this.user?.username}`);
  }
}
