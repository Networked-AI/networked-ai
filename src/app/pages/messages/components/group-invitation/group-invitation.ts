import { ChatRoom } from '../chat-room';
import { Button } from '@/components/form/button';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '@/services/auth.service';
import { ModalService } from '@/services/modal.service';
import { NavController } from '@ionic/angular/standalone';
import { MessagesService } from '@/services/messages.service';
import { NavigationService } from '@/services/navigation.service';
import { Component, signal, inject, ChangeDetectionStrategy, input, Input, computed } from '@angular/core';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { BaseApiService } from '@/services/base-api.service';
import { ToasterService } from '@/services/toaster.service';

@Component({
  imports: [Button, NgOptimizedImage],
  selector: 'group-invitation',
  styleUrl: './group-invitation.scss',
  templateUrl: './group-invitation.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GroupInvitation {
  private navCtrl = inject(NavController);
  private modalService = inject(ModalService);
  private authService = inject(AuthService);
  private messagesService = inject(MessagesService);
  private navigationService = inject(NavigationService);
  private toasterService = inject(ToasterService);

  @Input() room!: ChatRoom;
  group = computed(() => {
    const room: any = this.room;
    if (!room) return null;

    const users = room.users ?? [];

    return {
      id: room.id,
      name: room.name,
      image: room.event_id ? room.event?.thumbnail_url : room.profile_image || '/assets/group-placeholder.png',

      membersCount: users.length,

      // first 5 thumbnails
      membersPreview: users.slice(0, 5).map((u: any) => u.thumbnail_url || '/assets/profile.jpeg'),

      previewText: {
        first: users[0]?.name || '',
        second: users[1]?.name || '',
        others: Math.max(users.length - 2, 0)
      }
    };
  });

  isJoining = signal(false);

  private async ensureLoggedIn(): Promise<boolean> {
    if (this.authService.getCurrentToken()) return true;
    const result = await this.modalService.openLoginModal();
    return result?.success ?? false;
  }

  close() {
    this.modalService.close();
    this.navigationService.navigateForward('/messages', true);
  }

  async joinRoom(): Promise<void> {
    if (!(await this.ensureLoggedIn())) return;
    try {
      const userId = this.authService.currentUser()?.id;
      const roomId = this.group()?.id;
  
      if (userId && roomId) {
        this.isJoining.set(true);
        await this.messagesService.joinRoom(roomId, [userId]);
        this.isJoining.set(false);
        this.close();
      }
    } catch (error) {
      const message = BaseApiService.getErrorMessage(error, 'Failed to join group.');
      this.toasterService.showError(message);
    }
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl, 'assets/images/profile.jpeg');
  }
}
