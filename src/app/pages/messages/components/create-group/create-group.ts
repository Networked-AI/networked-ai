import { Button } from '@/components/form/button';
import { Searchbar } from '@/components/common/searchbar';
import { IUser } from '@/interfaces/IUser';
import { AuthService } from '@/services/auth.service';
import { MessagesService } from '@/services/messages.service';
import { MediaService } from '@/services/media.service';
import { ModalService } from '@/services/modal.service';
import { NetworkService } from '@/services/network.service';
import { UserService } from '@/services/user.service';
import { ToasterService } from '@/services/toaster.service';
import { extractUsernameFromQR, getImageUrlOrDefault, onImageError } from '@/utils/helper';
import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonFooter,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSpinner,
  IonToolbar,
  NavController
} from '@ionic/angular/standalone';
import { InputTextModule } from 'primeng/inputtext';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { Subject, debounceTime, distinctUntilChanged, from, switchMap } from 'rxjs';
import { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHintALLOption } from '@capacitor/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { Clipboard } from '@capacitor/clipboard';
import { ConnectionStatus } from '@/enums/connection-status.enum';
import { environment } from 'src/environments/environment';
@Component({
  selector: 'create-group',
  styleUrl: './create-group.scss',
  templateUrl: './create-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonFooter,
    Searchbar,
    IonContent,
    IonHeader,
    IonToolbar,
    Button,
    InputTextModule,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    NgOptimizedImage,
    MenuModule,
    IonSpinner
  ]
})
export class CreateGroup {
  private navCtrl = inject(NavController);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private networkService = inject(NetworkService);
  private messagesService = inject(MessagesService);
  private mediaService = inject(MediaService);
  private modalService = inject(ModalService);
  private userService = inject(UserService);
  private toasterService = inject(ToasterService);
  private router = inject(Router);

  @ViewChild('groupImageMenu') groupImageMenuRef?: Menu;
  @ViewChild('fileInput') fileInputRef?: { nativeElement: HTMLInputElement };

  // navigation context
  roomId = signal<string | null>(null);
  from = signal<'new-chat' | 'chat-info'>('new-chat');

  // auth
  isLoggedIn = computed(() => !!this.authService.currentUser());
  isNativePlatform = computed(() => Capacitor.isNativePlatform());

  // search + pagination
  searchText = signal('');
  users = signal<IUser[]>([]);
  currentPage = signal<number>(1);
  totalPages = signal<number>(0);
  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  hasMore = computed(() => this.currentPage() < this.totalPages());

  // selection + steps
  selectedMembers = signal<IUser[]>([]);
  isGroupDetails = signal(false);
  groupImagePreview = signal<string | null>(null);
  groupImageFile = signal<File | null>(null);
  groupImageUrl = signal<string | null>(null);
  groupName = signal<string>('');

  isCreatingOrJoining = signal<boolean>(false);

  groupImageMenuItems(): MenuItem[] {
    return [
      { label: 'Networked Gallery', icon: 'pi pi-images', command: () => this.selectNetworkedGallery() },
      { label: 'Browse files', icon: 'pi pi-folder-open', command: () => this.selectBrowseFiles() }
    ];
  }

  onGroupImageMenuClick(event: Event): void {
    this.groupImageMenuRef?.toggle(event);
  }

  // existing group members (when editing)
  existingMemberIds = signal<Set<string>>(new Set());
  isLoadingRoom = signal<boolean>(false);

  private isInitialized = false;
  private searchSubject = new Subject<string>();

