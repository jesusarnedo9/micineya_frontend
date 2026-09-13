import { mediaTypeOf, type MediaType, type Movie } from './movie';

export interface ProfileReview {
  mediaType?: MediaType;
  seasonsWatched?: number[];
  seasonNumber?: number;
  seriesComplete?: boolean;
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

export function profileReviewKey(review: Pick<ProfileReview, 'tmdbId' | 'mediaType' | 'seasonNumber' | 'seasonsWatched'>): string {
  const season = review.seasonNumber ?? (review.seasonsWatched?.length === 1 ? review.seasonsWatched[0] : undefined);
  return `${mediaTypeOf(review)}:${review.tmdbId}${season ? `:s${season}` : ''}`;
}

/** Ver una temporada implica haber visto las anteriores, no haberlas puntuado. */
export function watchedSeasonNumbers(review: Pick<ProfileReview, 'mediaType' | 'seasonNumber' | 'seasonsWatched'>): number[] {
  if (mediaTypeOf(review) !== 'tv') return [];
  const numbers = [review.seasonNumber ?? 0, ...(review.seasonsWatched ?? [])]
    .filter((n) => Number.isSafeInteger(n) && n > 0);
  const last = Math.max(0, ...numbers);
  return Array.from({ length: last }, (_, index) => index + 1);
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
