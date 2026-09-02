export interface Movie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  videoKey?: string | null;
}

export interface MovieResponse {
  results?: Movie[];
  page?: number;
  total_pages?: number;
}

export interface MoviePage {
  movies: Movie[];
  page: number;
  totalPages: number | null;
}
