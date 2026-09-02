import { apiClient } from './client';

export interface UserProfile {
  username: string;
  email: string;
  peliculasVistas: number;
  peliculasGuardadas: number;
  resenasConComentario: number;
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/api/users/me');
  return response.data;
}

export async function logoutFromServer(): Promise<void> {
  await apiClient.post('/api/auth/logout');
}
