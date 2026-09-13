import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  FavoriteMovie, fetchFavorites, fetchRecommendationBatch, removeFavorite, saveFavorite, renewMovies,
  dismissMovie as dismissMovieRequest, undoMovieDismissal,
} from '../api/movies';
import { getAccountStorageKey, getProfileName } from '../auth/session';
import { fetchUserProfile, fetchProfilePhoto } from '../api/profile';
import { deleteReview, fetchMyReviews } from '../api/reviews';
import { deleteProfileReview, loadProfileReviews, saveProfileReview } from '../profile/review-storage';
import { contentKey, mediaTypeOf, type MediaType, type Movie } from '../types/movie';
import { profileReviewKey, type ProfileReview } from '../types/profile';
import { useAppFeedback } from './app-feedback';

interface AppExperienceValue {
  favoriteIds: ReadonlySet<string>;
  favoriteMovies: FavoriteMovie[];
  recordReview: (review: ProfileReview) => Promise<void>;
  unmarkAsWatched: (tmdbId: number, type?: MediaType, seasonNumber?: number) => Promise<void>;
  reviewedIds: ReadonlySet<string>;
  reviews: ProfileReview[];
  toggleFavorite: (movie: Movie) => Promise<boolean>;
  username: string;
  photoUri: string | null;
  setProfilePhoto: (uri: string | null) => void;
  loadRecommendations: (type?: MediaType) => Promise<Movie[]>;
  recommendationsVersion: number;
  recommendationNotices: Partial<Record<MediaType, string | null>>;
  refreshRecommendations: (type?: MediaType) => void;
  renewRecommendations: (type?: MediaType) => Promise<void>;
  dismissMovie: (movie: Movie) => Promise<void>;
  undoDismissal: () => Promise<void>;
  clearDismissalNotice: () => void;
  dismissedIds: ReadonlySet<string>;
  lastDismissed: Movie | null;
  recommendationsBusy: boolean;
}
interface Batch { movies: Movie[]; loadedAt: number; revision: number; pending: Promise<Movie[]> | null }
const newBatch = (): Batch => ({ movies: [], loadedAt: 0, revision: 0, pending: null });
const orderReviews = (reviews: ProfileReview[]) => [...reviews].sort((a, b) =>
  (b.watchedAt ?? b.reviewedAt).localeCompare(a.watchedAt ?? a.reviewedAt));
const AppExperienceContext = createContext<AppExperienceValue | null>(null);

