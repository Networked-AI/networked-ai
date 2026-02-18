import { ActivatedRoute, Router } from '@angular/router';
import { Button } from '@/components/form/button';
import { ChangeDetectionStrategy, Component, inject, signal, OnInit, computed, ElementRef, viewChild, OnDestroy } from '@angular/core';
import {
  IonFooter,
  IonHeader,
  IonContent,
  IonToolbar,
  NavController,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonIcon
} from '@ionic/angular/standalone';
import { MessagesService } from '@/services/messages.service';
import { AuthService } from '@/services/auth.service';
import { SocketService } from '@/services/socket.service';
import { ModalService } from '@/services/modal.service';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { ChatMessage, ChatRoomUser } from '@/interfaces/IChat';
import { CommonModule, NgOptimizedImage, DatePipe } from '@angular/common';
import { onImageError, getImageUrlOrDefault } from '@/utils/helper';
import { NavigationService } from '@/services/navigation.service';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Capacitor } from '@capacitor/core';
import { TextareaModule } from 'primeng/textarea';
import { ChatFeedCard } from '@/components/card/chat-feed-card';
import { ChatEventCard } from '@/components/card/chat-event-card';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import { EventService } from '@/services/event.service';
import { IEvent } from '@/interfaces/event';
import { HapticService } from '@/services/haptic.service';

@Component({
  selector: 'chat-room',
  styleUrl: './chat-room.scss',
  templateUrl: './chat-room.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonFooter,
    IonContent,
    IonHeader,
    IonToolbar,
    Button,
    IonSpinner,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonIcon,
    IconField,
    InputIcon,
    CommonModule,
    TextareaModule,
    PickerComponent,
    NgOptimizedImage,
    ChatFeedCard,
    ChatEventCard
  ]
})
export class ChatRoom implements OnInit, OnDestroy {
  // @ViewChild(IonContent) content?: IonContent;
  content = viewChild<IonContent>('content');

  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private messagesService = inject(MessagesService);
  private authService = inject(AuthService);
  private socketService = inject(SocketService);
  private modalService = inject(ModalService);
  private navigationService = inject(NavigationService);
  private router = inject(Router);
  private datePipe = new DatePipe('en-US');
  private sanitizer = inject(DomSanitizer);
  private eventService = inject(EventService);
  hapticService = inject(HapticService);

  // Socket event handler references for cleanup
  private messageCreatedHandler?: (payload: { message: ChatMessage }) => void;
  private messageUpdatedHandler?: (payload: { message: ChatMessage }) => void;
  private messageDeletedHandler?: (payload: { message_id: string; room_id: string; deleted_by?: string | null }) => void;

  newMessage = signal('');
  chatId = signal<string>('');
  chatName = signal('');
  otherUser = signal<ChatRoomUser | null>(null);
  isEvent = signal<boolean>(false);
  eventData = signal<IEvent | null>(null);
  isGroup = computed(() => this.chatRoom()?.is_personal === false);
  selectedIndex = signal<string | null>(null);
  editingIndex = signal<string | null>(null);
  selectedFile = signal<File | null>(null);
  showEmojiPicker = signal<boolean>(false);

  messages = signal<ChatMessage[]>([]);

  fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  sortedMessages = computed(() => {
    return this.sortMessages(this.messages());
  });

  showEventAnalytics = computed(() => {
    const event = this.eventData();

    if (!event?.questionnaire?.length) {
      return false;
    }

    return event.questionnaire.some((q: any) => q.is_public === true && ['SingleChoice', 'MultipleChoice', 'Rating'].includes(q.question_type));
  });

  /**
   * Check if we should show a date separator before a message
   */
  shouldShowDateSeparator(currentIndex: number): boolean {
    const messages = this.sortedMessages();
    if (currentIndex === 0) {
      return true;
    }

    const currentMessage = messages[currentIndex];
    const previousMessage = messages[currentIndex - 1];

    const currentDate = new Date(currentMessage.created_at);
    const previousDate = new Date(previousMessage.created_at);

    return (
      currentDate.getDate() !== previousDate.getDate() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getFullYear() !== previousDate.getFullYear()
    );
  }

