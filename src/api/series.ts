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

// Read-only metadata for saved posters. Short-lived, bounded and shared across visits.
const seasonCache = new Map<number, { expires: number; seasons: Season[] }>();
const pendingSeasons = new Map<number, Promise<Season[]>>();
export async function fetchCachedSeasons(tmdbId: number): Promise<Season[]> {
  const cached = seasonCache.get(tmdbId);
  if (cached && cached.expires > Date.now()) return cached.seasons;
  const pending = pendingSeasons.get(tmdbId);
  if (pending) return pending;
  const request = fetchSeasons(tmdbId).then((seasons) => {
    if (seasonCache.size >= 100) seasonCache.delete(seasonCache.keys().next().value!);
    seasonCache.set(tmdbId, { seasons, expires: Date.now() + 15 * 60 * 1000 });
    return seasons;
  }).finally(() => { pendingSeasons.delete(tmdbId); });
  pendingSeasons.set(tmdbId, request);
  return request;
}
