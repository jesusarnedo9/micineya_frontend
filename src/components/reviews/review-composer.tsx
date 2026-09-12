import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { describeApiError } from '../../api/errors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { submitReview } from '../../api/reviews';
import { ensureCommunityParticipation } from '../community/community-rules';
import { mediaTypeOf, type Movie } from '../../types/movie';
import { fetchSeasons, type Season } from '../../api/series';
import type { ProfileReview } from '../../types/profile';

interface ReviewComposerProps {
  movie: Movie | null;
  existingReview?: ProfileReview | null;
  existingReviews?: ProfileReview[];
  onClose: () => void;
  onSubmitted: (review: ProfileReview) => void | Promise<void>;
}

const RATING_LABELS = ['', 'Mala', 'Floja', 'Buena', 'Muy buena', 'Excelente'];

export function ReviewComposer({
  movie,
  existingReview = null,
  existingReviews = [],
  onClose,
  onSubmitted,
}: ReviewComposerProps) {
  const insets = useSafeAreaInsets();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSeries = mediaTypeOf(movie) === 'tv';
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [seasonsAttempt, setSeasonsAttempt] = useState(0);
  const activeReview = isSeries ? existingReviews.find((review) =>
    (review.seasonNumber ?? (review.seasonsWatched?.length === 1 ? review.seasonsWatched[0] : undefined)) === selectedSeason)
    ?? (existingReview && (existingReview.seasonNumber ?? existingReview.seasonsWatched?.[0]) === selectedSeason ? existingReview : null)
    : existingReview;
  const cannotSubmit = rating === 0 || submitting || (isSeries && selectedSeason === null);

  useEffect(() => {
    const initialSeason = isSeries
      ? existingReview?.seasonNumber ?? (existingReview?.seasonsWatched?.length === 1 ? existingReview.seasonsWatched[0] : null)
      : null;
    setSelectedSeason(initialSeason);
    const initial = isSeries ? (initialSeason ? existingReview : null) : existingReview;
    setRating(initial?.rating ?? 0);
    setComment(initial?.comment ?? '');
    setSpoiler(initial?.spoiler ?? false);
    setErrorMessage(null);
    setSubmitting(false);
  }, [existingReview, movie?.id, isSeries]);

  useEffect(() => {
    if (!isSeries) return;
    setRating(activeReview?.rating ?? 0);
    setComment(activeReview?.comment ?? '');
    setSpoiler(activeReview?.spoiler ?? false);
    setErrorMessage(null);
  }, [activeReview?.id, isSeries, selectedSeason]);

  useEffect(() => {
    let active = true;
    setSeasons([]); setSeasonsError(null); setSeasonsLoading(false);
    if (!movie || !isSeries) return;
    setSeasonsLoading(true);
    void fetchSeasons(movie.id).then((items) => { if (active) setSeasons(items); })
      .catch((error) => { if (active) setSeasonsError(describeApiError(error).message); })
      .finally(() => { if (active) setSeasonsLoading(false); });
    return () => { active = false; };
  }, [movie?.id, isSeries, seasonsAttempt]);

  const reviewedSeasons = existingReviews.flatMap((review) => review.seasonsWatched ?? (review.seasonNumber ? [review.seasonNumber] : []));
  if (existingReview) reviewedSeasons.push(...(existingReview.seasonsWatched ?? (existingReview.seasonNumber ? [existingReview.seasonNumber] : [])));
  const availableSeasons = Array.from(new Map([...seasons, ...reviewedSeasons
    .filter((n) => !seasons.some((s) => s.numero === n))
    .map((n) => ({ numero: n, nombre: `Temporada ${n}`, cantidadEpisodios: null, estreno: null }))]
    .map((season) => [season.numero, season])).values())
    .sort((a, b) => a.numero - b.numero);

  const handleSubmit = async () => {
    if (!movie || cannotSubmit) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      if (!await ensureCommunityParticipation()) return;
      const savedReview = await submitReview(movie, rating, comment, spoiler, isSeries && selectedSeason ? [selectedSeason] : []);
      await onSubmitted(savedReview);
      onClose();
    } catch (error) {
      setErrorMessage(describeApiError(error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={submitting ? undefined : onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={movie !== null}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="Cerrar reseña"
          disabled={submitting}
          onPress={onClose}
          style={styles.backdrop}
        />

        <ScrollView style={{ maxHeight: '90%' }} contentContainerStyle={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]} keyboardShouldPersistTaps="handled">
          <View style={styles.handle} />

          <View style={styles.movieHeader}>
            {movie?.poster_path ? (
              <Image
                resizeMode="cover"
                source={{ uri: `https://image.tmdb.org/t/p/w185${movie.poster_path}` }}
                style={styles.poster}
              />
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Ionicons color="#666" name="film-outline" size={28} />
              </View>
            )}
            <View style={styles.movieCopy}>
              <Text style={styles.eyebrow}>{activeReview ? 'EDITAR RESEÑA' : 'LA VISTE'}</Text>
              <Text numberOfLines={2} style={styles.title}>{movie?.title}</Text>
              <Text style={styles.subtitle}>Puntuá {isSeries ? 'una temporada' : 'la película'} y contá qué te pareció.</Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar"
              disabled={submitting}
              hitSlop={12}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons color="#ddd" name="close" size={24} />
            </Pressable>
          </View>

          {isSeries && <View style={styles.seasonsBlock}>
            <Text style={styles.inputLabel}>¿Qué temporada terminaste?</Text>
            {seasonsLoading && <ActivityIndicator color="#ff9ba0" style={{ marginTop: 10 }} />}
            {seasonsError && <View>
              <Text style={styles.error}>{seasonsError}</Text>
              <Pressable accessibilityRole="button" disabled={submitting} onPress={() => setSeasonsAttempt((v) => v + 1)} style={styles.seasonChip}>
                <Text style={styles.secondaryText}>Reintentar temporadas</Text>
              </Pressable>
            </View>}
            <View style={styles.seasonList}>{availableSeasons.map((season) => {
              const selected = selectedSeason === season.numero;
              const alreadySeen = reviewedSeasons.includes(season.numero);
              const unavailable = !alreadySeen && (season.cantidadEpisodios === 0
                || !!season.estreno && season.estreno > new Date().toISOString().slice(0, 10));
              return <Pressable key={season.numero} accessibilityRole="radio"
                accessibilityLabel={`Temporada ${season.numero}${unavailable ? ', no disponible aún' : ''}`}
                accessibilityState={{ checked: selected, disabled: submitting || unavailable }}
                disabled={submitting || unavailable}
                onPress={() => { setSelectedSeason(season.numero); setErrorMessage(null); }}
                style={[styles.seasonChip, selected && styles.seasonSelected, unavailable && styles.disabled]}>
                <Text style={styles.secondaryText}>{selected ? '✓ ' : ''}T{season.numero}</Text>
              </Pressable>;
            })}</View>
            {!seasonsLoading && !seasonsError && availableSeasons.length === 0
              && <Text style={styles.subtitle}>Todavía no hay temporadas regulares para marcar.</Text>}
            {selectedSeason === null && <Text style={styles.subtitle}>Elegí una temporada completa.</Text>}
          </View>}

          <Text style={styles.question}>¿Cuántas estrellas le das?</Text>
          <View accessibilityRole="radiogroup" style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                accessibilityLabel={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: rating === value }}
                key={value}
                disabled={submitting}
                onPress={() => {
                  setRating(value);
                  setErrorMessage(null);
                }}
                style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
              >
                <Ionicons
                  color={value <= rating ? '#ffc83d' : '#555'}
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={38}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingLabel}>
            {rating > 0 ? RATING_LABELS[rating] : 'Elegí de 1 a 5'}
          </Text>

          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>Tu reseña</Text>
            <Text style={styles.counter}>{comment.length}/500</Text>
          </View>
          <TextInput
            accessibilityLabel="Escribir reseña"
            editable={!submitting}
            maxLength={500}
            multiline
            onChangeText={(value) => {
              setComment(value);
              setErrorMessage(null);
            }}
            placeholder="Opcional: ¿qué te gustó o qué no te convenció?"
            placeholderTextColor="#666"
            style={styles.input}
            textAlignVertical="top"
            value={comment}
          />

          <View style={styles.inputHeader}>
            <Text style={styles.inputLabel}>Mi reseña contiene spoilers</Text>
            <Switch accessibilityLabel="Mi reseña contiene spoilers" value={spoiler} onValueChange={setSpoiler} disabled={submitting} trackColor={{ true: '#a51a27', false: '#444' }} />
          </View>
          <Text style={styles.subtitle}>Puntuaciones y reseñas públicas en Comunidad. Tus guardadas siguen siendo privadas.</Text>
          {activeReview?.hiddenByModeration && <Text style={styles.error}>Oculta por moderación. Editarla no vuelve a publicarla automáticamente.</Text>}
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <View style={styles.actions}>
            <Pressable
              disabled={submitting}
              onPress={onClose}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Ahora no</Text>
            </Pressable>
            <Pressable
              disabled={cannotSubmit}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.primaryButton,
                cannotSubmit && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons color="#fff" name="send" size={17} />
              )}
              <Text style={styles.primaryText}>
                {submitting
                  ? 'Guardando...'
                  : activeReview ? 'Guardar cambios' : 'Publicar reseña'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  seasonsBlock: { marginTop: 18 },
  seasonList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  seasonChip: { minWidth: 54, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#514047',
    paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  seasonSelected: { backgroundColor: '#941723', borderColor: '#ed7580' },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#151515',
    borderColor: '#2d2d2d',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#555',
    borderRadius: 3,
    height: 5,
    marginBottom: 18,
    width: 44,
  },
  movieHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  poster: {
    backgroundColor: '#222',
    borderRadius: 10,
    height: 78,
    width: 52,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  movieCopy: {
    flex: 1,
    marginLeft: 14,
  },
  eyebrow: {
    color: '#e50914',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  subtitle: {
    color: '#999',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: '#292929',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    marginLeft: 10,
    width: 36,
  },
  question: {
    color: '#eee',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 22,
    textAlign: 'center',
  },
  stars: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 10,
  },
  starButton: {
    padding: 3,
  },
  ratingLabel: {
    color: '#ffc83d',
    fontSize: 12,
    fontWeight: '800',
    height: 18,
    textAlign: 'center',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 16,
  },
  inputLabel: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '800',
  },
  counter: {
    color: '#777',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#202020',
    borderColor: '#363636',
    borderRadius: 14,
    borderWidth: 1,
    color: '#fff',
    fontSize: 14,
    height: 104,
    lineHeight: 20,
    padding: 13,
  },
  error: {
    color: '#ff8e95',
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#3b3b3b',
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '800',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#e50914',
    borderRadius: 24,
    flex: 1.35,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