export function AppExperienceProvider({ children }: PropsWithChildren) {
  const { showUndo } = useAppFeedback();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
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
  const [recommendationNotices, setRecommendationNotices] = useState<Partial<Record<MediaType, string | null>>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [lastDismissed, setLastDismissed] = useState<Movie | null>(null);
  const [recommendationsBusy, setRecommendationsBusy] = useState(false);
  const dismissedIdsRef = useRef<Set<string>>(new Set());
  const busyRef = useRef(false);
  const favoritesRef = useRef<FavoriteMovie[]>([]);
  const favoriteMutations = useRef(new Set<string>());
  const reviewedIdsRef = useRef<Set<string>>(new Set());
  const batches = useRef<Record<MediaType, Batch>>({ movie: newBatch(), tv: newBatch() });
  const favoriteChanges = useRef(new Set<string>());
  const reviewChanges = useRef(new Set<string>());
  const reviewsRef = useRef<ProfileReview[]>([]);
  // An old toast must never revert a more recent change to the same content.
  const contentRevisions = useRef(new Map<string, number>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const touchContent = useCallback((key: string) => {
    const revision = (contentRevisions.current.get(key) ?? 0) + 1;
    contentRevisions.current.set(key, revision);
    return revision;
  }, []);
  const updateReviews = useCallback((next: ProfileReview[]) => {
    reviewsRef.current = orderReviews(next);
    reviewedIdsRef.current = new Set(next.map(contentKey));
    setReviews(reviewsRef.current);
  }, []);

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
    void fetchFavorites().then((favorites) => {
      if (!mounted) return;
      const merged = [...favorites.filter((f) => !favoriteChanges.current.has(contentKey(f))),
        ...favoritesRef.current.filter((f) => favoriteChanges.current.has(contentKey(f)))];
      favoritesRef.current = merged;
      setFavoriteIds(new Set(merged.map(contentKey)));
      setFavoriteMovies(merged);
    }).catch(() => console.warn('No se pudieron cargar las guardadas'));
    void Promise.all([getProfileName(), getAccountStorageKey(), fetchUserProfile().catch(() => null)])
      .then(async ([localName, account, profile]) => {
        if (mounted) setUsername(profile?.username || localName);
        const server = await fetchMyReviews().catch(() => null);
        const loaded = server ?? await loadProfileReviews(account).catch(() => []);
        if (mounted) {
          updateReviews([...loaded.filter((r) => !reviewChanges.current.has(profileReviewKey(r))),
            ...reviewsRef.current.filter((r) => reviewChanges.current.has(profileReviewKey(r)))]);
        }
      }).catch(() => console.warn('No se pudo cargar el historial'));
    return () => { mounted = false; };
  }, []);

  const loadRecommendations = useCallback(async (type: MediaType = 'movie') => {
    const batch = batches.current[type];
    if (batch.loadedAt > 0) return batch.movies;
    if (batch.pending) return batch.pending;
    const revision = batch.revision;
    const request = fetchRecommendationBatch(type).then(({ movies, notice }) => {
      const result = movies.slice(0, 10).map((movie) => ({ ...movie, mediaType: type }));
      if (revision === batch.revision) {
        batch.movies = result;
        batch.loadedAt = Date.now();
        setRecommendationNotices((current) => ({ ...current, [type]: notice }));
      }
      return result;
    }).finally(() => { if (batch.pending === request) batch.pending = null; });
    batch.pending = request;
    return request;
  }, []);

  const refreshRecommendations = useCallback((type?: MediaType) => {
    for (const selectedType of type ? [type] : (['movie', 'tv'] as const)) {
      const batch = batches.current[selectedType];
      batch.revision += 1;
      batch.movies = [];
      batch.loadedAt = 0;
      batch.pending = null;
      setRecommendationNotices((current) => ({ ...current, [selectedType]: null }));
    }
    setRecommendationsVersion((v) => v + 1);
  }, []);

  const renewRecommendations = useCallback(async (type: MediaType = 'movie') => {
    if (busyRef.current) return;
    busyRef.current = true; setRecommendationsBusy(true);
    try {
      const batch = batches.current[type];
      await batch.pending?.catch(() => undefined);
      const revision = batch.revision;
      const { movies, notice } = await renewMovies(batch.movies.map((m) => m.id), type);
      if (revision !== batch.revision) return;
      batch.revision += 1;
      batch.movies = movies.slice(0, 10).map((m) => ({ ...m, mediaType: type }));
      batch.loadedAt = Date.now();
      setRecommendationNotices((current) => ({ ...current, [type]: notice }));
      setRecommendationsVersion((v) => v + 1);
    } finally { busyRef.current = false; setRecommendationsBusy(false); }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        for (const type of ['movie', 'tv'] as const) {
          const batch = batches.current[type];
          if (batch.loadedAt > 0 && Date.now() - batch.loadedAt >= 24 * 60 * 60 * 1000) {
            await renewRecommendations(type).catch(() => {});
          }
        }
      })();
    });
    return () => subscription.remove();
  }, [renewRecommendations]);

  const refreshIfExhausted = useCallback((type: MediaType) => {
    const movies = batches.current[type].movies;
    if (movies.length > 0 && movies.every((m) =>
      reviewedIdsRef.current.has(contentKey(m)) || dismissedIdsRef.current.has(contentKey(m)))) {
      refreshRecommendations(type);
    }
  }, [refreshRecommendations]);

  const dismissMovie = useCallback(async (movie: Movie) => {
    if (busyRef.current) return;
    busyRef.current = true; setRecommendationsBusy(true);
    try {
      await dismissMovieRequest(movie.id, mediaTypeOf(movie));
      const next = new Set(dismissedIdsRef.current).add(contentKey(movie));
      dismissedIdsRef.current = next; setDismissedIds(next); setLastDismissed(movie);
      refreshIfExhausted(mediaTypeOf(movie));
    } finally { busyRef.current = false; setRecommendationsBusy(false); }
  }, [refreshIfExhausted]);

  const undoDismissal = useCallback(async () => {
    if (!lastDismissed || busyRef.current) return;
    busyRef.current = true; setRecommendationsBusy(true);
    try {
      const type = mediaTypeOf(lastDismissed);
      await undoMovieDismissal(lastDismissed.id, type);
      const next = new Set(dismissedIdsRef.current); next.delete(contentKey(lastDismissed));
      dismissedIdsRef.current = next; setDismissedIds(next);
      const batch = batches.current[type];
      await batch.pending?.catch(() => undefined);
      if (!batch.movies.some((m) => contentKey(m) === contentKey(lastDismissed))) {
        batch.movies = [lastDismissed, ...batch.movies].slice(0, 10);
        batch.loadedAt = Date.now();
        setRecommendationsVersion((v) => v + 1);
      }
      setLastDismissed(null);
    } finally { busyRef.current = false; setRecommendationsBusy(false); }
  }, [lastDismissed]);
  const clearDismissalNotice = useCallback(() => setLastDismissed(null), []);

  const setFavoriteSaved = useCallback(async (movie: Movie, saved: boolean) => {
    if (!mountedRef.current) throw new Error('La sesión cambió');
    const key = contentKey(movie);
    if (favoriteMutations.current.has(key)) throw new Error('La guardada se está actualizando');
    favoriteMutations.current.add(key);
    try {
      if (saved) await saveFavorite(movie);
      else await removeFavorite(movie.id, mediaTypeOf(movie));
      if (!mountedRef.current) throw new Error('La sesión cambió');
      favoriteChanges.current.add(key);
      const remaining = favoritesRef.current.filter((f) => contentKey(f) !== key);
      const next = !saved ? remaining : [{
        tmdbId: movie.id, mediaType: mediaTypeOf(movie), titulo: movie.title, posterPath: movie.poster_path,
      }, ...remaining];
      favoritesRef.current = next;
      setFavoriteMovies(next); setFavoriteIds(new Set(next.map(contentKey)));
      return touchContent(key);
    } finally { favoriteMutations.current.delete(key); }
  }, [touchContent]);

  const toggleFavorite = useCallback(async (movie: Movie) => {
    const key = contentKey(movie);
    const wasSaved = favoritesRef.current.some((f) => contentKey(f) === key);
    if (favoriteMutations.current.has(key)) return wasSaved;
    const revision = await setFavoriteSaved(movie, !wasSaved);
    showUndo(wasSaved ? 'Quitada de guardadas' : 'Agregada a guardadas', async () => {
      if (!mountedRef.current || contentRevisions.current.get(key) !== revision) return;
      await setFavoriteSaved(movie, wasSaved);
    });
    return !wasSaved;
  }, [setFavoriteSaved, showUndo]);

  const recordReview = useCallback(async (review: ProfileReview) => {
    if (!mountedRef.current) return;
    const key = contentKey(review);
    const itemKey = profileReviewKey(review);
    const existed = reviewsRef.current.some((r) => profileReviewKey(r) === itemKey);
    const wasSaved = favoritesRef.current.some((f) => contentKey(f) === key);
    let revision = touchContent(key);
    reviewChanges.current.add(itemKey);
    updateReviews([review, ...reviewsRef.current.filter((r) => profileReviewKey(r) !== itemKey)]);
    const shouldLeaveSaved = mediaTypeOf(review) === 'tv' && !review.seriesComplete;
    const otherFavorites = favoritesRef.current.filter((favorite) => contentKey(favorite) !== key);
    const remainingFavorites = shouldLeaveSaved
      ? [{ tmdbId: review.tmdbId, mediaType: mediaTypeOf(review), titulo: review.title, posterPath: review.posterPath }, ...otherFavorites]
      : otherFavorites;
    if (shouldLeaveSaved || remainingFavorites.length !== favoritesRef.current.length) {
      favoriteChanges.current.add(key);
      favoritesRef.current = remainingFavorites;
      setFavoriteMovies(remainingFavorites);
      setFavoriteIds(new Set(remainingFavorites.map(contentKey)));
    }
    refreshIfExhausted(mediaTypeOf(review));
    try { await saveProfileReview(await getAccountStorageKey(), review); }
    catch { console.warn('No se pudo actualizar la copia local de la reseña'); }
    if (mountedRef.current && !existed && contentRevisions.current.get(key) === revision) {
      let removed = false;
      const type = mediaTypeOf(review);
      const season = review.seasonNumber ?? review.seasonsWatched?.[0];
      showUndo(type === 'tv' ? 'Progreso de la serie actualizado' : 'Película agregada a vistas', async () => {
        if (!mountedRef.current || contentRevisions.current.get(key) !== revision) return;
        // Retry safely if the deletion succeeded but restoring the saved state failed.
        if (!removed) {
          await deleteReview(review.tmdbId, type, season);
          if (!mountedRef.current) return;
          removed = true;
          reviewChanges.current.add(itemKey);
          updateReviews(reviewsRef.current.filter((r) => profileReviewKey(r) !== itemKey));
          revision = touchContent(key);
          refreshRecommendations(type);
          try { await deleteProfileReview(await getAccountStorageKey(), review.tmdbId, type, season); }
          catch { console.warn('No se pudo actualizar la copia local del historial'); }
        }
        // Deleting a TV season automatically saves the series on the server.
        if (wasSaved || type === 'tv') {
          await setFavoriteSaved({ id: review.tmdbId, mediaType: type, title: review.title,
            poster_path: review.posterPath, overview: '' }, wasSaved);
        }
      });
    }
  }, [refreshIfExhausted, refreshRecommendations, setFavoriteSaved, showUndo, touchContent, updateReviews]);

  const unmarkAsWatched = useCallback(async (tmdbId: number, type: MediaType = 'movie', seasonNumber?: number) => {
    await deleteReview(tmdbId, type, seasonNumber);
    const key = contentKey({ tmdbId, mediaType: type });
    const targetKey = profileReviewKey({ tmdbId, mediaType: type, seasonNumber });
    touchContent(key);
    reviewChanges.current.add(targetKey);
    reviewsRef.current.filter((r) => contentKey(r) === key && (!seasonNumber || profileReviewKey(r) === targetKey))
      .forEach((r) => reviewChanges.current.add(profileReviewKey(r)));
    const remaining = reviewsRef.current.filter((r) => seasonNumber
      ? profileReviewKey(r) !== targetKey : contentKey(r) !== key);
    updateReviews(remaining);
    try { await deleteProfileReview(await getAccountStorageKey(), tmdbId, type, seasonNumber); }
    catch { console.warn('No se pudo actualizar la copia local del historial'); }
    if (type === 'tv' && seasonNumber) {
      try {
        const fetched = await fetchFavorites();
        const favorites = [...favoritesRef.current.filter((f) => contentKey(f) !== key),
          ...fetched.filter((f) => contentKey(f) === key)];
        favoriteChanges.current.add(key);
        favoritesRef.current = favorites;
        setFavoriteMovies(favorites); setFavoriteIds(new Set(favorites.map(contentKey)));
      } catch { console.warn('No se pudieron actualizar las guardadas'); }
    }
    refreshRecommendations(type);
  }, [refreshRecommendations, touchContent, updateReviews]);

  return <AppExperienceContext.Provider value={{
    favoriteIds, favoriteMovies, loadRecommendations, recordReview, recommendationsVersion, recommendationNotices,
    refreshRecommendations, renewRecommendations, dismissMovie, undoDismissal, clearDismissalNotice,
    dismissedIds, lastDismissed, recommendationsBusy, reviewedIds: new Set(reviews.map(contentKey)),
    reviews, toggleFavorite, unmarkAsWatched, username, photoUri, setProfilePhoto,
  }}>{children}</AppExperienceContext.Provider>;
}

export function useAppExperience(): AppExperienceValue {
  const context = useContext(AppExperienceContext);
  if (!context) throw new Error('useAppExperience debe usarse dentro de AppExperienceProvider');
  return context;
}
