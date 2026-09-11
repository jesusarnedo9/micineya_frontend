import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { describeApiError } from '../../api/errors';
import { searchMovies } from '../../api/movies';
import { ReviewComposer } from '../../components/reviews/review-composer';
import { formatPlatforms } from '../../components/reels/provider-label';
import { useAppExperience } from '../../context/app-experience';
import { contentKey, type Movie } from '../../types/movie';

function SearchResult({ movie, watched, onReview }: {
  movie: Movie;
  watched: boolean;
  onReview: () => void;
}) {
  const year = movie.release_date?.slice(0, 4);
  const platform = formatPlatforms(movie.plataformas);
  const rating = typeof movie.vote_average === 'number' && movie.vote_average > 0
    ? movie.vote_average.toFixed(1)
    : null;

  return <View style={styles.resultCard}>
    {movie.poster_path ? <Image resizeMode="cover"
      source={{ uri: `https://image.tmdb.org/t/p/w342${movie.poster_path}` }} style={styles.poster} />
      : <View style={[styles.poster, styles.posterFallback]}><Ionicons color="#63585b" name="film-outline" size={32} /></View>}
    <View style={styles.resultBody}>
      <View>
        <Text numberOfLines={2} style={styles.movieTitle}>{movie.title}</Text>
        {year ? <Text style={styles.year}>{year}</Text> : null}
      </View>
      <View style={styles.metadata}>
        {rating ? <View style={styles.pill}>
          <Ionicons color="#f6c85f" name="star" size={13} />
          <Text style={styles.pillText}>{rating}</Text>
        </View> : null}
        {platform ? <View style={[styles.pill, styles.platformPill]}>
          <Ionicons color="#ff9ba0" name="play-circle-outline" size={13} />
          <Text numberOfLines={1} style={styles.pillText}>{platform}</Text>
          <Text style={styles.providerSource}>JUSTWATCH</Text>
        </View> : null}
      </View>
      <Pressable accessibilityRole="button"
        accessibilityLabel={watched ? `${movie.title}, ya vista` : `Marcar ${movie.title} como vista`}
        disabled={watched} onPress={onReview}
        style={({ pressed }) => [styles.watchedButton, watched && styles.alreadyWatched, pressed && styles.pressed]}>
        <Ionicons color="#fff" name={watched ? 'checkmark' : 'eye-outline'} size={17} />
        <Text style={styles.watchedText}>{watched ? 'Vista' : 'La vi'}</Text>
      </Pressable>
    </View>
  </View>;
}

