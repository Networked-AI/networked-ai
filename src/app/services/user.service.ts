import { of, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { map, catchError } from 'rxjs/operators';
import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from '@/services/base-api.service';
import { IUser, VibeItem, IUserResponse, UserSearchResponse, UserSearchApiResponse } from '@/interfaces/IUser';
import { UserGamificationResponse, LeaderboardResponse } from '@/interfaces/IGamification';
import { ProfileSubscription } from '../interfaces/IUser';

@Injectable({ providedIn: 'root' })
export class UserService extends BaseApiService {
  // services
  private authService = inject(AuthService);

  // split name into first_name and last_name
  private splitName(name?: string): { first_name: string; last_name: string } {
    if (!name) return { first_name: '', last_name: '' };

    const nameParts = name.split(' ');
    return {
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' ') || ''
    };
  }

  // combine first_name and last_name into name
  private combineName(first_name?: string | null, last_name?: string | null): string {
    const parts = [first_name, last_name].filter(Boolean);
    return parts.join(' ').trim();
  }

  getUserFromApiResponse(user: IUser): Record<string, any> {
    const { name, ...userWithoutName } = user;
    const { first_name, last_name } = this.splitName(name);

    const payload: Record<string, any> = {};

    Object.entries(userWithoutName).forEach(([key, value]) => {
      if (value !== undefined) {
        payload[key] = value ?? null;
      }
    });

    payload['last_name'] = last_name || null;
    payload['first_name'] = first_name || null;

    return payload;
  }

  async deleteAccount(): Promise<void> {
    const currentUser = this.authService.currentUser();
    if (!currentUser?.id) {
      throw new Error('No user logged in');
    }
    await this.delete(`/users/${currentUser.id}`);
  }

  generateUserPayload(payload: Record<string, any> & { first_name?: string | null; last_name?: string | null }): Partial<IUser> {
    const { first_name, last_name, ...user } = payload;

    // Filter out null, undefined, and empty string values
    const filteredUser: Partial<IUser> = {};
    Object.entries(user).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        filteredUser[key as keyof IUser] = value;
      }
    });

    // Add name if it can be combined from first_name and last_name
    const name = this.combineName(first_name, last_name);
    if (name) {
      filteredUser.name = name;
    }

    return filteredUser;
  }

  async getCurrentUser(force = false): Promise<IUser> {
    const currentUser = this.authService.currentUser();

    // if no current user exists, throw error
    if (!currentUser?.id) {
      throw new Error('No active user account found.');
    }

    // fetch user data if forced
    if (force) {
      try {
        const user = await this.getUser(currentUser.id);

        // merge fetched user data with existing token to preserve authentication
        const updatedUser = { ...user, token: currentUser.token };

        // update localStorage and signals
        this.authService.setActiveAccount(updatedUser);

        return user;
      } catch (error) {
        console.error('Error fetching current user:', error);
        throw error;
      }
    }

    // return existing user data
    return currentUser;
  }

  async getUser(idOrUsername: string): Promise<IUser> {
    try {
      const response = await this.get<IUserResponse>(`/users/${encodeURIComponent(idOrUsername)}`);
      if (response?.data?.user) {
        return response.data.user;
      }
      throw new Error('User not found');
    } catch (error) {
      console.error('Error fetching user by ID or username:', error);
      throw error;
    }
  }

  async updateCurrentUser(payload: Partial<IUser>): Promise<IUserResponse> {
    const response = await this.put<IUserResponse>(`/users`, payload);
    await this.getCurrentUser(true);
    return response;
  }

  // update preferences (vibes, interests, hobbies) while preserving all other user data
  async updatePreferences(vibes: string[], interests: string[], hobbies: string[]): Promise<IUserResponse> {
    // get current user data to preserve all existing fields
    const currentUser = await this.getCurrentUser();

    // convert user data to payload format and merge with new preferences
    const payload = this.generateUserPayload(currentUser);

    // update with new preferences
    payload['vibe_ids'] = vibes;
    payload['hobby_ids'] = hobbies;
    payload['interest_ids'] = interests;

    return await this.updateCurrentUser(payload);
  }

  // check email, username, phone availability
  checkAvailability(value: string): Observable<boolean> {
    if (!value) {
      return of(false); // default to false (unavailable)
    }

    return this.getObservable<boolean>(`/users/check?value=${encodeURIComponent(value)}`).pipe(
      map((response) => !response), // API returns false if available, true if taken
      catchError((error) => {
        console.error('Error checking availability:', error);
        return of(false); // default to false (unavailable) on error
      })
    );
  }

  // get vibes
  async getVibes(): Promise<VibeItem[]> {
    try {
      const response = await this.get<{ data?: VibeItem[] }>('/vibe');
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching vibes:', error);
      throw error;
    }
  }

  // get hobbies
  async getHobbies(): Promise<VibeItem[]> {
    try {
      const response = await this.get<{ data?: VibeItem[] }>('/hobbies');
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching hobbies:', error);
      throw error;
    }
  }

  // get interests
  async getInterests(): Promise<VibeItem[]> {
    try {
      const response = await this.get<{ data?: VibeItem[] }>('/interests');
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching interests:', error);
      throw error;
    }
  }

  // search users
  async searchUsers(value: string, page: number = 1, limit: number = 10): Promise<UserSearchResponse> {
    try {
      let params = new HttpParams();

      if (value && value.trim()) {
        params = params.set('value', value.trim());
      }
      if (page) {
        params = params.set('page', page.toString());
      }
      if (limit) {
        params = params.set('limit', limit.toString());
      }

      const response = await this.get<UserSearchApiResponse>('/users/search/', { params });

      const users = response?.data?.data || [];
      const pagination = response?.data?.pagination || { totalCount: 0, currentPage: 1, totalPages: 0 };

      return { users, pagination };
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  // Get user gamification badges
  async getUserGamificationBadges(userId?: string): Promise<UserGamificationResponse> {
    try {
      const url = `/gamification/user/${userId}`;
      const response = await this.get<UserGamificationResponse>(url);
      return response;
    } catch (error) {
      console.error('Error fetching user gamification badges:', error);
      throw error;
    }
  }

  // Get leaderboard
  async getLeaderboard(): Promise<LeaderboardResponse> {
    try {
      const response = await this.get<LeaderboardResponse>('/gamification/leaderboard');
      return response;
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  }

  // Update FCM token and location
  async updateFcmTokenAndLocation(fcmToken: string | null, latitude?: string, longitude?: string): Promise<void> {
    try {
      const payload: {
        latitude?: string;
        longitude?: string;
        fcm_token: string | null;
      } = {
        fcm_token: fcmToken || null
      };

      if (latitude && longitude) {
        payload.latitude = latitude;
        payload.longitude = longitude;
      }

      await this.put('/users/fcm-token-location', payload);
    } catch (error) {
      console.error('Error updating FCM token and location:', error);
    }
  }

  // search users
  async paymentHistory(page: number = 1, limit: number = 20): Promise<any> {
    try {
      let params = new HttpParams();
      if (page) {
        params = params.set('page', page.toString());
      }
      if (limit) {
        params = params.set('limit', limit.toString());
      }

      const response = await this.get<UserSearchApiResponse>('/transaction', { params });

      return response.data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  async blockUser(peerId: string): Promise<any> {
    try {
      const response = await this.post<any>(`/blocked-users/${peerId}`);
      return response;
    } catch (error) {
      console.error('Error blocking user:', error);
      throw error;
    }
  }

  async updateProfileSubscription(userId: string, preferences: ProfileSubscription): Promise<{ success: boolean; message: string; data: ProfileSubscription }> {
    return await this.put<{ success: boolean; message: string; data: ProfileSubscription }>(`/users/${userId}/profile-subscription`, preferences);
  }
}
