import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { Movie } from '../../types/movie';
import { ReviewComposer } from '../reviews/review-composer';
import { MovieReel } from './movie-reel';

interface MovieReelFeedProps {
  endpoint?: string;
  loader?: () => Promise<Movie[]>;
  label: string;
  maxItems?: number;
  infinite?: boolean;
  emptyMessage?: string;
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
  emptyMessage = 'Todavía no encontramos películas para mostrar.',
}: MovieReelFeedProps) {
  const router = useRouter();
  const {
    favoriteIds,
    muted,
    recordReview,
    reviewedIds,
    toggleFavorite,
    toggleMuted,
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
        favoriteIds.has(movie.id) ? 'No se pudo quitar' : 'No se pudo guardar',
        'Intentá nuevamente en unos segundos.',
      );
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
        new Map([...current, ...page.movies].map((movie) => [movie.id, movie])).values(),
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
        <Text style={styles.loadingText}>Buscando tu próxima película...</Text>
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

  if (movies.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Sin resultados</Text>
        <Text style={styles.errorMessage}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View onLayout={handleLayout} style={styles.container}>
      {viewport.height > 0 && viewport.width > 0 ? (
        <FlatList
          data={movies}
          decelerationRate="fast"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({
            index,
            length: viewport.height,
            offset: viewport.height * index,
          })}
          initialNumToRender={2}
          keyExtractor={(movie, index) => `${movie.id}-${index}`}
          maxToRenderPerBatch={2}
          onEndReached={() => void appendMore()}
          onEndReachedThreshold={0.6}
          onViewableItemsChanged={onViewableItemsChanged}
          pagingEnabled
          removeClippedSubviews={Platform.OS === 'android'}
          renderItem={({ item, index }) => (
            <MovieReel
              active={screenFocused && reviewMovie === null && index === activeIndex}
              height={viewport.height}
              label={
                maxItems
                  ? `${label} · ${Math.min(index + 1, movies.length)}/${movies.length}`
                  : label
              }
              mountVideo={screenFocused && Math.abs(index - activeIndex) <= 1}
              movie={item}
              muted={muted}
              onReview={setReviewMovie}
              onSave={(movie) => void handleSave(movie)}
              onToggleMuted={toggleMuted}
              reviewed={reviewedIds.has(item.id)}
              saved={favoriteIds.has(item.id)}
              width={viewport.width}
            />
          )}
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          snapToInterval={viewport.height}
          viewabilityConfig={viewabilityConfig}
          windowSize={3}
        />
      ) : null}

      <ReviewComposer
        movie={reviewMovie}
        onClose={() => setReviewMovie(null)}
        onSubmitted={recordReview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
