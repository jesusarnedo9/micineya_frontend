import { mediaTypeOf, type MediaType, type Movie } from './movie';

export interface ProfileReview {
  mediaType?: MediaType;
  seasonsWatched?: number[];
  watchedAt?: string;
  id?: number;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  rating: number;
  comment: string;
  reviewedAt: string;
  spoiler?: boolean;
  hiddenByModeration?: boolean;
}

export function createProfileReview(
  movie: Movie,
  rating: number,
  comment: string,
): ProfileReview {
  return {
    mediaType: mediaTypeOf(movie),
    seasonsWatched: [],
    tmdbId: movie.id,
    title: movie.title,
    posterPath: movie.poster_path,
    rating,
    comment: comment.trim(),
    reviewedAt: new Date().toISOString(),
  };
}