  formatDateLabel(isoString: string): string {
    if (!isoString) return '';

    const messageDate = new Date(isoString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time to compare only dates
    const messageDateOnly = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());

    if (messageDateOnly.getTime() === todayOnly.getTime()) {
      return 'Today';
    } else if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
      return 'Yesterday';
    } else {
      // Format as "Mon Jan 28" or "Mon Jan 28, 2026" if not current year
      const currentYear = today.getFullYear();
      const messageYear = messageDate.getFullYear();

      if (messageYear === currentYear) {
        return this.datePipe.transform(messageDate, 'EEE MMM d') || '';
      } else {
        return this.datePipe.transform(messageDate, 'EEE MMM d, y') || '';
      }
    }
  }

  isLoading = signal<boolean>(false);
  isLoadingMore = signal<boolean>(false);
  isLoadingRoom = signal<boolean>(false);
  currentPage = signal<number>(1);
  totalPages = signal<number>(1);
  hasMoreMessages = computed(() => this.currentPage() < this.totalPages());
  chatRoom = signal<any>(null);

  currentUser = this.authService.currentUser;

  private async updateChatRoomInfo(room: any): Promise<void> {
    if (room) {
      if (room.event?.title) {
        this.chatName.set(room.event.title);
      } else if (room.is_personal && room.users && room.users.length > 0) {
        const currentUserId = this.currentUser()?.id;
        const otherUser = room.users.find((user: any) => user.id !== currentUserId);
        this.otherUser.set(otherUser);

        this.chatName.set(this.otherUser()?.name || this.otherUser()?.username || 'Chat');
      } else {
        this.chatName.set(room.name || 'Chat');
      }
      this.isEvent.set(!!room.event_id);
      if (room.event_id) {
        const eventData = await this.eventService.getEventById(room.event_id);
        this.eventData.set(eventData);
      }
    }
  }

  chatImage = computed(() => {
    const room = this.chatRoom();
    if (!room) return null;

    if (room.event?.thumbnail_url) {
      return room.event.thumbnail_url;
    }
    if (room.event?.image_url) {
      return room.event.image_url;
    }

    if (room.profile_image) return room.profile_image;

    if (room.is_personal && this.otherUser()) {
      return this.otherUser()?.thumbnail_url || '';
    }
    return null;
  });

  async ngOnInit() {
    const navigation = this.router.currentNavigation();
    const state: any = navigation?.extras?.state;

    if (state?.chatRoom?.id) {
      this.chatRoom.set(state.chatRoom);
      this.updateChatRoomInfo(state.chatRoom);
      this.chatId.set(state.chatRoom.id);

      await this.loadMessages();

      this.messagesService.markRoomAsRead(state.chatRoom.id);

      this.joinRoom();
      this.setupMessageListener();
      return;
    }
    if (state?.user_ids && Array.isArray(state.user_ids) && state.user_ids.length > 0) {
      // Personal or group chat with user_ids
      await this.initializeChatRoom(state);
    } else if (state?.event_id) {
      // Event chat - API will handle user_ids based on event participants
      await this.initializeChatRoom(state);
    } else {
      console.error('Missing required data for chat room initialization');
    }
  }

  async ionViewWillEnter(): Promise<void> {
    const roomId = this.chatId() || this.chatRoom()?.id;
    if (!roomId) return;

    try {
      const room = await this.messagesService.getChatRoomById(roomId);
      this.chatRoom.set(room as any);
      this.updateChatRoomInfo(room as any);
    } catch (error) {
      console.error('Error refreshing chat room data:', error);
    }
  }

  /**
   * Initialize chat room by creating or getting existing room
   */
  private async initializeChatRoom(state: any): Promise<void> {
    const currentUserId = this.authService.currentUser()?.id;

    if (!currentUserId) {
      console.error('User not logged in');
      return;
    }

    try {
      this.isLoadingRoom.set(true);

      const roomParams: {
        user_ids: string[];
        name?: string | null;
        is_personal?: boolean;
        event_id?: string | null;
        event_image?: string | null;
        profile_image?: string | null;
      } = {
        user_ids: state.user_ids || [],
        is_personal: state.is_personal ?? (state.event_id ? false : true)
      };

      if (state.event_id !== undefined) {
        roomParams.event_id = state.event_id;
      }

      // Create or get existing chat room
      const result = await this.messagesService.createOrGetChatRoom(roomParams);

      // Set the room ID
      this.chatId.set(result.room_id);

      // Get full room data by ID to load header data and other required details
      try {
        const fullRoomData = await this.messagesService.getChatRoomById(result.room_id);
        this.chatRoom.set(fullRoomData);
        this.updateChatRoomInfo(fullRoomData);
      } catch (error) {
        console.error('Error loading full room data:', error);
        // Fallback: use room data from result if available
        if (result.room) {
          this.chatRoom.set(result.room);
          this.updateChatRoomInfo(result.room);
        }
      }

      // Join the room via socket after messages are loaded
      await this.joinRoom();

      // Load messages for the room
      await this.loadMessages();

      // Setup socket listener for new messages
      this.setupMessageListener();
    } catch (error) {
      console.error('Error initializing chat room:', error);
    } finally {
      this.isLoadingRoom.set(false);
    }
  }

  ngOnDestroy(): void {
    // Leave the room when component is destroyed
    this.leaveRoom();

    // Remove socket listener
    if (this.messageCreatedHandler) {
      this.socketService.off('message:created', this.messageCreatedHandler);
    }
    if (this.messageUpdatedHandler) {
      this.socketService.off('message:updated', this.messageUpdatedHandler);
    }
    if (this.messageDeletedHandler) {
      this.socketService.off('message:deleted', this.messageDeletedHandler);
    }

    const roomId = this.chatId();
    if (roomId) {
      this.messagesService.markRoomAsRead(roomId);
    }
  }

  /**
   * Join the chat room via socket
   */
  async joinRoom(): Promise<void> {
    const userId = this.authService.currentUser()?.id;
    const roomId = this.chatId();

    if (userId && roomId) {
      try {
        await this.messagesService.joinRoom(roomId, [userId]);
      } catch (error) {
        console.error(error);
      }
      this.socketService.onAfterRegistration(() => {
        this.socketService.emit('joinRoom', { userId, roomId });
      });
    }
  }

  /**
   * Leave the chat room via socket
   */
  private leaveRoom(): void {
    const userId = this.authService.currentUser()?.id;
    const roomId = this.chatId();

    if (userId && roomId && this.socketService.isSocketReady()) {
      this.socketService.emit('leaveRoom', { userId, roomId });
    }
  }

  /**
   * Setup socket listeners for message events
   */
  private setupMessageListener(): void {
    const currentRoomId = this.chatId();

    // Handler for message:created
    this.messageCreatedHandler = (payload: { message: ChatMessage }) => {
      const newMessage = payload.message;

      // Only add message if it belongs to current room
      if (newMessage.chat_room_id === currentRoomId) {
        // Check if message already exists (avoid duplicates)
        const existingMessage = this.messages().find((msg) => msg.id === newMessage.id);

        if (!existingMessage) {
          // Append new message to the array (it will be sorted by computed property)
          this.messages.update((current) => [...current, newMessage]);

          // Scroll to bottom when new message arrives
          this.scrollToBottom();
        }
      }
    };

    // Handler for message:updated
    this.messageUpdatedHandler = (payload: { message: ChatMessage }) => {
      const updatedMessage = payload.message;

      // Only update message if it belongs to current room
      if (updatedMessage.chat_room_id === currentRoomId) {
        this.messages.update((current) => current.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg)));
      }
    };

    // Handler for message:deleted
    this.messageDeletedHandler = (payload: { message_id: string }) => {
      // Only handle if it belongs to current room
      if (payload.message_id) {
        this.messages.update((current) =>
          current.map((msg) => (msg.id === payload.message_id ? { ...msg, is_deleted: true, message: 'This message was deleted' } : msg))
        );
      }
    };

    // Register all listeners after socket is ready
    this.socketService.onAfterRegistration(() => {
      if (this.messageCreatedHandler) {
        this.socketService.on('message:created', this.messageCreatedHandler);
      }
      if (this.messageUpdatedHandler) {
        this.socketService.on('message:updated', this.messageUpdatedHandler);
      }
      if (this.messageDeletedHandler) {
        this.socketService.on('message:deleted', this.messageDeletedHandler);
      }
    });
  }

  /**
   * Sort messages by created_at ascending (oldest first, newest last)
   */
  private sortMessages(messages: ChatMessage[]): ChatMessage[] {
    return [...messages].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateA - dateB;
    });
  }

  /**
   * Load messages for the chat room
   */
  async loadMessages(reset: boolean = true): Promise<void> {
    // this.scrollToBottom();
    try {
      if (reset) {
        this.isLoading.set(true);
      } else {
        this.isLoadingMore.set(true);
      }

      const page = reset ? 1 : this.currentPage() + 1;
      const result = await this.messagesService.getMessagesByRoomId(this.chatId(), {
        page,
        limit: 15
      });

      // For reverse pagination: prepend older messages (if not resetting)
      // Or set messages if resetting (newest messages)
      if (reset) {
        this.messages.set(result.messages);
        this.scrollToBottom();
      } else {
        // Prepend older messages at the beginning
        this.messages.update((current) => [...result.messages, ...current]);
      }

      this.currentPage.set(result.pagination.currentPage);
      this.totalPages.set(result.pagination.totalPages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      this.isLoading.set(false);
      this.isLoadingMore.set(false);
    }
  }

  /**
   * Load more older messages (reverse pagination on scroll up)
   */
  async loadMoreMessages(event: Event): Promise<void> {
    const infiniteScroll = (event as CustomEvent).target as HTMLIonInfiniteScrollElement;

    if (!this.hasMoreMessages()) {
      infiniteScroll.complete();
      return;
    }

    const content = this.content();
    if (!content) return;

    try {
      const scrollEl = await content.getScrollElement();
      const previousHeight = scrollEl?.scrollHeight || 0;

      await this.loadMessages(false);

      requestAnimationFrame(() => {
        const newHeight = scrollEl.scrollHeight;
        scrollEl.scrollTop += newHeight - previousHeight;
        infiniteScroll.complete();
      });
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      infiniteScroll.complete();
    }
  }

  /**
   * Scroll to bottom of content
   */
  private async scrollToBottom(): Promise<void> {
    const content = this.content();
    if (!content) return;

    // Wait for Angular + Ionic render
    await new Promise(requestAnimationFrame);

    // Wait one more frame for images / cards / fonts
    await new Promise(requestAnimationFrame);

    // Small offset ensures last message is fully visible
    await content.scrollToBottom(0);
  }

  /**
   * Check if message is from current user
   */
  isCurrentUserMessage(message: ChatMessage): boolean {
    return message.posted_by_user_id === this.currentUser()?.id;
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return this.datePipe.transform(date, 'h:mm a') || '';
  }

  getImageUrl(imageUrl: string | null | undefined): string {
    return getImageUrlOrDefault(imageUrl || '');
  }

  onImageError(event: Event): void {
    onImageError(event);
  }

  openImagePreview(imageUrl: string | null): void {
    if (!imageUrl) return;
    this.modalService.openImagePreviewModal(this.getImageUrl(imageUrl));
  }

  getMessageClasses(msg: ChatMessage): { [key: string]: boolean } {
    const isDeleted = msg.is_deleted ?? false;
    const isEditing = this.editingIndex() === msg.id;

    return {
      'bg-primary': !isDeleted && !isEditing,
      'bg-gray-200': isDeleted || isEditing,
      'text-gray-500': isDeleted,
      'text-gray-900': !isDeleted && !isEditing
    };
  }

  onLongPress(messageId: string) {
    // Toggle: if clicking the same message, close it; otherwise open it
    if (this.selectedIndex() === messageId) {
      this.selectedIndex.set(null);
    } else {
      this.selectedIndex.set(messageId);
    }
  }

  closeMenu() {
    this.selectedIndex.set(null);
  }

  async deleteMessage(messageId: string) {
    try {
      await this.messagesService.deleteMessage(messageId);
      this.selectedIndex.set(null);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  }

  async sendMessage() {
    const text = this.newMessage().trim();
    const file = this.selectedFile();
    const roomId = this.chatId();

    // Don't send if no text and no file
    if (!text && !file) return;
    if (!roomId) return;

    const editingMessageId = this.editingIndex();
    if (editingMessageId !== null) {
      if (file) {
        this.selectedFile.set(null);
      }
      try {
        await this.messagesService.updateMessage(editingMessageId, roomId, text);
        this.editingIndex.set(null);
        this.newMessage.set('');
      } catch (error) {
        console.error('Error updating message:', error);
      }
      return;
    }

    // Clear input and file immediately for better UX
    const messageText = text;
    const messageFile = file;
    this.newMessage.set('');
    this.selectedFile.set(null);

    try {
      if (messageFile) {
        await this.messagesService.sendMessageWithFile(roomId, messageText, messageFile);
      } else {
        await this.messagesService.sendMessage(roomId, messageText);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.newMessage.set(messageText);
      if (messageFile) {
        this.selectedFile.set(messageFile);
      }
    }
  }

  openFilePicker() {
    this.fileInput()?.nativeElement.click();
  }

  onBrowseFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.selectedFile.set(file);
    input.value = '';
  }

  openEmojiPicker() {
    this.showEmojiPicker.update((value) => !value);
  }

  onEmojiSelect(event: any) {
    const emoji = event.emoji?.native || '';
    if (emoji) {
      const currentMessage = this.newMessage();
      this.newMessage.set(currentMessage + emoji);
    }
  }

  onMessageInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.newMessage.set(value);
  }

  removeSelectedFile() {
    this.selectedFile.set(null);
  }

  editMessage(messageId: string) {
    const message = this.messages().find((m) => m.id === messageId);
    if (message) {
      this.editingIndex.set(messageId);
      this.newMessage.set(message.message);
      this.selectedIndex.set(null);
    }
  }

  revertEditMode(): void {
    if (this.editingIndex() !== null) {
      this.editingIndex.set(null);
      this.newMessage.set('');
    }
  }

  handleBack() {
    this.navCtrl.back();
  }

  openChatInfo() {
    const room = this.chatRoom();
    const roomId = this.chatId();
    if (roomId) {
      if (!room.is_personal) {
        this.navigationService.navigateForward('/chat-info', false, {
          roomId: roomId,
          chatRoom: room,
          from: 'chat-room'
        });
      } else {
        this.navigationService.navigateForward(`/${this.otherUser()?.username}`);
      }
    }
  }

  navigateToNetwork() {
    const room = this.chatRoom();
    this.navCtrl.navigateForward(`/event/questionnaire-response/${room.event_id}`);
  }

  /**
   * Render message text with clickable links (internal and external)
   */
  renderMessageText(text: string): SafeHtml {
    if (!text) return '';

    const frontendUrl = environment.frontendUrl;

    let modifiedText = text;
    const processedUrls = new Set<string>();

    // Pattern to match all URLs
    const urlRegex = /(https?:\/\/[^\s<]+)/gi;

    modifiedText = modifiedText.replace(urlRegex, (url) => {
      // Skip if already processed
      if (processedUrls.has(url.toLowerCase())) {
        return url;
      }
      processedUrls.add(url.toLowerCase());

      // Check if it's an internal link (starts with frontendUrl)
      if (url.toLowerCase().startsWith(frontendUrl.toLowerCase())) {
        // Extract the path after the domain
        const path = url.substring(frontendUrl.length);
        return `<a href="#" class="internal-link" data-path="${path}" style="color:#1a73e8; text-decoration:underline; cursor:pointer;">${url}</a>`;
      } else {
        // External link - open in new tab
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#1a73e8; text-decoration:underline;">${url}</a>`;
      }
    });

    return this.sanitizer.bypassSecurityTrustHtml(modifiedText);
  }

  onProfileLinkClick(event: Event): void {
    const target = event.target as HTMLElement;

    const internalLink = target.closest('.internal-link') as HTMLElement;
    if (!internalLink) return;

    event.preventDefault();
    event.stopPropagation();
    this.hapticService.onClick();
    const path = internalLink.getAttribute('data-path');

    if (path) {
      this.navigationService.navigateForward(path);
    }
  }

  /**
   * Web: Enter = send, Shift+Enter = new line.
   * Native: Enter = new line (default), send via button.
   */
  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    if (Capacitor.isNativePlatform()) return;
    if (event.shiftKey) return;
    event.preventDefault();
    this.hapticService.onClick();
    this.sendMessage();
  }
}
