import { apiClient } from './client';
import type { Movie } from '../types/movie';
import { createProfileReview, type ProfileReview } from '../types/profile';

interface ReviewResponse {
  id: number;
  tmdbId: number;
  titulo: string;
  posterPath: string | null;
  calificacion: number;
  comentario: string | null;
  fechaActualizacion: string | null;
}

function mapReview(review: ReviewResponse): ProfileReview {
  return {
    id: review.id,
    tmdbId: review.tmdbId,
    title: review.titulo,
    posterPath: review.posterPath,
    rating: review.calificacion,
    comment: review.comentario ?? '',
    reviewedAt: review.fechaActualizacion ?? '',
  };
}

export async function submitReview(
  movie: Movie,
  rating: number,
  comment: string,
): Promise<ProfileReview> {
  const response = await apiClient.post<ReviewResponse>('/api/resenas', {
    tmdbId: movie.id,
    titulo: movie.title,
    posterPath: movie.poster_path,
    calificacion: rating,
    comentario: comment.trim(),
  });

  if (!response.data || typeof response.data !== 'object') {
    return createProfileReview(movie, rating, comment);
  }

  return mapReview(response.data);
}

export async function fetchMyReviews(): Promise<ProfileReview[]> {
  const response = await apiClient.get<ReviewResponse[]>('/api/resenas/mias');
  return response.data.map(mapReview);
}
