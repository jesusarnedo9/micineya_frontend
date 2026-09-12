import { apiClient } from './client';
import { mediaTypeOf, type MediaType, type Movie } from '../types/movie';
import type { ProfileReview } from '../types/profile';

interface ReviewResponse {
  mediaType?: MediaType;
  temporadasVistas?: number[];
  numeroTemporada?: number;
  serieCompleta?: boolean;
  fechaVista?: string;
  id: number;
  tmdbId: number;
  titulo: string;
  posterPath: string | null;
  calificacion: number;
  comentario: string | null;
  fechaActualizacion: string | null;
  spoiler?: boolean;
  ocultadaModeracion?: boolean;
}

function mapReview(review: ReviewResponse): ProfileReview {
  return {
    mediaType: review.mediaType ?? 'movie',
    seasonsWatched: review.temporadasVistas ?? [],
    seasonNumber: review.numeroTemporada ?? (review.temporadasVistas?.length === 1 ? review.temporadasVistas[0] : undefined),
    seriesComplete: review.serieCompleta ?? false,
    watchedAt: review.fechaVista ?? review.fechaActualizacion ?? '',
    id: review.id,
    tmdbId: review.tmdbId,
    title: review.titulo,
    posterPath: review.posterPath,
    rating: review.calificacion,
    comment: review.comentario ?? '',
    reviewedAt: review.fechaActualizacion ?? '',
    spoiler: review.spoiler ?? false,
    hiddenByModeration: review.ocultadaModeracion ?? false,
  };
}

export async function submitReview(
  movie: Movie,
  rating: number,
  comment: string,
  spoiler = false,
  seasonsWatched: number[] = [],
): Promise<ProfileReview> {
  const response = await apiClient.post<ReviewResponse>('/api/biblioteca/resenas', {
    mediaType: mediaTypeOf(movie),
    temporadasVistas: seasonsWatched,
    tmdbId: movie.id,
    titulo: movie.title,
    posterPath: movie.poster_path,
    calificacion: rating,
    comentario: comment.trim(),
    spoiler,
  });

  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Respuesta de reseña no válida');
  }

  return mapReview(response.data);
}

export async function fetchMyReviews(): Promise<ProfileReview[]> {
  const response = await apiClient.get<ReviewResponse[]>('/api/biblioteca/resenas');
  return response.data.map(mapReview);
}

export async function deleteReview(tmdbId: number, type: MediaType = 'movie', seasonNumber?: number): Promise<void> {
  await apiClient.delete(type === 'tv' && seasonNumber
    ? `/api/biblioteca/resenas/tv/${tmdbId}/temporadas/${seasonNumber}`
    : `/api/biblioteca/resenas/${type}/${tmdbId}`);
}
