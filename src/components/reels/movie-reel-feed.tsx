import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';

import { fetchMoviePage } from '../../api/movies';
import { ApiFailure, describeApiError } from '../../api/errors';
import { clearSession } from '../../auth/session';
import { useAppExperience } from '../../context/app-experience';
import { contentKey, type Movie } from '../../types/movie';
import { ReviewComposer } from '../reviews/review-composer';
import { MovieReel } from './movie-reel';

interface MovieReelFeedProps {
  endpoint?: string;
  loader?: () => Promise<Movie[]>;
  label: string;
  maxItems?: number;
  infinite?: boolean;
  emptyMessage?: string;
  allowDismiss?: boolean;
}

interface Viewport {
  width: number;
  height: number;
}

export function MovieReelFeed({
  endpoint,
  loader,
  label,
  maxItems,
  infinite = false,
  allowDismiss = false,
  emptyMessage = 'Todavía no encontramos películas para mostrar.',
}: MovieReelFeedProps) {
  const router = useRouter();
  const {
    favoriteIds,
    recordReview,
    reviewedIds,
    reviews,
    toggleFavorite,
    dismissMovie,
    dismissedIds,
    recommendationsBusy,
  } = useAppExperience();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviewMovie, setReviewMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const [screenFocused, setScreenFocused] = useState(true);
  const nextPageRef = useRef(2);
  const totalPagesRef = useRef<number | null>(null);
  const loadingMoreRef = useRef(false);
  const listRef = useRef<FlatList<Movie>>(null);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const visibleMovies = useMemo(() => allowDismiss
    ? movies.filter((movie) => !dismissedIds.has(contentKey(movie))) : movies, [movies, dismissedIds, allowDismiss]);

  useEffect(() => {
    const index = Math.min(activeIndexRef.current, Math.max(0, visibleMovies.length - 1));
    setActiveIndex(index);
    if (viewport.height > 0) {
      listRef.current?.scrollToOffset({ offset: index * viewport.height, animated: false });
    }
  }, [visibleMovies, viewport.height]);

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  const loadMovies = useCallback(async () => {
    setLoading(true);
    setFailure(null);

    try {
      if (!loader && !endpoint) {
        throw new Error('El feed necesita un endpoint o loader');
      }
      let fetched: Movie[];
      if (loader) {
        fetched = await loader();
        nextPageRef.current = 2;
        totalPagesRef.current = null;
      } else {
        const firstPage = await fetchMoviePage(endpoint as string, 1);
        fetched = firstPage.movies;
        nextPageRef.current = firstPage.page + 1;
        totalPagesRef.current = firstPage.totalPages;
      }
      const limited = typeof maxItems === 'number' ? fetched.slice(0, maxItems) : fetched;
      setMovies(limited);
      setActiveIndex(0);
    } catch (error) {
      setFailure(describeApiError(error));
    } finally {
      setLoading(false);
    }
  }, [endpoint, loader, maxItems]);

  useEffect(() => {
    void loadMovies();
  }, [loadMovies]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken<Movie>> }) => {
      const firstVisible = viewableItems.find((item) => item.isViewable && item.index != null);
      if (firstVisible?.index != null) {
        setActiveIndex(firstVisible.index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 100,
  }).current;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== viewport.width || height !== viewport.height) {
      setViewport({ width, height });
    }
  };

  const handleSave = async (movie: Movie) => {
    try {
      await toggleFavorite(movie);
    } catch {
      Alert.alert(
        favoriteIds.has(contentKey(movie)) ? 'No se pudo quitar' : 'No se pudo guardar',
        'Intentá nuevamente en unos segundos.',
      );
    }
  };

  const handleDismiss = async (movie: Movie) => {
    try {
      await dismissMovie(movie);
    } catch (error) {
      const errorInfo = describeApiError(error);
      Alert.alert(errorInfo.title, errorInfo.message);
    }
  };

  const appendMore = async () => {
    if (!infinite || !endpoint || loader || loadingMoreRef.current) {
      return;
    }

    const nextPage = nextPageRef.current;
    if (totalPagesRef.current !== null && nextPage > totalPagesRef.current) {
      return;
    }

    loadingMoreRef.current = true;
    try {
      const page = await fetchMoviePage(endpoint, nextPage);
      setMovies((current) => Array.from(
        new Map([...current, ...page.movies].map((movie) => [contentKey(movie), movie])).values(),
      ));
      nextPageRef.current = page.page + 1;
      totalPagesRef.current = page.totalPages;
    } catch (error) {
      console.warn('No se pudo cargar la siguiente página del feed', error);
    } finally {
      loadingMoreRef.current = false;
    }
  };

  const handleFailureAction = async () => {
    if (failure?.requiresLogin) {
      await clearSession();
      router.replace('/(auth)/login');
      return;
    }

    await loadMovies();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#e50914" size="large" />
        <Text style={styles.loadingText}>Buscando algo para vos...</Text>
      </View>
    );
  }

  if (failure) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{failure.title}</Text>
        <Text style={styles.errorMessage}>{failure.message}</Text>
        <Pressable onPress={() => void handleFailureAction()} style={styles.retryButton}>
          <Text style={styles.retryText}>
            {failure.requiresLogin ? 'Iniciar sesión' : 'Reintentar'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (visibleMovies.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Sin resultados</Text>
        <Text style={styles.errorMessage}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {allowDismiss && movies.length < 10 ? (
        <Text style={styles.catalogNotice}>
          Encontramos {movies.length} opciones. Ampliá tus gustos para descubrir más.
        </Text>
      ) : null}
      <View onLayout={handleLayout} style={styles.container}>
      {viewport.height > 0 && viewport.width > 0 ? (
        <FlatList
          ref={listRef}
          data={visibleMovies}
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({
            index,
            length: viewport.height,
            offset: viewport.height * index,
          })}
          initialNumToRender={3}
          keyExtractor={contentKey}
          maxToRenderPerBatch={3}
          onEndReached={() => void appendMore()}
          onEndReachedThreshold={0.6}
          onViewableItemsChanged={onViewableItemsChanged}
          pagingEnabled
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item, index }) => (
            <MovieReel
              active={screenFocused && !recommendationsBusy && reviewMovie === null && index === activeIndex}
              height={viewport.height}
              label={
                maxItems
                  ? `${label} · ${index + 1}/${visibleMovies.length}`
                  : label
              }
              mountVideo={
                screenFocused
                && index >= activeIndex - 1
                && index <= activeIndex + 2
              }
              movie={item}
              onReview={setReviewMovie}
              onDismiss={allowDismiss ? (movie) => void handleDismiss(movie) : undefined}
              dismissDisabled={recommendationsBusy}
              onSave={(movie) => void handleSave(movie)}
              reviewed={reviewedIds.has(contentKey(item))}
              saved={favoriteIds.has(contentKey(item))}
              width={viewport.width}
            />
          )}
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={viewport.height}
          viewabilityConfig={viewabilityConfig}
          windowSize={5}
        />
      ) : null}

      <ReviewComposer
        existingReview={reviewMovie ? reviews.find((r) => contentKey(r) === contentKey(reviewMovie)) ?? null : null}
        movie={reviewMovie}
        onClose={() => setReviewMovie(null)}
        onSubmitted={recordReview}
      />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  catalogNotice: { color: '#d4b67b', fontSize: 12, paddingHorizontal: 18, paddingVertical: 8, backgroundColor: '#19150f' },
  container: {
    backgroundColor: '#000',
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    backgroundColor: '#000',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 28,
  },
  loadingText: {
    color: '#ddd',
    fontSize: 14,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  errorMessage: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#e50914',
    borderRadius: 22,
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '800',
  },
});
