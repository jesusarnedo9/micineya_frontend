import { apiClient } from './client';

export interface Season {
  numero: number;
  nombre: string;
  cantidadEpisodios: number | null;
  estreno: string | null;
}

export async function fetchSeasons(tmdbId: number): Promise<Season[]> {
  const response = await apiClient.get<{ temporadas: Season[] }>(`/api/series/${tmdbId}/temporadas`);
  return response.data.temporadas;
}
