import { Button } from '@/components/form/button';
import { InputTextModule } from 'primeng/inputtext';
import { ModalService } from '@/services/modal.service';
import { MessagesService } from '@/services/messages.service';
import { ChatRoom, ChatRoomUser } from '@/interfaces/IChat';
import { MenuItem } from '@/components/modal/menu-modal';
import { MenuItem as PrimeNGMenuItem } from 'primeng/api';
import { Menu, MenuModule } from 'primeng/menu';
import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectionStrategy, Component, inject, signal, OnDestroy, computed, ViewChild } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonFooter, IonSpinner, NavController, ViewWillEnter } from '@ionic/angular/standalone';
import { getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { NgOptimizedImage } from '@angular/common';
import { AuthService } from '@/services/auth.service';
import { NavigationService } from '@/services/navigation.service';
import { SocketService } from '@/services/socket.service';
import { ToasterService } from '@/services/toaster.service';
import { MediaService } from '@/services/media.service';
import { OgService } from '@/services/og.service';
import { environment } from 'src/environments/environment';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'chat-info',
  styleUrl: './chat-info.scss',
  templateUrl: './chat-info.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonFooter,
    IonToolbar,
    IonHeader,
    IonContent,
    Button,
    InputTextModule,
    NgOptimizedImage,
    ToggleSwitchModule,
    FormsModule,
    MenuModule,
    IonSpinner
  ]
})
export class ChatInfo implements ViewWillEnter, OnDestroy {
  private router = inject(Router);
  private navCtrl = inject(NavController);
  private messagesService = inject(MessagesService);
  private socketService = inject(SocketService);
  private toasterService = inject(ToasterService);
  private mediaService = inject(MediaService);
  authService = inject(AuthService);
  navigationService = inject(NavigationService);

  @ViewChild('groupImageMenu') groupImageMenuRef?: Menu;
  @ViewChild('fileInput') fileInputRef?: { nativeElement: HTMLInputElement };

  // Socket event handler reference for cleanup
  private roomUpdatedHandler?: (payload: ChatRoom) => void;

  isEditingName = signal(false);
  isSavingGroupName = signal(false);
  notificationsOn = true;
  groupName = signal<string>('Group');
  createdDate = signal<string>('');
  private route = inject(ActivatedRoute);
  tempGroupName = signal(this.groupName());
  private modalService = inject(ModalService);
  private ogService = inject(OgService);
  groupImage = signal<string | null>('assets/images/profile.jpeg');
  isSavingGroupImage = signal(false);
  roomId = signal<string | null>(null);
  chatRoom = signal<ChatRoom | null>(null);
  members = signal<ChatRoomUser[]>([]);
  fromGroupCreation = signal<boolean>(false);

  isEventRoom = computed(() => {
    const room = this.chatRoom();
    return !!(room?.event_id || room?.event);
  });

  navigateToEvent() {
    if (!this.isEventRoom()) return; 
    this.navigationService.navigateForward(`/event/${this.chatRoom()?.event?.slug}`)
  }

  private readonly fullMenuItems: MenuItem[] = [
    { label: 'Add Members', icon: 'assets/svg/addUserIcon.svg', iconType: 'svg', action: 'addMembers' },
    { label: 'Change Group Name', icon: 'assets/svg/editIconBlack.svg', iconType: 'svg', action: 'changeGroupName' },
    { label: 'Mute Notifications', icon: 'assets/svg/alertOffBlackIcon.svg', iconType: 'svg', action: 'toggleNotifications' },
    { label: 'Leave Group', icon: 'pi pi-sign-out text-6', iconType: 'pi', danger: true, action: 'leaveGroup' }
  ];

  get menuItems(): MenuItem[] {
    if (this.isEventRoom()) {
      return this.fullMenuItems.filter((item) => item.action !== 'addMembers' && item.action !== 'changeGroupName');
    }
    return this.fullMenuItems;
  }

  groupImageMenuItems(): PrimeNGMenuItem[] {
    if (this.isEventRoom()) return [];
    return [
      { label: 'Networked Gallery', icon: 'pi pi-images', command: () => this.selectNetworkedGallery() },
      { label: 'Browse files', icon: 'pi pi-folder-open', command: () => this.selectBrowseFiles() }
    ];
  }

  onGroupImageMenuClick(event: Event): void {
    if (this.isEventRoom()) return;
    this.groupImageMenuRef?.toggle(event);
  }

  isLoggedIn = computed(() => !!this.authService.currentUser());

