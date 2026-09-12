import { apiClient } from './client';
import { contentKey, mediaTypeOf, type MediaType, type Movie, type MoviePage, type MovieResponse } from '../types/movie';

export interface FavoriteMovie {
  mediaType?: MediaType;
  id?: number;
  tmdbId: number;
  titulo: string;
  posterPath: string | null;
}

export async function fetchMovies(endpoint: string): Promise<Movie[]> {
  return (await fetchMoviePage(endpoint, 1)).movies;
}

export async function searchContent(query: string, type: MediaType, signal?: AbortSignal): Promise<Movie[]> {
  const response = await apiClient.get<MovieResponse>(
    `/api/${type === 'tv' ? 'series' : 'peliculas'}/buscar`, {
    params: { query: query.trim() },
    signal,
  });
  return (response.data.results ?? []).slice(0, 5).map((movie) => ({ ...movie, mediaType: type }));
}

export async function fetchContentPlatforms(movie: Movie, signal?: AbortSignal): Promise<string[]> {
  const type = mediaTypeOf(movie);
  const response = await apiClient.get<string[]>(
    `/api/${type === 'tv' ? 'series' : 'peliculas'}/${movie.id}/plataformas`, { signal });
  return response.data ?? [];
}

export async function fetchMoviePage(endpoint: string, page: number): Promise<MoviePage> {
  const response = await apiClient.get<MovieResponse | Movie[]>(endpoint, {
    params: { page },
  });
  const payload = response.data;
  const movies = Array.isArray(payload) ? payload : (payload.results ?? []);

  return {
    movies: Array.from(new Map(movies.map((movie) => [contentKey(movie), movie])).values()),
    page: Array.isArray(payload) ? page : (payload.page ?? page),
    totalPages: Array.isArray(payload) ? null : (payload.total_pages ?? null),
  };
}

export async function saveFavorite(movie: Movie): Promise<void> {
  await apiClient.post('/api/biblioteca/favoritas', {
    mediaType: mediaTypeOf(movie),
    tmdbId: movie.id,
    titulo: movie.title,
    posterPath: movie.poster_path,
  });
}

export async function removeFavorite(tmdbId: number, type: MediaType = 'movie'): Promise<void> {
  await apiClient.delete(`/api/biblioteca/favoritas/${type}/${tmdbId}`);
}

export async function fetchFavorites(): Promise<FavoriteMovie[]> {
  const response = await apiClient.get<FavoriteMovie[]>('/api/biblioteca/favoritas');
  return response.data;
}

export interface RecommendationBatch { movies: Movie[]; notice: string | null }

function recommendationBatch(data: MovieResponse): RecommendationBatch {
  const ignored = data.generosSinEquivalencia ?? [];
  return { movies: data.results ?? [], notice: ignored.length > 0
    ? `En series, No encontramos una categoría equivalente para: ${ignored.join(', ')}. Podés ajustar tus gustos desde Mi perfil.` : null };
}

export async function fetchRecommendationBatch(type: MediaType): Promise<RecommendationBatch> {
  return recommendationBatch((await apiClient.get<MovieResponse>(recommendationsEndpoint(type))).data);
}

export async function renewMovies(actualesIds: number[], type: MediaType = 'movie'): Promise<RecommendationBatch> {
  const response = await apiClient.post<MovieResponse>(`${recommendationsEndpoint(type)}/renovar`, {
    actualesIds,
  });
  return recommendationBatch(response.data);
}

export function recommendationsEndpoint(type: MediaType): string {
  return `/api/${type === 'tv' ? 'series' : 'peliculas'}/recomendadas`;
}

export async function dismissMovie(tmdbId: number, type: MediaType = 'movie'): Promise<void> {
  await apiClient.put(`/api/${type === 'tv' ? 'series' : 'peliculas'}/descartadas/${tmdbId}`);
}

export async function undoMovieDismissal(tmdbId: number, type: MediaType = 'movie'): Promise<void> {
  await apiClient.delete(`/api/${type === 'tv' ? 'series' : 'peliculas'}/descartadas/${tmdbId}`);
}
