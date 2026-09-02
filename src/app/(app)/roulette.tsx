import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ApiFailure, describeApiError } from '../../api/errors';
import { clearSession } from '../../auth/session';
import { MovieReel } from '../../components/reels/movie-reel';
import { ReviewComposer } from '../../components/reviews/review-composer';
import { useAppExperience } from '../../context/app-experience';
import type { Movie } from '../../types/movie';

export default function RouletteScreen() {
  const router = useRouter();
  const {
    favoriteIds,
    loadRecommendations,
    muted,
    recordReview,
    reviewedIds,
    toggleFavorite,
    toggleMuted,
  } = useAppExperience();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [reviewMovie, setReviewMovie] = useState<Movie | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [screenFocused, setScreenFocused] = useState(true);
  const spinValue = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  useEffect(() => {
    let mounted = true;

    loadRecommendations()
      .then((results) => {
        if (mounted) {
          setMovies(results.slice(0, 10));
        }
      })
      .catch((error) => {
        if (mounted) {
          setFailure(describeApiError(error));
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loadRecommendations]);

  const chooseMovie = () => {
    if (movies.length === 0 || spinning) {
      return;
    }

    setSpinning(true);
    spinValue.setValue(0);

    Animated.timing(spinValue, {
      duration: 900,
      toValue: 1,
      useNativeDriver: true,
    }).start(() => {
      const available = selected && movies.length > 1
        ? movies.filter((movie) => movie.id !== selected.id)
        : movies;
      const nextMovie = available[Math.floor(Math.random() * available.length)];
      setSelected(nextMovie);
      setSpinning(false);
    });
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
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

  const handleFailureAction = async () => {
    if (failure?.requiresLogin) {
      await clearSession();
      router.replace('/(auth)/login');
      return;
    }

    setFailure(null);
    setLoading(true);
    try {
      setMovies(await loadRecommendations());
    } catch (error) {
      setFailure(describeApiError(error));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#e50914" size="large" />
      </View>
    );
  }

  if (failure) {
    return (
      <View style={styles.centered}>
        <Text style={styles.failureTitle}>{failure.title}</Text>
        <Text style={styles.failureMessage}>{failure.message}</Text>
        <Pressable onPress={() => void handleFailureAction()} style={styles.retryButton}>
          <Text style={styles.retryText}>
            {failure.requiresLogin ? 'Iniciar sesión' : 'Reintentar'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (selected) {
    return (
      <View onLayout={handleLayout} style={styles.container}>
        {viewport.width > 0 && viewport.height > 0 ? (
          <MovieReel
            active={screenFocused && reviewMovie === null}
            height={viewport.height}
            label="La ruleta eligió"
            mountVideo={screenFocused}
            movie={selected}
            muted={muted}
            onReview={setReviewMovie}
            onSave={(movie) => void handleSave(movie)}
            onToggleMuted={toggleMuted}
            reviewed={reviewedIds.has(selected.id)}
            saved={favoriteIds.has(selected.id)}
            width={viewport.width}
          />
        ) : null}
        <Pressable
          disabled={spinning}
          onPress={chooseMovie}
          style={({ pressed }) => [styles.spinAgain, pressed && styles.pressed]}
        >
          <Ionicons color="#fff" name="shuffle" size={18} />
          <Text style={styles.spinAgainText}>Girar otra vez</Text>
        </Pressable>
        <ReviewComposer
          movie={reviewMovie}
          onClose={() => setReviewMovie(null)}
          onSubmitted={recordReview}
        />
      </View>
    );
  }

  const rotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1080deg'],
  });

  return (
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>NO ELIJAS MÁS</Text>
      <Text style={styles.title}>La ruleta decide por vos</Text>
      <Text style={styles.description}>
        Elegiremos una película entre tus diez recomendaciones actuales.
      </Text>

      <Animated.View style={[styles.wheel, { transform: [{ rotate: rotation }] }]}>
        <Ionicons color="#fff" name="film" size={64} />
      </Animated.View>

      <Pressable
        disabled={movies.length === 0 || spinning}
        onPress={chooseMovie}
        style={({ pressed }) => [
          styles.spinButton,
          (pressed || spinning) && styles.pressed,
          movies.length === 0 && styles.disabled,
        ]}
      >
        <Text style={styles.spinText}>{spinning ? 'Girando...' : 'Girar ruleta'}</Text>
      </Pressable>

      {movies.length === 0 ? (
        <Text style={styles.emptyText}>
          Necesitamos recomendaciones para poder girar la ruleta.
        </Text>
      ) : null}
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
  failureTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  failureMessage: {
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
    fontWeight: '900',
  },
  intro: {
    alignItems: 'center',
    backgroundColor: '#090909',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  eyebrow: {
    color: '#e50914',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  description: {
    color: '#aaa',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 320,
    textAlign: 'center',
  },
  wheel: {
    alignItems: 'center',
    backgroundColor: '#e50914',
    borderColor: '#ff5961',
    borderRadius: 74,
    borderWidth: 7,
    height: 148,
    justifyContent: 'center',
    marginVertical: 38,
    shadowColor: '#e50914',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    width: 148,
  },
  spinButton: {
    backgroundColor: '#fff',
    borderRadius: 26,
    minWidth: 190,
    paddingHorizontal: 28,
    paddingVertical: 15,
  },
  spinText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  emptyText: {
    color: '#ffb3b8',
    fontSize: 13,
    marginTop: 18,
    textAlign: 'center',
  },
  spinAgain: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.92)',
    borderRadius: 22,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 11,
    position: 'absolute',
    top: 66,
  },
  spinAgainText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
