import { Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { BaseApiService } from '@/services/base-api.service';
import { NetworkConnectionsApiResponse, NetworkConnection, NetworkConnectionsData, IUser } from '@/interfaces/IUser';

@Injectable({ providedIn: 'root' })
export class NetworkService extends BaseApiService {
  async getNetworkRequests(
    params: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<NetworkConnectionsData> {
    try {
      let httpParams = new HttpParams();

      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }

      const response = await this.get<NetworkConnectionsApiResponse>('/network-connections/requests', { params: httpParams });

      const data = response?.data?.data || [];
      const pagination = response?.data?.pagination || { totalCount: 0, currentPage: 1, totalPages: 0 };

      return { data, pagination };
    } catch (error) {
      console.error('Error fetching network requests:', error);
      throw error;
    }
  }

  // Get my network connections
  async getMyConnections(
    params: {
      page?: number;
      limit?: number;
      search?: string;
      latitude?: string;
      longitude?: string;
      radius?: number;
      userId?: string;
    } = {}
  ): Promise<NetworkConnectionsData> {
    try {
      let httpParams = new HttpParams();

      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }
      if (params.search && params.search.trim()) {
        httpParams = httpParams.set('search', params.search.trim());
      }
      if (params.latitude && params.latitude.trim()) {
        httpParams = httpParams.set('latitude', params.latitude.trim());
      }
      if (params.longitude && params.longitude.trim()) {
        httpParams = httpParams.set('longitude', params.longitude.trim());
      }
      if (params.radius !== undefined && params.radius !== null) {
        httpParams = httpParams.set('radius', params.radius.toString());
      }
      if (params.userId && params.userId.trim()) {
        httpParams = httpParams.set('userId', params.userId.trim());
      }

      const response = await this.get<NetworkConnectionsApiResponse>('/network-connections/connections', { params: httpParams });

      const data = response?.data?.data || [];
      const pagination = response?.data?.pagination || { totalCount: 0, currentPage: 1, totalPages: 0 };

      return { data, pagination };
    } catch (error) {
      console.error('Error fetching network connections:', error);
      throw error;
    }
  }

  // Send network connection request
  async sendNetworkRequest(peerUserId: string): Promise<any> {
    try {
      const response = await this.post('/network-connections/send', { peer_user_id: peerUserId });
      return response;
    } catch (error) {
      console.error('Error sending network request:', error);
      throw error;
    }
  }

  // Accept network connection request
  async acceptNetworkRequest(peerUserId: string): Promise<any> {
    try {
      const response = await this.put('/network-connections/accept', { peer_user_id: peerUserId });
      return response;
    } catch (error) {
      console.error('Error accepting network request:', error);
      throw error;
    }
  }

  // Reject network connection request
  async rejectNetworkRequest(peerUserId: string): Promise<any> {
    try {
      const response = await this.put('/network-connections/reject', { peer_user_id: peerUserId });
      return response;
    } catch (error) {
      console.error('Error rejecting network request:', error);
      throw error;
    }
  }

  // Cancel network connection request
  async cancelNetworkRequest(peerUserId: string): Promise<any> {
    try {
      const response = await this.put('/network-connections/cancel', { peer_user_id: peerUserId });
      return response;
    } catch (error) {
      console.error('Error cancelling network request:', error);
      throw error;
    }
  }

  // Remove network connection
  async removeNetworkConnection(peerUserId: string): Promise<any> {
    try {
      const response = await this.put('/network-connections/remove', { peer_user_id: peerUserId });
      return response;
    } catch (error) {
      console.error('Error removing network connection:', error);
      throw error;
    }
  }

  // Get network connection recommendations (people you might know)
  async getNetworkRecommendations(limit: number): Promise<IUser[]> {
    try {
      let httpParams = new HttpParams();
      if (limit) {
        httpParams = httpParams.set('limit', limit);
      }
      const response = await this.get<{ success: boolean; message: string; data: IUser[] }>('/network-connections/recommendations', {
        params: httpParams
      });
      return response?.data || [];
    } catch (error) {
      console.error('Error fetching network recommendations:', error);
      throw error;
    }
  }

  // Get networks within radius
  async getNetworksWithinRadius(params: { radius: number; latitude?: string; longitude?: string }): Promise<{ data: IUser[]; message: string }> {
    try {
      let httpParams = new HttpParams();

      httpParams = httpParams.set('radius', params.radius.toString());

      if (params.latitude && params.latitude.trim()) {
        httpParams = httpParams.set('latitude', params.latitude.trim());
      }
      if (params.longitude && params.longitude.trim()) {
        httpParams = httpParams.set('longitude', params.longitude.trim());
      }

      const response = await this.get<{ success: boolean; message: string; data: IUser[] }>('/network-connections/networks-within-radius', {
        params: httpParams
      });
      return { data: response?.data || [], message: response?.message || '' };
    } catch (error) {
      console.error('Error fetching networks within radius:', error);
      throw error;
    }
  }
}