  async initializePage(forceRefresh: boolean = false): Promise<void> {
    const routePath = this.router.url;
    const groupId = this.route.snapshot.paramMap.get('id');
    const currentRoomId = this.roomId();

    const roomIdToUse = groupId || currentRoomId;
    if (roomIdToUse) {
      if (groupId) {
        this.roomId.set(groupId);
      }

      if (!this.chatRoom() || forceRefresh) {
        const room = await this.messagesService.getChatRoomById(roomIdToUse);
        this.applyRoom(room);
      }
    }

    if (groupId && routePath.includes('group-invitation')) {
      await this.modalService.openGroupInvitationModal(this.chatRoom());
    }
  }
  async ngOnInit(): Promise<void> {
    const navigation = this.router.currentNavigation();
    const state: any = navigation?.extras?.state || {};
    const stateRoom = state?.chatRoom as ChatRoom | undefined;
    if (state?.from === 'new-group') {
      this.fromGroupCreation.set(true);
    }

    if (stateRoom) {
      this.applyRoom(stateRoom);
      return;
    }

    const routePath = this.router.url;
    const groupId = this.route.snapshot.paramMap.get('id');
    if (groupId) this.roomId.set(groupId);

    if (!this.chatRoom()) {
      const room = await this.messagesService.getChatRoomById(this.roomId()!);
      this.applyRoom(room);
    }

    if (groupId && routePath.includes('group-invitation')) {
      const room = this.chatRoom();
      if (room) this.ogService.setOgTagInGroupInvitation(room);
    }
  }

