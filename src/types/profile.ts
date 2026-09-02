import type { Movie } from './movie';

export interface ProfileReview {
  id?: number;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  rating: number;
  comment: string;
  reviewedAt: string;
}

export function createProfileReview(
  movie: Movie,
  rating: number,
  comment: string,
): ProfileReview {
  return {
    tmdbId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path,
    rating,
    comment: comment.trim(),
    reviewedAt: new Date().toISOString(),
  };
}
