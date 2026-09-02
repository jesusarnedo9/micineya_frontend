import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  FavoriteMovie,
  fetchFavorites,
  fetchMovies,
  removeFavorite,
  saveFavorite,
} from '../api/movies';
import { getAccountStorageKey, getProfileName } from '../auth/session';
import { fetchUserProfile } from '../api/profile';
import { fetchMyReviews } from '../api/reviews';
import { loadProfileReviews, saveProfileReview } from '../profile/review-storage';
import type { Movie } from '../types/movie';
import type { ProfileReview } from '../types/profile';

interface AppExperienceValue {
  favoriteIds: ReadonlySet<number>;
  favoriteMovies: FavoriteMovie[];
  muted: boolean;
  recordReview: (review: ProfileReview) => Promise<void>;
  reviewedIds: ReadonlySet<number>;
  reviews: ProfileReview[];
  toggleMuted: () => void;
  toggleFavorite: (movie: Movie) => Promise<boolean>;
  username: string;
  loadRecommendations: () => Promise<Movie[]>;
}

const AppExperienceContext = createContext<AppExperienceValue | null>(null);

export function AppExperienceProvider({ children }: PropsWithChildren) {
  const [muted, setMuted] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteMovies, setFavoriteMovies] = useState<FavoriteMovie[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [username, setUsername] = useState('Cinéfilo');
  const favoriteIdsRef = useRef<Set<number>>(new Set());
  const favoriteMoviesRef = useRef<FavoriteMovie[]>([]);
  const reviewAccountRef = useRef('current_user');
  const recommendationsRef = useRef<Movie[]>([]);
  const pendingRequestRef = useRef<Promise<Movie[]> | null>(null);

  useEffect(() => {
    let mounted = true;

    fetchFavorites()
      .then((favorites) => {
        if (!mounted) {
          return;
        }

        const nextIds = new Set(favorites.map((movie) => movie.tmdbId));
        favoriteIdsRef.current = nextIds;
        favoriteMoviesRef.current = favorites;
        setFavoriteIds(nextIds);
        setFavoriteMovies(favorites);
      })
      .catch((error) => {
        console.warn('No se pudieron cargar las películas guardadas', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    Promise.all([getProfileName(), getAccountStorageKey(), fetchUserProfile().catch(() => null)])
      .then(([localUsername, accountKey, profile]) => {
        if (mounted) {
          reviewAccountRef.current = accountKey;
          setUsername(profile?.username || localUsername);
        }
        return Promise.all([
          fetchMyReviews().catch(() => []),
          loadProfileReviews(accountKey).catch(() => []),
        ]);
      })
      .then(([serverReviews, localReviews]) => {
        if (mounted) {
          const serverIds = new Set(serverReviews.map((review) => review.tmdbId));
          setReviews([
            ...serverReviews,
            ...localReviews.filter((review) => !serverIds.has(review.tmdbId)),
          ]);
        }
      })
      .catch((error) => {
        console.warn('No se pudo cargar el historial de reseñas', error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loadRecommendations = useCallback(async () => {
    if (recommendationsRef.current.length > 0) {
      return recommendationsRef.current;
    }

    if (pendingRequestRef.current) {
      return pendingRequestRef.current;
    }

    const request = fetchMovies('/api/peliculas/recomendadas')
      .then((movies) => {
        const recommendations = movies.slice(0, 10);
        recommendationsRef.current = recommendations;
        return recommendations;
      })
      .finally(() => {
        pendingRequestRef.current = null;
      });

    pendingRequestRef.current = request;
    return request;
  }, []);

  const toggleFavorite = useCallback(async (movie: Movie) => {
    const wasSaved = favoriteIdsRef.current.has(movie.id);

    if (wasSaved) {
      await removeFavorite(movie.id);
    } else {
      await saveFavorite(movie);
    }

    const nextIds = new Set(favoriteIdsRef.current);
    let nextMovies = favoriteMoviesRef.current;
    if (wasSaved) {
      nextIds.delete(movie.id);
      nextMovies = nextMovies.filter((favorite) => favorite.tmdbId !== movie.id);
    } else {
      nextIds.add(movie.id);
      nextMovies = [
        {
          tmdbId: movie.id,
          titulo: movie.title,
          posterPath: movie.poster_path,
        },
        ...nextMovies.filter((favorite) => favorite.tmdbId !== movie.id),
      ];
    }

    favoriteIdsRef.current = nextIds;
    favoriteMoviesRef.current = nextMovies;
    setFavoriteIds(nextIds);
    setFavoriteMovies(nextMovies);
    return !wasSaved;
  }, []);

  const recordReview = useCallback(async (review: ProfileReview) => {
    setReviews((current) => [
      review,
      ...current.filter((item) => item.tmdbId !== review.tmdbId),
    ]);

    try {
      await saveProfileReview(reviewAccountRef.current, review);
    } catch (error) {
      console.warn('La reseña se publicó, pero no pudo guardarse en el perfil local', error);
    }
  }, []);

  const reviewedIds = new Set(reviews.map((review) => review.tmdbId));

  return (
    <AppExperienceContext.Provider
      value={{
        favoriteIds,
        favoriteMovies,
        loadRecommendations,
        muted,
        recordReview,
        reviewedIds,
        reviews,
        toggleFavorite,
        toggleMuted: () => setMuted((current) => !current),
        username,
      }}
    >
      {children}
    </AppExperienceContext.Provider>
  );
}

export function useAppExperience(): AppExperienceValue {
  const context = useContext(AppExperienceContext);
  if (!context) {
    throw new Error('useAppExperience debe usarse dentro de AppExperienceProvider');
  }
  return context;
}
