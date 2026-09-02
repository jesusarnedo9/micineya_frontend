import { apiClient } from './client';

export interface CatalogOption {
  id: number;
  nombre: string;
}

export interface OnboardingStatus {
  pais: string;
  plataformaIds: number[];
  generoIds: number[];
  completed: boolean;
}

export async function fetchPlatforms(): Promise<CatalogOption[]> {
  const response = await apiClient.get<CatalogOption[]>('/api/catalogos/plataformas');
  return response.data;
}

export async function fetchGenres(): Promise<CatalogOption[]> {
  const response = await apiClient.get<CatalogOption[]>('/api/catalogos/generos');
  return response.data;
}

export async function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  const response = await apiClient.get<OnboardingStatus>('/api/users/onboarding');
  return response.data;
}

export async function saveOnboarding(
  plataformaIds: number[],
  generoIds: number[],
): Promise<void> {
  await apiClient.post('/api/users/onboarding', {
    plataformaIds,
    generoIds,
  });
}
