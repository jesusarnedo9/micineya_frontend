export type MediaType = 'movie' | 'tv';

export function mediaTypeOf(content: { mediaType?: MediaType } | null | undefined): MediaType {
  return content?.mediaType ?? 'movie';
}

export function contentKey(content: { id?: number; tmdbId?: number; mediaType?: MediaType }): string {
  return `${mediaTypeOf(content)}:${content.tmdbId ?? content.id}`;
}

export interface Movie {
  mediaType?: MediaType;
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date?: string | null;
  vote_average?: number | null;
  videoKey?: string | null;
  plataformas?: string[];
}

export interface MovieResponse {
  results?: Movie[];
  page?: number;
  total_pages?: number;
  generosSinEquivalencia?: string[];
}

export interface MoviePage {
  movies: Movie[];
  page: number;
  totalPages: number | null;
}
