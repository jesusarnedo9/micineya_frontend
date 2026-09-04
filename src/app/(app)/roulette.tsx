import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFailure, describeApiError } from '../../api/errors';
import { clearSession } from '../../auth/session';
import { ReviewComposer } from '../../components/reviews/review-composer';
import { useAppExperience } from '../../context/app-experience';
import type { Movie } from '../../types/movie';

export default function RouletteScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    favoriteIds,
    loadRecommendations,
    recordReview,
    recommendationsVersion,
    reviewedIds,
    reviews,
    toggleFavorite,
  } = useAppExperience();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [reviewMovie, setReviewMovie] = useState<Movie | null>(null);
  const spinValue = useRef(new Animated.Value(0)).current;
  const eligibleMovies = movies.filter((movie) => !reviewedIds.has(movie.id));

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setFailure(null);
    setSelected(null);

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
  }, [loadRecommendations, recommendationsVersion]);

  const chooseMovie = () => {
    if (eligibleMovies.length === 0 || spinning) {
      return;
    }

    setSpinning(true);
    spinValue.setValue(0);
    const previousSelection = selected;
    setSelected(null);

    Animated.timing(spinValue, {
      duration: 900,
      toValue: 1,
      useNativeDriver: true,
    }).start(() => {
      const available = previousSelection && eligibleMovies.length > 1
        ? eligibleMovies.filter((movie) => movie.id !== previousSelection.id)
        : eligibleMovies;
      const nextMovie = available[Math.floor(Math.random() * available.length)];
      setSelected(nextMovie);
      setSpinning(false);
    });
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
    const posterWidth = Math.min(width - 72, 300);
    const hasRating = typeof selected.vote_average === 'number' && selected.vote_average > 0;

    return (
      <SafeAreaView edges={['top']} style={styles.resultSafeArea}>
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={styles.resultBadge}>
            <Ionicons color="#f6c85f" name="sparkles" size={16} />
            <Text style={styles.resultBadgeText}>LA RULETA ELIGIÓ</Text>
          </View>
          <Text style={styles.resultHeading}>Esta peli es para vos</Text>

          {selected.poster_path ? (
            <Image
              resizeMode="cover"
              source={{ uri: `https://image.tmdb.org/t/p/w780${selected.poster_path}` }}
              style={[styles.resultPoster, { height: posterWidth * 1.5, width: posterWidth }]}
            />
          ) : (
            <View style={[styles.resultPoster, styles.posterFallback, { height: posterWidth * 1.5, width: posterWidth }]}>
              <Ionicons color="#665c5f" name="film-outline" size={58} />
            </View>
          )}

          <Text style={styles.resultTitle}>{selected.title}</Text>
          {hasRating ? (
            <View style={styles.resultRating}>
              <Ionicons color="#f6c85f" name="star" size={17} />
              <Text style={styles.resultRatingText}>{selected.vote_average?.toFixed(1)} / 10</Text>
              <Text style={styles.resultRatingSource}>TMDB</Text>
            </View>
          ) : null}

          <View style={styles.resultActions}>
            <Pressable
              onPress={() => void handleSave(selected)}
              style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
            >
              <Ionicons
                color="#fff"
                name={favoriteIds.has(selected.id) ? 'bookmark' : 'bookmark-outline'}
                size={20}
              />
              <Text style={styles.secondaryActionText}>
                {favoriteIds.has(selected.id) ? 'Guardada' : 'Guardar'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setReviewMovie(selected)}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
            >
              <Ionicons
                color="#fff"
                name={reviewedIds.has(selected.id) ? 'create-outline' : 'eye-outline'}
                size={20}
              />
              <Text style={styles.primaryActionText}>
                {reviewedIds.has(selected.id) ? 'Editar reseña' : 'La vi'}
              </Text>
            </Pressable>
          </View>

          <Pressable
            disabled={spinning}
            onPress={chooseMovie}
            style={({ pressed }) => [styles.spinAgain, pressed && styles.pressed]}
          >
            <Ionicons color="#ff858a" name="shuffle" size={18} />
            <Text style={styles.spinAgainText}>Girar otra vez</Text>
          </Pressable>
        </ScrollView>
        <ReviewComposer
          existingReview={reviews.find((review) => review.tmdbId === reviewMovie?.id) ?? null}
          movie={reviewMovie}
          onClose={() => setReviewMovie(null)}
          onSubmitted={recordReview}
        />
      </SafeAreaView>
    );
  }

  const rotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '1080deg'],
  });

  return (
    <View style={styles.intro}>
      <Text style={styles.eyebrow}>NO DES MÁS VUELTAS</Text>
      <Text style={styles.title}>La Cine-Ruleta decide por vos.</Text>
      <Text style={styles.description}>
        Elegiremos una película entre tus diez recomendaciones actuales.
      </Text>

      <Animated.View style={[styles.wheel, { transform: [{ rotate: rotation }] }]}>
        <Ionicons color="#fff" name="film" size={64} />
      </Animated.View>

      <Pressable
        disabled={eligibleMovies.length === 0 || spinning}
        onPress={chooseMovie}
        style={({ pressed }) => [
          styles.spinButton,
          (pressed || spinning) && styles.pressed,
          eligibleMovies.length === 0 && styles.disabled,
        ]}
      >
        <Text style={styles.spinText}>{spinning ? 'Girando...' : 'Girar ruleta'}</Text>
      </Pressable>

      {eligibleMovies.length === 0 ? (
        <Text style={styles.emptyText}>
          Ya viste todas estas recomendaciones. Cambiá tus preferencias para descubrir otras.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  resultSafeArea: { backgroundColor: '#080608', flex: 1 },
  resultContent: {
    alignItems: 'center',
    paddingBottom: 36,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  resultBadge: {
    alignItems: 'center',
    backgroundColor: '#2a2012',
    borderColor: '#554424',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  resultBadgeText: { color: '#f6c85f', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  resultHeading: { color: '#fff', fontSize: 29, fontWeight: '900', marginBottom: 20, marginTop: 10 },
  resultPoster: {
    backgroundColor: '#171315',
    borderColor: '#392d31',
    borderRadius: 22,
    borderWidth: 1,
  },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  resultTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 18, textAlign: 'center' },
  resultRating: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
  },
  resultRatingText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  resultRatingSource: { color: '#786f72', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  resultActions: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#b41622',
    borderRadius: 18,
    flex: 1.2,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryActionText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: '#201b1d',
    borderColor: '#3a3235',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 50,
  },
  secondaryActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
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
    backgroundColor: '#241b1e',
    borderColor: '#49363b',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 14,
  },
  spinAgainText: {
    color: '#ff9ba0',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
});
