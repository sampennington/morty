import axios, { AxiosInstance } from 'axios';
import { EpisodeStatus, PortalRequest, PortalResponse } from './types';

const BASE_URL = 'https://challenge.sphinxhq.com';

export class MortyAPI {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async startEpisode(): Promise<EpisodeStatus> {
    const response = await this.client.post<EpisodeStatus>('/api/mortys/start/');
    return response.data;
  }

  async sendThroughPortal(planet: 0 | 1 | 2, mortyCount: 1 | 2 | 3): Promise<PortalResponse> {
    const request: PortalRequest = {
      planet,
      morty_count: mortyCount
    };
    const response = await this.client.post<PortalResponse>('/api/mortys/portal/', request);
    return response.data;
  }

  async getStatus(): Promise<EpisodeStatus> {
    const response = await this.client.get<EpisodeStatus>('/api/mortys/status/');
    return response.data;
  }

  static async requestToken(name: string, email: string): Promise<void> {
    await axios.post(`${BASE_URL}/api/auth/request-token/`, {
      name,
      email
    });
  }
}
