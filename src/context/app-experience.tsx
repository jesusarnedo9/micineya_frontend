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
import { deleteReview, fetchMyReviews } from '../api/reviews';
import {
  deleteProfileReview,
  loadProfileReviews,
  saveProfileReview,
} from '../profile/review-storage';
import type { Movie } from '../types/movie';
import type { ProfileReview } from '../types/profile';

interface AppExperienceValue {
  favoriteIds: ReadonlySet<number>;
  favoriteMovies: FavoriteMovie[];
  recordReview: (review: ProfileReview) => Promise<void>;
  unmarkAsWatched: (tmdbId: number) => Promise<void>;
  reviewedIds: ReadonlySet<number>;
  reviews: ProfileReview[];
  toggleFavorite: (movie: Movie) => Promise<boolean>;
  username: string;
  loadRecommendations: () => Promise<Movie[]>;
  recommendationsVersion: number;
  refreshRecommendations: () => void;
}

const AppExperienceContext = createContext<AppExperienceValue | null>(null);

export function AppExperienceProvider({ children }: PropsWithChildren) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteMovies, setFavoriteMovies] = useState<FavoriteMovie[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [username, setUsername] = useState('Cinéfilo');
  const [recommendationsVersion, setRecommendationsVersion] = useState(0);
  const favoriteIdsRef = useRef<Set<number>>(new Set());
  const favoriteMoviesRef = useRef<FavoriteMovie[]>([]);
  const reviewedIdsRef = useRef<Set<number>>(new Set());
  const reviewAccountRef = useRef('current_user');
  const recommendationsRef = useRef<Movie[]>([]);
  const pendingRequestRef = useRef<Promise<Movie[]> | null>(null);
  const recommendationRevisionRef = useRef(0);

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
          const mergedReviews = [
            ...serverReviews,
            ...localReviews.filter((review) => !serverIds.has(review.tmdbId)),
          ];
          reviewedIdsRef.current = new Set(mergedReviews.map((review) => review.tmdbId));
          setReviews(mergedReviews);
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

    const requestRevision = recommendationRevisionRef.current;
    const request = fetchMovies('/api/peliculas/recomendadas')
      .then((movies) => {
        const recommendations = movies.slice(0, 10);
        if (requestRevision === recommendationRevisionRef.current) {
          recommendationsRef.current = recommendations;
        }
        return recommendations;
      })
      .finally(() => {
        if (pendingRequestRef.current === request) {
          pendingRequestRef.current = null;
        }
      });

    pendingRequestRef.current = request;
    return request;
  }, []);

  const refreshRecommendations = useCallback(() => {
    recommendationRevisionRef.current += 1;
    recommendationsRef.current = [];
    pendingRequestRef.current = null;
    setRecommendationsVersion((current) => current + 1);
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
    const nextReviewedIds = new Set(reviewedIdsRef.current);
    nextReviewedIds.add(review.tmdbId);
    reviewedIdsRef.current = nextReviewedIds;
    setReviews((current) => [
      review,
      ...current.filter((item) => item.tmdbId !== review.tmdbId),
    ]);

    const exhaustedCurrentBatch = recommendationsRef.current.length > 0
      && recommendationsRef.current.every((movie) => nextReviewedIds.has(movie.id));
    if (exhaustedCurrentBatch) {
      refreshRecommendations();
    }

    try {
      await saveProfileReview(reviewAccountRef.current, review);
    } catch (error) {
      console.warn('La reseña se publicó, pero no pudo guardarse en el perfil local', error);
    }
  }, [refreshRecommendations]);

  const unmarkAsWatched = useCallback(async (tmdbId: number) => {
    await deleteReview(tmdbId);
    const nextReviewedIds = new Set(reviewedIdsRef.current);
    nextReviewedIds.delete(tmdbId);
    reviewedIdsRef.current = nextReviewedIds;
    setReviews((current) => current.filter((review) => review.tmdbId !== tmdbId));
    try {
      await deleteProfileReview(reviewAccountRef.current, tmdbId);
    } catch (error) {
      console.warn('La película se quitó del perfil, pero falló la copia local', error);
    }
    refreshRecommendations();
  }, [refreshRecommendations]);

  const reviewedIds = new Set(reviews.map((review) => review.tmdbId));

  return (
    <AppExperienceContext.Provider
      value={{
        favoriteIds,
        favoriteMovies,
        loadRecommendations,
        recordReview,
        recommendationsVersion,
        refreshRecommendations,
        reviewedIds,
        reviews,
        toggleFavorite,
        unmarkAsWatched,
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