  constructor() {
    // Debounced search
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((query) => from(this.resetAndLoad(query.trim() || undefined))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    // Watch search changes (debounced)
    effect(() => {
      const query = this.searchText();
      if (!this.isLoggedIn() || !this.isInitialized) return;
      this.searchSubject.next(query);
    });

    // Initialize when user is available
    effect(() => {
      const userId = this.authService.currentUser()?.id;
      if (!userId) {
        this.isInitialized = false;
        this.users.set([]);
        this.currentPage.set(1);
        this.totalPages.set(0);
        return;
      }

      if (!this.isInitialized) {
        this.isInitialized = true;
        this.resetAndLoad(this.searchText().trim() || undefined);
      }
    });
  }

  ionViewWillEnter(): void {
    this.ngOnInit();
  }

  async ngOnInit(): Promise<void> {
    const roomIdParam = this.route.snapshot.queryParamMap.get('roomId');
    const fromParam = this.route.snapshot.queryParamMap.get('from');

    const navigation = this.router.currentNavigation();
    const state: any = navigation?.extras?.state;

    const roomId = roomIdParam || state?.roomId;
    const from = fromParam || state?.from;

    if (roomId) {
      this.roomId.set(roomId);
      this.from.set(from === 'chat-info' ? 'chat-info' : 'new-chat');

      // Load existing group members to track who's already added
      await this.loadExistingGroupMembers(roomId);
      this.isGroupDetails.set(false);
      this.selectedMembers.set([]);
    }
  }

  /**
   * Load existing group members to track who's already in the group
   */
  private async loadExistingGroupMembers(roomId: string): Promise<void> {
    try {
      this.isLoadingRoom.set(true);
      const room = await this.messagesService.getChatRoomById(roomId);

      // Extract user IDs from existing members
      const memberIds = new Set<string>();
      if (room.users && Array.isArray(room.users)) {
        room.users.forEach((user: any) => {
          if (user.id) {
            memberIds.add(user.id);
          }
        });
      }

      this.existingMemberIds.set(memberIds);
    } catch (error) {
      console.error('Error loading existing group members:', error);
    } finally {
      this.isLoadingRoom.set(false);
    }
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  getImageUrl(imageUrl = ''): string {
    return getImageUrlOrDefault(imageUrl);
  }

  getUserThumbnail(user: IUser): string {
    const val = user.thumbnail_url ?? user.image_url ?? '';
    return typeof val === 'string' ? val : '';
  }

  getDisplayName(u: IUser): string {
    return u.name || u.username || '';
  }

  getDiamondPath(user: IUser): string {
    const points = user?.total_gamification_points || 0;
    if (points >= 50000) return '/assets/svg/gamification/diamond-50k.svg';
    if (points >= 40000) return '/assets/svg/gamification/diamond-40k.svg';
    if (points >= 30000) return '/assets/svg/gamification/diamond-30k.svg';
    if (points >= 20000) return '/assets/svg/gamification/diamond-20k.svg';
    if (points >= 10000) return '/assets/svg/gamification/diamond-10k.svg';
    if (points >= 5000) return '/assets/svg/gamification/diamond-5k.svg';
    return '/assets/svg/gamification/diamond-1k.svg';
  }

  private async resetAndLoad(search?: string): Promise<void> {
    this.currentPage.set(1);
    this.totalPages.set(0);
    await this.loadConnections(1, false, search);
  }

  async loadConnections(page: number = 1, append: boolean = false, search?: string): Promise<void> {
    if (!this.isLoggedIn()) return;
    try {
      if (page === 1) this.isLoading.set(true);

      const result = await this.networkService.getMyConnections({
        page,
        limit: 15,
        search: search || undefined
      });

      const nextUsers = result.data || [];
      if (append) {
        this.users.update((current) => [...current, ...nextUsers]);
      } else {
        this.users.set(nextUsers);
      }

      this.currentPage.set(result.pagination?.currentPage || 1);
      this.totalPages.set(result.pagination?.totalPages || 0);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  loadMoreUsers = async (event: Event): Promise<void> => {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;
    const search = this.searchText().trim() || undefined;

    if (this.isLoadingMore() || !this.hasMore()) {
      infiniteScroll.complete();
      return;
    }

    try {
      this.isLoadingMore.set(true);
      const nextPage = this.currentPage() + 1;
      await this.loadConnections(nextPage, true, search);
    } catch (error) {
      console.error('Error loading more users:', error);
    } finally {
      this.isLoadingMore.set(false);
      infiniteScroll.complete();
    }
  };

  toggleMember(user: IUser): void {
    // Don't allow selection if user is already in the group
    if (this.isAlreadyInGroup(user.id)) {
      return;
    }

    const isAlreadySelected = this.selectedMembers().some((u) => u.id === user.id);
    if (isAlreadySelected) {
      this.selectedMembers.update((list) => list.filter((u) => u.id !== user.id));
    } else {
      this.selectedMembers.update((list) => [...list, user]);
    }
  }

  /**
   * Check if a user is already in the group
   */
  isAlreadyInGroup(userId: string): boolean {
    return this.existingMemberIds().has(userId);
  }

  removeMember(user: IUser): void {
    this.selectedMembers.update((list) => list.filter((u) => u.id !== user.id));
  }

  isSelected(id: string): boolean {
    return this.selectedMembers().some((u) => u.id === id);
  }

  nextStep(): void {
    this.isGroupDetails.set(true);
  }

  async createGroup(): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;
    if (!currentUserId) return;

    const name = this.groupName().trim();
    if (!name) return;

    const memberIds = this.selectedMembers().map((u) => u.id);
    const user_ids = Array.from(new Set([currentUserId, ...memberIds]));

    this.isCreatingOrJoining.set(true);
    try {
      let profileImageUrl: string | null = this.groupImageUrl() ?? null;
      if (!profileImageUrl) {
        const imageFile = this.groupImageFile();
        if (imageFile instanceof File) {
          const response = await this.mediaService.uploadMedia('Other', [imageFile]);
          const uploadedUrl = response?.data?.[0]?.url;
          if (typeof uploadedUrl === 'string' && uploadedUrl.trim()) {
            profileImageUrl = uploadedUrl;
          }
        }
      }

      // const { room_id } = await this.messagesService.createOrGetChatRoom({
      const result = await this.messagesService.createOrGetChatRoom({
        user_ids,
        name,
        is_personal: false,
        profile_image: profileImageUrl
      });

      // const room = await this.messagesService.getChatRoomById(room_id);

      // this.navCtrl.navigateForward('/chat-info', {
      //   state: {
      //     roomId: room_id,
      //     chatRoom: room,
      //     from: 'new-group'
      //   }
      // });

      this.toasterService.showSuccess(result.message || 'Chat room created successfully.');
      this.navCtrl.navigateRoot('/messages');
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      this.isCreatingOrJoining.set(false);
    }
  }

  handleBack(): void {
    if (this.isGroupDetails()) {
      this.isGroupDetails.set(false);
      return;
    }

    // if (this.from() === 'chat-info') {
    this.navCtrl.back();
    //     return;
    // }

    // this.navCtrl.navigateBack('/messages');
  }

  async selectNetworkedGallery(): Promise<void> {
    const data = await this.modalService.openImageGalleryModal('Select group image', false);
    if (!data) return;

    const url = Array.isArray(data) ? data[0] : data;
    if (url && typeof url === 'string') {
      this.groupImageUrl.set(url);
      this.groupImageFile.set(null);
      this.groupImagePreview.set(null);
    }
  }

  selectBrowseFiles(): void {
    this.fileInputRef?.nativeElement?.click();
  }

  onGroupImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files.length) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) return;

    this.groupImageFile.set(file);
    this.groupImageUrl.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      this.groupImagePreview.set(reader.result as string);
    };
    reader.readAsDataURL(file);

