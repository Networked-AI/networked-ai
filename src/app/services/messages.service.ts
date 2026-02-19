import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from '@/services/base-api.service';
import { ChatRoomsResponse, ChatRoom, ChatRoomsPagination, MessagesResponse, ChatMessage } from '@/interfaces/IChat';
import { AuthService } from '@/services/auth.service';

@Injectable({ providedIn: 'root' })
export class MessagesService extends BaseApiService {
  private authService = inject(AuthService);

  // Signal to store chat rooms
  chatRooms = signal<ChatRoom[]>([]);
  isLoading = signal<boolean>(false);
  unreadCount = signal<number>(0);
  pagination = signal<ChatRoomsPagination>({
    totalCount: 0,
    currentPage: 1,
    totalPages: 1
  });

  currentPage = signal<number>(1);
  currentSearch = signal<string>('');

  private currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  constructor() {
    super();
    effect(() => {
      const currentUserId = this.currentUserId();
      if (currentUserId) {
        this.fetchUnreadCount();
      } else {
        this.unreadCount.set(0);
      }
    });
  }

  /**
   * Get chat rooms for the current user with pagination, search, and filter
   */
  async getChatRooms(
    params: {
      page?: number;
      limit?: number;
      search?: string; // when provided as '' it clears search
      filter?: 'all' | 'unread' | 'group' | 'event' | 'network';
      append?: boolean;
      skipClear?: boolean;
    } = {}
  ): Promise<{ rooms: ChatRoom[]; pagination: ChatRoomsPagination }> {
    try {
      if (!params.append && !params.skipClear) this.chatRooms.set([]);
      this.isLoading.set(true);
      const currentUser = this.authService.currentUser();
      if (!currentUser?.id) {
        throw new Error('User not logged in');
      }

      const page = params.page ?? this.currentPage();
      const limit = params.limit ?? 15;
      const hasSearchParam = Object.prototype.hasOwnProperty.call(params, 'search');
      const search = hasSearchParam ? (params.search ?? '') : this.currentSearch();
      const filter = params.filter ?? 'all';

      let httpParams = new HttpParams().set('page', page.toString()).set('limit', limit.toString()).set('filter', filter);

      if (search.trim()) {
        httpParams = httpParams.set('search', search);
      }

      const response = await this.get<ChatRoomsResponse>(`/chat-rooms/${currentUser.id}/rooms`, {
        params: httpParams
      });

      const rooms = response?.data?.data || [];
      const pagination = response?.data?.pagination || {
        totalCount: 0,
        currentPage: page,
        totalPages: 1
      };

      // Filter out deleted rooms
      const activeRooms = rooms.filter((room) => !room.is_deleted);

      if (params.append) {
        // Append to existing rooms
        this.chatRooms.update((current) => [...current, ...activeRooms]);
      } else {
        // Replace existing rooms
        this.chatRooms.set(activeRooms);
      }

      this.pagination.set(pagination);
      this.currentPage.set(pagination.currentPage);
      if (hasSearchParam) {
        this.currentSearch.set(search);
      }

      return { rooms: activeRooms, pagination };
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
      if (!params.append) {
        this.chatRooms.set([]);
      }
      throw error;
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Reset pagination and reload from page 1
   */
  async resetAndLoad(search?: string, filter?: 'all' | 'unread' | 'group' | 'event' | 'network'): Promise<void> {
    this.currentPage.set(1);
    // If search is undefined, we still pass it as '' to explicitly clear server-side search
    await this.getChatRooms({ page: 1, search: search ?? '', filter: filter || 'all', append: false });
  }

  async fetchUnreadCount(): Promise<void> {
    try {
      const response = await this.get<{ data: { count: number; by_room?: { room_id: string; unread_count: number }[] } }>('/chat-rooms/unread-count');
      this.unreadCount.set(response?.data?.count ?? 0);
    } catch (error) {
      console.error('Error fetching unread message count:', error);
    }
  }

  /**
   * Get messages for a specific chat room with pagination
   */
  async getMessagesByRoomId(
    roomId: string,
    params: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ messages: ChatMessage[]; pagination: ChatRoomsPagination }> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 15;

      let httpParams = new HttpParams().set('page', page.toString()).set('limit', limit.toString());

      const response = await this.get<MessagesResponse>(`/messages/by-room/${roomId}`, {
        params: httpParams
      });

      const messages = response?.data?.data || [];
      const pagination = response?.data?.pagination || {
        totalCount: 0,
        currentPage: page,
        totalPages: 1
      };

      return { messages, pagination };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Create or get existing chat room
   */
  async createOrGetChatRoom(params: {
    user_ids?: string[];
    name?: string | null;
    is_personal?: boolean;
    event_id?: string | null;
    event_image?: string | null;
    profile_image?: string | null;
  }): Promise<{ room_id: string; room?: ChatRoom; message?: string }> {
    try {
      const payload: {
        user_ids?: string[];
        name?: string | null;
        is_personal?: boolean;
        event_id?: string | null;
        event_image?: string | null;
        profile_image?: string | null;
      } = {
        user_ids: params.user_ids,
        is_personal: params.is_personal ?? true
      };

      if (params.name !== undefined) {
        payload.name = params.name;
      }

      if (params.event_id !== undefined) {
        payload.event_id = params.event_id;
      }

      if (params.event_image !== undefined) {
        payload.event_image = params.event_image;
      }

      if (params.profile_image !== undefined) {
        payload.profile_image = params.profile_image;
      }

      const response = await this.post<{
        success: boolean;
        message: string;
        data: any;
      }>('/chat-rooms/', payload);

      return {
        room_id: response.data.id || response.data.room_id,
        room: response.data,
        message: response.message
      };
    } catch (error) {
      console.error('Error creating/getting chat room:', error);
      throw error;
    }
  }

  /**
   * Get chat room by ID
   */
  async getChatRoomById(roomId: string): Promise<ChatRoom> {
    try {
      const response = await this.get<{ success: boolean; message: string; data: ChatRoom }>(`/chat-rooms/${roomId}`);

      return response.data;
    } catch (error) {
      console.error('Error fetching chat room:', error);
      throw error;
    }
  }

  /**
   * Send/create a message in a chat room
   */
  async sendMessage(
    roomId: string,
    message: string,
    postId?: string,
    eventId?: string,
    isBroadcastEmail = false
  ): Promise<{ message: ChatMessage }> {
    try {
      const payload: {
        message: string;
        room_id: string;
        post_id?: string;
        event_id?: string;
        is_broadcast_email?: boolean;
      } = {
        message,
        room_id: roomId
      };

      if (postId) {
        payload.post_id = postId;
      }

      if (eventId) {
        payload.event_id = eventId;
      }
      if (isBroadcastEmail) {
        payload.is_broadcast_email = true;
      }

      const response = await this.post<{ success: boolean; message: string; data: { message: ChatMessage; media: any } }>('/messages/', payload);

      return { message: response.data.message };
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  /**
   * Send/create a message with file attachment in a chat room
   */
  async sendMessageWithFile(roomId: string, message: string, file: File, isBroadcastEmail = false): Promise<{ message: ChatMessage }> {
    try {
      const payload: {
        message?: string;
        room_id: string;
        file: File;
        is_broadcast_email?: boolean;
      } = {
        room_id: roomId,
        file: file
      };

      if (message && message.trim()) {
        payload.message = message.trim();
      }
      if (isBroadcastEmail) {
        payload.is_broadcast_email = true;
      }

      const response = await this.postFormData<{ success: boolean; message: string; data: { message: ChatMessage; media: any } }>(
        '/messages/',
        payload
      );

      return { message: response.data.message };
    } catch (error) {
      console.error('Error sending message with file:', error);
      throw error;
    }
  }

  /**
   * Update/edit a message in a chat room
   */
  async updateMessage(messageId: string, roomId: string, message: string): Promise<ChatMessage> {
    try {
      const payload = {
        message_id: messageId,
        room_id: roomId,
        message: message
      };

      const response = await this.put<{ success: boolean; message: string; data: { message: ChatMessage } }>('/messages/', payload);

      return response.data.message;
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  }

  /**
   * Delete a message from a chat room
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.delete(`/messages/${messageId}`);
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  }

  applyRoomCreated(room: ChatRoom): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.id) return;

    const existingRoom = this.chatRooms().find((r) => r.id === room.id);
    if (existingRoom) {
      this.applyRoomUpdated(room);
      return;
    }
    this.chatRooms.update((current) => {
      const updated = [room, ...current];
      return this.sortChatRoomsByLastMessage(updated);
    });
  }

  applyRoomUpdated(room: ChatRoom): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.id) return;

    const isUserInRoom = room.user_ids?.includes(currentUser.id) || false;

    this.chatRooms.update((current) => {
      const roomIndex = current.findIndex((r) => r.id === room.id);

      // if (roomIndex === -1) {
      //   if (isUserInRoom) {
      //     const updated = [room, ...current];
      //     return this.sortChatRoomsByLastMessage(updated);
      //   }
      //   return current;
      // }

      if (!isUserInRoom) {
        return current.filter((r) => r.id !== room.id);
      }

      const updated = [...current];
      updated[roomIndex] = room;
      return this.sortChatRoomsByLastMessage(updated);
    });
  }

  async markRoomAsRead(roomId: string): Promise<void> {
    try {
      await this.put(`/messages/mark-read/${roomId}`, {});
    } catch (error) {
      console.error('Error marking room as read:', error);
    }
  }

  async updateRoom(roomId: string, payload: any): Promise<void> {
    try {
      await this.put(`/chat-rooms/${roomId}`, payload);
    } catch (error) {
      console.error('Error updating room:', error);
      throw error;
    }
  }

  /**
   * Join users to an existing chat room
   */
  async joinRoom(chatRoomId: string, userIds: string[]): Promise<void> {
    try {
      const payload = {
        chat_room_id: chatRoomId,
        user_ids: userIds
      };
      await this.put<{ success: boolean; message: string }>('/chat-rooms/join', payload);
    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }

  /**
   * Leave a chat room (remove user from room)
   */
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      await this.delete<{ success: boolean; message: string }>(`/chat-rooms/${roomId}/user/${userId}`);
    } catch (error) {
      console.error('Error leaving room:', error);
      throw error;
    }
  }

  private sortChatRoomsByLastMessage(rooms: ChatRoom[]): ChatRoom[] {
    return [...rooms].sort((a, b) => {
      const timeA = a.lastMessageTime || a.created_at;
      const timeB = b.lastMessageTime || b.created_at;

      const dateA = new Date(timeA).getTime();
      const dateB = new Date(timeB).getTime();

      return dateB - dateA;
    });
  }

  async shareInChat(payload: {
    event_id?: string;
    peer_ids?: string[];
    send_entire_network?: boolean;
    type?: string;
    feed_id?: string;
    message?: string;
  }): Promise<any> {
    try {
      const response = await this.post<any>('/chat-rooms/share', payload);
      return response;
    } catch (error) {
      console.error('Error sharing feed:', error);
      throw error;
    }
  }
}
