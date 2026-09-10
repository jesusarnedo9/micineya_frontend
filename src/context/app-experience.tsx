import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import {
  FavoriteMovie,
  fetchFavorites,
  fetchMovies,
  removeFavorite,
  saveFavorite,
  renewMovies,
  dismissMovie as dismissMovieRequest,
  undoMovieDismissal,
} from '../api/movies';
import { getAccountStorageKey, getProfileName } from '../auth/session';
import { fetchUserProfile, fetchProfilePhoto } from '../api/profile';
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
  photoUri: string | null;
  setProfilePhoto: (uri: string | null) => void;
  loadRecommendations: () => Promise<Movie[]>;
  recommendationsVersion: number;
  refreshRecommendations: () => void;
  renewRecommendations: () => Promise<void>;
  dismissMovie: (movie: Movie) => Promise<void>;
  undoDismissal: () => Promise<void>;
  clearDismissalNotice: () => void;
  dismissedIds: ReadonlySet<number>;
  lastDismissed: Movie | null;
  recommendationsBusy: boolean;
}

const AppExperienceContext = createContext<AppExperienceValue | null>(null);

export function AppExperienceProvider({ children }: PropsWithChildren) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteMovies, setFavoriteMovies] = useState<FavoriteMovie[]>([]);
  const [reviews, setReviews] = useState<ProfileReview[]>([]);
  const [username, setUsername] = useState('Cinéfilo');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const photoRevisionRef = useRef(0);
  const setProfilePhoto = useCallback((uri: string | null) => {
    photoRevisionRef.current += 1;
    setPhotoUri(uri);
  }, []);
  const [recommendationsVersion, setRecommendationsVersion] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(new Set());
  const [lastDismissed, setLastDismissed] = useState<Movie | null>(null);
  const [recommendationsBusy, setRecommendationsBusy] = useState(false);
  const dismissedIdsRef = useRef<Set<number>>(new Set());
  const recommendationsBusyRef = useRef(false);
  const recommendationsLoadedAtRef = useRef(0);
  const favoriteIdsRef = useRef<Set<number>>(new Set());
  const favoriteMoviesRef = useRef<FavoriteMovie[]>([]);
  const reviewedIdsRef = useRef<Set<number>>(new Set());
  const reviewAccountRef = useRef('current_user');
  const recommendationsRef = useRef<Movie[]>([]);
  const pendingRequestRef = useRef<Promise<Movie[]> | null>(null);
  const recommendationRevisionRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const revision = photoRevisionRef.current;
    void fetchProfilePhoto().then((uri) => {
      if (mounted && revision === photoRevisionRef.current) setPhotoUri(uri);
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

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
          fetchMyReviews().catch(() => null),
          loadProfileReviews(accountKey).catch(() => []),
        ]);
      })
      .then(([serverReviews, localReviews]) => {
        if (mounted) {
          // El servidor es la fuente de verdad: no resucitar reseñas eliminadas en otro dispositivo.
          const mergedReviews = serverReviews ?? localReviews;
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
    if (recommendationsLoadedAtRef.current > 0) {
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
          recommendationsLoadedAtRef.current = Date.now();
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
    recommendationsLoadedAtRef.current = 0;
    pendingRequestRef.current = null;
    setRecommendationsVersion((current) => current + 1);
  }, []);

  const renewRecommendations = useCallback(async () => {
    if (recommendationsBusyRef.current) return;
    recommendationsBusyRef.current = true;
    setRecommendationsBusy(true);
    try {
      // Esperamos la carga inicial antes de excluir el lote que ya está en pantalla.
      await pendingRequestRef.current?.catch(() => undefined);
      const revision = recommendationRevisionRef.current;
      const movies = await renewMovies(recommendationsRef.current.map((movie) => movie.id));
      if (revision !== recommendationRevisionRef.current) return;
      recommendationRevisionRef.current += 1;
      recommendationsRef.current = movies.slice(0, 10);
      recommendationsLoadedAtRef.current = Date.now();
      setRecommendationsVersion((current) => current + 1);
    } finally {
      recommendationsBusyRef.current = false;
      setRecommendationsBusy(false);
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && recommendationsLoadedAtRef.current > 0
          && Date.now() - recommendationsLoadedAtRef.current >= 24 * 60 * 60 * 1000) {
        void renewRecommendations().catch(() => {
          // Conservamos el lote anterior si no hay conexión; se puede reintentar manualmente.
        });
      }
    });
    return () => subscription.remove();
  }, [renewRecommendations]);

  const dismissMovie = useCallback(async (movie: Movie) => {
    if (recommendationsBusyRef.current) return;
    recommendationsBusyRef.current = true;
    setRecommendationsBusy(true);
    try {
      await dismissMovieRequest(movie.id);
      const next = new Set(dismissedIdsRef.current).add(movie.id);
      dismissedIdsRef.current = next;
      setDismissedIds(next);
      setLastDismissed(movie);
      if (recommendationsRef.current.length > 0 && recommendationsRef.current.every(
        (item) => next.has(item.id) || reviewedIdsRef.current.has(item.id),
      )) {
        refreshRecommendations();
      }
    } finally {
      recommendationsBusyRef.current = false;
      setRecommendationsBusy(false);
    }
  }, [refreshRecommendations]);

  const undoDismissal = useCallback(async () => {
    if (!lastDismissed || recommendationsBusyRef.current) return;
    recommendationsBusyRef.current = true;
    setRecommendationsBusy(true);
    try {
      await undoMovieDismissal(lastDismissed.id);
      const next = new Set(dismissedIdsRef.current);
      next.delete(lastDismissed.id);
      dismissedIdsRef.current = next;
      setDismissedIds(next);
      // Si ya cambiamos de lote, reincorporamos la película al deshacer.
      await pendingRequestRef.current?.catch(() => undefined);
      if (!recommendationsRef.current.some((movie) => movie.id === lastDismissed.id)) {
        recommendationsRef.current = [lastDismissed, ...recommendationsRef.current].slice(0, 10);
        recommendationsLoadedAtRef.current = Date.now();
        setRecommendationsVersion((current) => current + 1);
      }
      setLastDismissed(null);
    } finally {
      recommendationsBusyRef.current = false;
      setRecommendationsBusy(false);
    }
  }, [lastDismissed]);

  const clearDismissalNotice = useCallback(() => setLastDismissed(null), []);

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
      && recommendationsRef.current.every((movie) =>
        nextReviewedIds.has(movie.id) || dismissedIdsRef.current.has(movie.id));
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
        renewRecommendations,
        dismissMovie,
        undoDismissal,
        clearDismissalNotice,
        dismissedIds,
        lastDismissed,
        recommendationsBusy,
        reviewedIds,
        reviews,
        toggleFavorite,
        unmarkAsWatched,
        username,
        photoUri,
        setProfilePhoto,
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