    input.value = '';
  }

  onGroupNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.groupName.set(value);
  }

  /**
   * Add selected members to existing group
   */
  async addMembersToGroup(): Promise<void> {
    const roomId = this.roomId();
    if (!roomId) return;

    const selectedIds = this.selectedMembers()
      .map((u) => u.id)
      .filter((id) => !this.isAlreadyInGroup(id));

    if (selectedIds.length === 0) {
      console.log('No new members to add');
      return;
    }

    this.isCreatingOrJoining.set(true);

    try {
      await this.messagesService.joinRoom(roomId, selectedIds);

      // Navigate back to chat-info after successful addition
      this.navCtrl.back();
    } catch (error) {
      console.error('Error adding members to group:', error);
    } finally {
      this.isCreatingOrJoining.set(false);
    }
  }

  async copyInviteLink(): Promise<void> {
    const roomId = this.roomId();
    if (!roomId) {
      this.toasterService.showError('Group not found. Please create the group first.');
      return;
    }

    try {
      const inviteLink = `${environment.frontendUrl}/group-invitation/${roomId}`;
      await Clipboard.write({ string: inviteLink });
      this.toasterService.showSuccess('Invite link copied to clipboard');
    } catch (error) {
      console.error('Error copying invite link:', error);
      this.toasterService.showError('Failed to copy invite link');
    }
  }

  async scanQRCodeForContact(): Promise<void> {
    try {
      const { ScanResult } = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHintALLOption.ALL });
      if (ScanResult) {
        await this.handleQRCodeForContact(ScanResult);
      } else {
        this.toasterService.showError('No QR code detected');
      }
    } catch (error) {
      this.toasterService.showError(error?.toString()|| 'Unable to scan QR code');
    }
  }

  private async handleQRCodeForContact(decodedText: string): Promise<void> {
    try {
      const username = extractUsernameFromQR(decodedText);
      if (!username) {
        this.toasterService.showError('Invalid QR code. Please scan a valid profile QR code.');
        return;
      }

      const user = await this.userService.getUser(username);

      if (!user || !user.id) {
        this.toasterService.showError('User not found.');
        return;
      }

      if (this.isAlreadyInGroup(user.id)) {
        this.toasterService.showError('User is already in the group.');
        return;
      }

      const isAlreadySelected = this.selectedMembers().some((u) => u.id === user.id);
      if (isAlreadySelected) {
        this.toasterService.showError('User is already selected.');
        return;
      }

      if (user.id == this.authService.currentUser()?.id) return;

      this.selectedMembers.update((list) => [...list, user]);

      if (user.connection_status === ConnectionStatus.CONNECTED) {
        const isInUsersList = this.users().some((u) => u.id === user.id);
        if (!isInUsersList) {
          this.users.update((list) => [user, ...list]);
        }
      }
    } catch (error: any) {
      console.error('Error handling QR code for contact:', error);
      if (error.message && error.message.includes('not found')) {
        this.toasterService.showError('User not found.');
      } else {
        this.toasterService.showError('Failed to add contact. Please try again.');
      }
    }
  }
}