  private setupRoomUpdateListener(): void {
    const currentRoomId = this.roomId();
    if (!currentRoomId) return;

    if (this.roomUpdatedHandler) {
      this.socketService.off('room:updated', this.roomUpdatedHandler);
    }

    this.roomUpdatedHandler = (payload: ChatRoom) => {
      const roomId = this.roomId();
      if (payload.id === roomId) {
        console.log('Room updated for current chat-info room:', payload);
        this.applyRoom(payload);
      }
    };

    this.socketService.onAfterRegistration(() => {
      if (this.roomUpdatedHandler) {
        this.socketService.on('room:updated', this.roomUpdatedHandler);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.roomUpdatedHandler) {
      this.socketService.off('room:updated', this.roomUpdatedHandler);
    }
  }

  async ionViewWillEnter() {
    this.setupRoomUpdateListener();
    await this.initializePage(true);
  }

  private applyRoom(room: ChatRoom): void {
    this.chatRoom.set(room);
    this.roomId.set(room.id);

    if (room.event?.title) {
      this.groupName.set(room.event.title);
      this.tempGroupName.set(room.event.title);
    } else {
      this.groupName.set(room.name || 'Group');
      this.tempGroupName.set(room.name || 'Group');
    }

    // If event is available, prioritize event images
    if (room.event?.thumbnail_url) {
      this.groupImage.set(room.event.thumbnail_url);
    } else if (room.event?.image_url) {
      this.groupImage.set(room.event.image_url);
    } else {
      this.groupImage.set(room.profile_image || 'assets/images/profile.jpeg');
    }

    this.createdDate.set(new Date(room.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));
    if (room.users && room.users.length) {
      this.members.set(room.users);
    } else {
      this.members.set([]);
    }
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  getDiamondPath(user: ChatRoomUser): string {
    const points = user?.total_gamification_points || 0;
    if (points >= 50000) return '/assets/svg/gamification/diamond-50k.svg';
    if (points >= 40000) return '/assets/svg/gamification/diamond-40k.svg';
    if (points >= 30000) return '/assets/svg/gamification/diamond-30k.svg';
    if (points >= 20000) return '/assets/svg/gamification/diamond-20k.svg';
    if (points >= 10000) return '/assets/svg/gamification/diamond-10k.svg';
    if (points >= 5000) return '/assets/svg/gamification/diamond-5k.svg';
    return '/assets/svg/gamification/diamond-1k.svg';
  }

  startEditGroupName() {
    this.tempGroupName.set(this.groupName());
    this.isEditingName.set(true);
  }

  cancelEditGroupName() {
    this.isEditingName.set(false);
  }

  async saveGroupName(): Promise<void> {
    const name = this.tempGroupName().trim();
    if (!name) return;

    const roomId = this.roomId();
    if (!roomId) {
      this.toasterService.showError('Group not found.');
      return;
    }

    try {
      this.isSavingGroupName.set(true);
      await this.messagesService.updateRoom(roomId, { name });

      this.groupName.set(name);
      this.tempGroupName.set(name);
      this.isEditingName.set(false);

      const room = await this.messagesService.getChatRoomById(roomId);
      this.applyRoom(room);

      this.toasterService.showSuccess('Group name updated');
    } catch (error: any) {
      console.error('Error updating group name:', error);
      this.toasterService.showError(error?.message || 'Failed to update group name');
    } finally {
      this.isSavingGroupName.set(false);
    }
  }

  handleBack() {
    // If this screen was opened right after creating a new group,
    // back should always go to messages list.
    if (this.fromGroupCreation()) {
      this.navCtrl.navigateRoot('/messages');
      return;
    }

    // Otherwise, preserve existing back behavior (e.g. coming from chat-room)
    this.navCtrl.back();
  }

  toggleNotifications(): void {
    this.notificationsOn = !this.notificationsOn;
  }

  async openMenu() {
    const result = await this.modalService.openMenuModal(this.menuItems);
    if (!result) return;

    const actions: Record<string, () => void> = {
      leave: () => this.leaveGroup(),
      addMembers: () => this.addMembers(),
      changeGroupName: () => this.changeGroupName(),
      muteNotifications: () => this.toggleNotifications()
    };

    actions[result.role]?.();
  }

  async openShareGroup() {
    await this.modalService.openShareGroupModal({
      name: this.groupName() || '',
      membersCount: this.members().length,
      inviteLink: `${environment.frontendUrl}/group-invitation/${this.roomId()}`,
      image: this.groupImage() || ''
    });
  }

  async addMembers() {
    this.navCtrl.navigateForward(`/create-group?roomId=${this.roomId()}&from=chat-info`);
  }

  async changeGroupName() {
    this.startEditGroupName();
  }

  onGroupNameInput(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.tempGroupName.set(value);
  }

  async selectNetworkedGallery(): Promise<void> {
    const data = await this.modalService.openImageGalleryModal('Select group image', false);
    if (!data) return;

    const url = Array.isArray(data) ? data[0] : data;
    if (url && typeof url === 'string') {
      await this.updateGroupProfileImage(url);
    }
  }

  selectBrowseFiles(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  async onGroupImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) return;

    input.value = '';

    try {
      this.isSavingGroupImage.set(true);
      const response = await this.mediaService.uploadMedia('Other', [file]);
      const uploadedUrl = response?.data?.[0]?.url;
      if (typeof uploadedUrl === 'string' && uploadedUrl.trim()) {
        await this.updateGroupProfileImage(uploadedUrl);
      } else {
        this.toasterService.showError('Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading group image:', error);
      this.toasterService.showError('Failed to upload image');
    } finally {
      this.isSavingGroupImage.set(false);
    }
  }

  private async updateGroupProfileImage(profileImageUrl: string): Promise<void> {
    const roomId = this.roomId();
    if (!roomId) return;

    try {
      this.isSavingGroupImage.set(true);
      await this.messagesService.updateRoom(roomId, { profile_image: profileImageUrl });
      this.groupImage.set(profileImageUrl);
      const room = await this.messagesService.getChatRoomById(roomId);
      this.applyRoom(room);
      this.toasterService.showSuccess('Group image updated');
    } catch (error: unknown) {
      console.error('Error updating group image:', error);
      this.toasterService.showError(error instanceof Error ? error.message : 'Failed to update group image');
    } finally {
      this.isSavingGroupImage.set(false);
    }
  }

  async leaveGroup() {
    const result = await this.modalService.openConfirmModal({
      iconName: 'pi-sign-out',
      title: 'Leave Group',
      description: 'Are you sure you want to go leave this group chat?',
      confirmButtonLabel: 'Leave',
      cancelButtonLabel: 'Cancel',
      confirmButtonColor: 'danger',
      iconPosition: 'left',
      iconBgColor: '#C73838'
    });

    if (result && result.role === 'confirm') {
      const roomId = this.roomId();
      const currentUserId = this.authService.currentUser()?.id;

      if (!roomId || !currentUserId) {
        console.error('Missing roomId or userId');
        return;
      }

      try {
        await this.messagesService.leaveRoom(roomId, currentUserId);
        this.navCtrl.navigateRoot('/messages');
      } catch (error) {
        console.error('Error leaving group:', error);
      }
    }
  }

  onUserClick(user: ChatRoomUser): void {
    const username = user?.username;
    if (username) {
      this.navigationService.navigateForward(`/${username}`);
    }
  }
}
