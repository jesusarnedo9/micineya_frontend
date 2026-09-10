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

export async function fetchProfilePhoto(): Promise<string | null> {
  const response = await apiClient.get<{ dataUri: string | null }>('/api/users/me/foto');
  return response.data.dataUri;
}

export async function saveProfilePhoto(base64: string): Promise<string | null> {
  const response = await apiClient.put<{ dataUri: string | null }>('/api/users/me/foto', { base64 });
  return response.data.dataUri;
}

export async function removeProfilePhoto(): Promise<void> {
  await apiClient.delete('/api/users/me/foto');
}

export async function changePassword(passwordActual: string, passwordNueva: string): Promise<void> {
  await apiClient.put('/api/users/me/password', { passwordActual, passwordNueva });
}

export async function deleteAccount(passwordActual: string): Promise<void> {
  await apiClient.delete('/api/users/me', { data: { passwordActual } });
}
