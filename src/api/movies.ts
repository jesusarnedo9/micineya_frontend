import { apiClient } from './client';
import type { Movie, MoviePage, MovieResponse } from '../types/movie';

export interface FavoriteMovie {
  id?: number;
  tmdbId: number;
  titulo: string;
  posterPath: string | null;
}

export async function fetchMovies(endpoint: string): Promise<Movie[]> {
  return (await fetchMoviePage(endpoint, 1)).movies;
}

export async function fetchMoviePage(endpoint: string, page: number): Promise<MoviePage> {
  const response = await apiClient.get<MovieResponse | Movie[]>(endpoint, {
    params: { page },
  });
  const payload = response.data;
  const movies = Array.isArray(payload) ? payload : (payload.results ?? []);

  return {
    movies: Array.from(new Map(movies.map((movie) => [movie.id, movie])).values()),
    page: Array.isArray(payload) ? page : (payload.page ?? page),
    totalPages: Array.isArray(payload) ? null : (payload.total_pages ?? null),
  };
}

export async function saveFavorite(movie: Movie): Promise<void> {
  await apiClient.post('/api/users/favoritas', {
    tmdbId: movie.id,
    titulo: movie.title,
    posterPath: movie.poster_path,
  });
}

export async function removeFavorite(tmdbId: number): Promise<void> {
  await apiClient.delete(`/api/users/favoritas/${tmdbId}`);
}

export async function fetchFavorites(): Promise<FavoriteMovie[]> {
  const response = await apiClient.get<FavoriteMovie[]>('/api/users/favoritas');
  return response.data;
}

export async function renewMovies(actualesIds: number[]): Promise<Movie[]> {
  const response = await apiClient.post<MovieResponse>('/api/peliculas/recomendadas/renovar', {
    actualesIds,
  });
  return response.data.results ?? [];
}

export async function dismissMovie(tmdbId: number): Promise<void> {
  await apiClient.put(`/api/peliculas/descartadas/${tmdbId}`);
}

export async function undoMovieDismissal(tmdbId: number): Promise<void> {
  await apiClient.delete(`/api/peliculas/descartadas/${tmdbId}`);
}