export default function MovieSearchScreen() {
  const router = useRouter();
  const { recordReview, reviewedIds, reviews } = useAppExperience();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewMovie, setReviewMovie] = useState<Movie | null>(null);

  const runSearch = async () => {
    const term = query.trim();
    if (term.length < 2 || loading) return;
    Keyboard.dismiss();
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      setResults(await searchMovies(term));
    } catch (failure) {
      setResults([]);
      setError(describeApiError(failure).message);
    } finally {
      setLoading(false);
    }
  };

  return <SafeAreaView edges={['top']} style={styles.screen}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="Volver" accessibilityRole="button" hitSlop={10}
        onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
        <Ionicons color="#fff" name="arrow-back" size={24} />
      </Pressable>
      <Text style={styles.heading}>Buscar películas</Text>
    </View>
    <View style={styles.searchRow}>
      <View style={styles.inputShell}>
        <Ionicons color="#8d8285" name="search" size={20} />
        <TextInput accessibilityLabel="Buscar película" autoCapitalize="none" autoCorrect={false}
          autoFocus maxLength={80} onChangeText={(value) => { setQuery(value); setError(null); }}
          onSubmitEditing={() => void runSearch()} placeholder="Título de la película"
          placeholderTextColor="#776d70" returnKeyType="search" style={styles.input} value={query} />
        {query.length > 0 ? <Pressable accessibilityLabel="Borrar búsqueda" hitSlop={8}
          onPress={() => { setQuery(''); setResults([]); setSearched(false); setError(null); }}>
          <Ionicons color="#8d8285" name="close-circle" size={20} />
        </Pressable> : null}
      </View>
      <Pressable accessibilityLabel="Buscar" accessibilityRole="button"
        accessibilityState={{ disabled: query.trim().length < 2 || loading, busy: loading }}
        disabled={query.trim().length < 2 || loading} onPress={() => void runSearch()}
        style={({ pressed }) => [styles.submitButton, (query.trim().length < 2 || loading) && styles.disabled, pressed && styles.pressed]}>
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons color="#fff" name="search" size={21} />}
      </Pressable>
    </View>

    <FlatList contentContainerStyle={styles.results} data={results}
      keyboardShouldPersistTaps="handled" keyExtractor={(movie) => String(movie.id)}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListEmptyComponent={!loading && searched ? <Text style={error ? styles.error : styles.empty}>
        {error ?? 'No encontramos esa película.'}
      </Text> : null}
      renderItem={({ item }) => <SearchResult movie={item} watched={reviewedIds.has(contentKey(item))}
        onReview={() => setReviewMovie(item)} />} />

    <ReviewComposer existingReview={reviewMovie
      ? reviews.find((review) => contentKey(review) === contentKey(reviewMovie)) ?? null : null}
      movie={reviewMovie} onClose={() => setReviewMovie(null)} onSubmitted={recordReview} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#090708', flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 18, paddingTop: 8 },
  backButton: {
    alignItems: 'center', backgroundColor: '#211a1c', borderRadius: 20, height: 40,
    justifyContent: 'center', width: 40,
  },
  heading: { color: '#fff', fontSize: 24, fontWeight: '900' },
  searchRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 18, paddingTop: 18 },
  inputShell: {
    alignItems: 'center', backgroundColor: '#181416', borderColor: '#3a2b30', borderRadius: 17,
    borderWidth: 1, flex: 1, flexDirection: 'row', gap: 9, minHeight: 50, paddingHorizontal: 14,
  },
  input: { color: '#fff', flex: 1, fontSize: 16, minHeight: 48, paddingVertical: 0 },
  submitButton: {
    alignItems: 'center', backgroundColor: '#b2162a', borderRadius: 17, height: 50,
    justifyContent: 'center', width: 50,
  },
  results: { flexGrow: 1, padding: 18, paddingBottom: 36 },
  resultCard: {
    backgroundColor: '#151214', borderColor: '#30262a', borderRadius: 18, borderWidth: 1,
    flexDirection: 'row', minHeight: 146, overflow: 'hidden', padding: 10,
  },
  poster: { backgroundColor: '#201b1d', borderRadius: 11, height: 126, width: 84 },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  resultBody: { flex: 1, justifyContent: 'space-between', marginLeft: 13, paddingVertical: 2 },
  movieTitle: { color: '#fff', fontSize: 17, fontWeight: '900', lineHeight: 21 },
  year: { color: '#8f8588', fontSize: 12, marginTop: 3 },
  metadata: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    alignItems: 'center', backgroundColor: '#211d18', borderRadius: 12, flexDirection: 'row',
    gap: 4, maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 5,
  },
  platformPill: { backgroundColor: '#2b171c' },
  pillText: { color: '#e8e1e3', flexShrink: 1, fontSize: 10, fontWeight: '800' },
  providerSource: { color: '#7f7276', fontSize: 6, fontWeight: '900', letterSpacing: 0.4 },
  watchedButton: {
    alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#b2162a', borderRadius: 13,
    flexDirection: 'row', gap: 6, minHeight: 37, paddingHorizontal: 13,
  },
  alreadyWatched: { backgroundColor: '#265e42' },
  watchedText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  empty: { color: '#8f8588', fontSize: 14, marginTop: 42, textAlign: 'center' },
  error: { color: '#ff9ca4', fontSize: 14, marginTop: 42, textAlign: 'center' },
});
