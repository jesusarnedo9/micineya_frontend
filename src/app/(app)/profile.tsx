import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { FavoriteMovie } from '../../api/movies';
import { logoutFromServer } from '../../api/profile';
import { ReviewComposer } from '../../components/reviews/review-composer';
import { PreferencesPanel } from '../../components/profile/preferences-panel';
import { useAppExperience } from '../../context/app-experience';
import { clearSession } from '../../auth/session';
import type { Movie } from '../../types/movie';
import type { ProfileReview } from '../../types/profile';

type ProfileSection = 'watched' | 'saved';

function favoriteToMovie(favorite: FavoriteMovie): Movie {
  return {
    id: favorite.tmdbId,
    title: favorite.titulo,
    overview: '',
    poster_path: favorite.posterPath,
    videoKey: null,
  };
}

function reviewToMovie(review: ProfileReview): Movie {
  return {
    id: review.tmdbId,
    title: review.title,
    overview: '',
    poster_path: review.posterPath,
    videoKey: null,
  };
}

function formatReviewDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function RatingStars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <View accessibilityLabel={`${rating} de 5 estrellas`} style={styles.ratingStars}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Ionicons
          color={value <= rating ? '#f6c85f' : '#4d4547'}
          key={value}
          name={value <= rating ? 'star' : 'star-outline'}
          size={size}
        />
      ))}
    </View>
  );
}

function WatchedCard({
  onEdit,
  onUnmark,
  review,
  unmarking,
  username,
}: {
  onEdit: () => void;
  onUnmark: () => void;
  review: ProfileReview;
  unmarking: boolean;
  username: string;
}) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewAuthorRow}>
        <View style={styles.miniAvatar}>
          <Text style={styles.miniAvatarText}>{username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.reviewAuthorCopy}>
          <Text style={styles.reviewAuthor}>{username}</Text>
          <Text style={styles.reviewDate}>{formatReviewDate(review.reviewedAt)}</Text>
        </View>
        <View style={styles.reviewActions}>
          <Pressable
            accessibilityLabel={`Editar reseña de ${review.title}`}
            accessibilityRole="button"
            onPress={onEdit}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Ionicons color="#f6c85f" name="create-outline" size={13} />
            <Text style={styles.editButtonText}>Editar</Text>
          </Pressable>
          <View style={styles.watchedBadge}>
            <Ionicons color="#ff7379" name="checkmark" size={13} />
            <Text style={styles.watchedBadgeText}>LA VI</Text>
          </View>
        </View>
      </View>

      <View style={styles.reviewMovieRow}>
        {review.posterPath ? (
          <Image
            resizeMode="cover"
            source={{ uri: `https://image.tmdb.org/t/p/w342${review.posterPath}` }}
            style={styles.reviewPoster}
          />
        ) : (
          <View style={[styles.reviewPoster, styles.posterFallback]}>
            <Ionicons color="#62585b" name="film-outline" size={32} />
          </View>
        )}
        <View style={styles.reviewBody}>
          <Text numberOfLines={2} style={styles.reviewTitle}>{review.title}</Text>
          <RatingStars rating={review.rating} />
          <Text numberOfLines={5} style={review.comment ? styles.reviewText : styles.emptyReviewText}>
            {review.comment || 'Escribí tu reseña.'}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel={`Marcar ${review.title} como no vista`}
        accessibilityRole="button"
        disabled={unmarking}
        onPress={onUnmark}
        style={({ pressed }) => [styles.unmarkButton, pressed && styles.pressed]}
      >
        {unmarking ? (
          <ActivityIndicator color="#b99ca1" size="small" />
        ) : (
          <Ionicons color="#b99ca1" name="arrow-undo-outline" size={15} />
        )}
        <Text style={styles.unmarkText}>
          {unmarking ? 'Quitando...' : 'Marcar como no vista'}
        </Text>
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    favoriteMovies,
    recordReview,
    refreshRecommendations,
    reviewedIds,
    reviews,
    toggleFavorite,
    unmarkAsWatched,
    username,
  } = useAppExperience();
  const [section, setSection] = useState<ProfileSection>('watched');
  const [reviewMovie, setReviewMovie] = useState<Movie | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [unmarkingId, setUnmarkingId] = useState<number | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const posterWidth = Math.max(92, (width - 64) / 3);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    try {
      try {
        await logoutFromServer();
      } catch {
        // El cierre local debe funcionar incluso si el servidor está temporalmente caído.
      }
      await clearSession();
      router.replace('/(auth)/login');
    } finally {
      setLoggingOut(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Querés salir de MiCineYa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => void handleLogout(),
        },
      ],
    );
  };

  const handleSavedPress = (favorite: FavoriteMovie) => {
    if (reviewedIds.has(favorite.tmdbId)) {
      setSection('watched');
      return;
    }
    setReviewMovie(favoriteToMovie(favorite));
  };

  const handleRemove = async (favorite: FavoriteMovie) => {
    if (removingId !== null) {
      return;
    }

    setRemovingId(favorite.tmdbId);
    try {
      await toggleFavorite(favoriteToMovie(favorite));
    } catch {
      Alert.alert('No se pudo quitar', 'Intentá nuevamente en unos segundos.');
    } finally {
      setRemovingId(null);
    }
  };

  const confirmUnmark = (review: ProfileReview) => {
    Alert.alert(
      'Marcar como no vista',
      `Se eliminarán tu puntuación y reseña de “${review.title}”.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar como no vista',
          style: 'destructive',
          onPress: () => {
            setUnmarkingId(review.tmdbId);
            void unmarkAsWatched(review.tmdbId)
              .catch(() => {
                Alert.alert('No se pudo actualizar', 'Intentá nuevamente en unos segundos.');
              })
              .finally(() => setUnmarkingId(null));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroOrbLarge} />
          <View style={styles.heroOrbSmall} />
          <View style={styles.heroTopRow}>
            <Text style={styles.heroEyebrow}>MI CINE</Text>
            <Pressable
              accessibilityLabel="Cerrar sesión"
              accessibilityRole="button"
              disabled={loggingOut}
              onPress={confirmLogout}
              style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
            >
              {loggingOut ? (
                <ActivityIndicator color="#ff9ba0" size="small" />
              ) : (
                <Ionicons color="#ff9ba0" name="log-out-outline" size={17} />
              )}
              <Text style={styles.logoutText}>{loggingOut ? 'Saliendo...' : 'Salir'}</Text>
            </Pressable>
          </View>

          <View style={styles.identityRow}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.identityCopy}>
              <Text style={styles.welcome}>Tu cine personal</Text>
              <Text numberOfLines={1} style={styles.username}>{username}</Text>
            </View>
            <View style={styles.profileMark}>
              <Ionicons color="#ff7b80" name="film" size={21} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{reviews.length}</Text>
              <Text style={styles.statLabel}>Vistas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{favoriteMovies.length}</Text>
              <Text style={styles.statLabel}>Guardadas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {reviews.filter((review) => review.comment.length > 0).length}
              </Text>
              <Text style={styles.statLabel}>Reseñas</Text>
            </View>
          </View>
        </View>

        <PreferencesPanel onSaved={refreshRecommendations} />

        <View style={styles.sectionSwitcher}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: section === 'watched' }}
            onPress={() => setSection('watched')}
            style={[styles.sectionButton, section === 'watched' && styles.sectionButtonActive]}
          >
            <Ionicons
              color={section === 'watched' ? '#fff' : '#80777a'}
              name="eye-outline"
              size={18}
            />
            <Text style={[styles.sectionButtonText, section === 'watched' && styles.sectionButtonTextActive]}>
              Vistas
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: section === 'saved' }}
            onPress={() => setSection('saved')}
            style={[styles.sectionButton, section === 'saved' && styles.sectionButtonActive]}
          >
            <Ionicons
              color={section === 'saved' ? '#fff' : '#80777a'}
              name="bookmark-outline"
              size={18}
            />
            <Text style={[styles.sectionButtonText, section === 'saved' && styles.sectionButtonTextActive]}>
              Guardadas
            </Text>
          </Pressable>
        </View>

        {section === 'watched' ? (
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>TU HISTORIAL</Text>
                <Text style={styles.sectionTitle}>Películas que ya viste</Text>
              </View>
              <Ionicons color="#5c5154" name="albums-outline" size={23} />
            </View>

            {reviews.length > 0 ? (
              reviews.map((review) => (
                <WatchedCard
                  key={review.tmdbId}
                  onEdit={() => setReviewMovie(reviewToMovie(review))}
                  onUnmark={() => confirmUnmark(review)}
                  review={review}
                  unmarking={unmarkingId === review.tmdbId}
                  username={username}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons color="#ff7379" name="ticket-outline" size={34} />
                </View>
                <Text style={styles.emptyTitle}>Tu historia empieza con una película</Text>
                <Text style={styles.emptyText}>
                  En cualquier reel tocá “La vi”, puntuá la película y va a aparecer acá.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.sectionContent}>
            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionEyebrow}>Pelis pendientes!!</Text>
                <Text style={styles.sectionTitle}>Tu biblioteca</Text>
              </View>
              <Text style={styles.savedCount}>{favoriteMovies.length}</Text>
            </View>

            {favoriteMovies.length > 0 ? (
              <View style={styles.posterGrid}>
                {favoriteMovies.map((favorite) => {
                  const watched = reviewedIds.has(favorite.tmdbId);
                  return (
                    <View key={favorite.tmdbId} style={{ width: posterWidth }}>
                      <Pressable
                        accessibilityLabel={
                          watched
                            ? `${favorite.titulo}, ya vista`
                            : `${favorite.titulo}, marcar como vista`
                        }
                        onPress={() => handleSavedPress(favorite)}
                        style={({ pressed }) => [styles.posterCard, pressed && styles.pressed]}
                      >
                        {favorite.posterPath ? (
                          <Image
                            resizeMode="cover"
                            source={{ uri: `https://image.tmdb.org/t/p/w342${favorite.posterPath}` }}
                            style={[styles.savedPoster, { height: posterWidth * 1.48 }]}
                          />
                        ) : (
                          <View
                            style={[
                              styles.savedPoster,
                              styles.posterFallback,
                              { height: posterWidth * 1.48 },
                            ]}
                          >
                            <Ionicons color="#62585b" name="film-outline" size={32} />
                          </View>
                        )}
                        <View style={styles.posterShade} />
                        <View style={[styles.watchPill, watched && styles.watchedPill]}>
                          <Ionicons
                            color="#fff"
                            name={watched ? 'checkmark' : 'eye-outline'}
                            size={12}
                          />
                          <Text style={styles.watchPillText}>{watched ? 'VISTA' : 'LA VI'}</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Quitar ${favorite.titulo} de guardadas`}
                        disabled={removingId !== null}
                        hitSlop={6}
                        onPress={() => void handleRemove(favorite)}
                        style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                      >
                        {removingId === favorite.tmdbId ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Ionicons color="#fff" name="bookmark" size={17} />
                        )}
                      </Pressable>
                      <Text numberOfLines={2} style={styles.savedTitle}>{favorite.titulo}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons color="#ff7379" name="bookmark-outline" size={34} />
                </View>
                <Text style={styles.emptyTitle}>Guardá candidatas para después</Text>
                <Text style={styles.emptyText}>
                  Usá el marcador de cualquier reel y armá acá tu propia cartelera.
                </Text>
              </View>
            )}
          </View>
        )}
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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#080608',
    flex: 1,
  },
  content: {
    paddingBottom: 42,
  },
  hero: {
    backgroundColor: '#220b10',
    borderBottomColor: '#4a1720',
    borderBottomWidth: 1,
    overflow: 'hidden',
    paddingBottom: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
  },
  heroOrbLarge: {
    backgroundColor: '#5b1520',
    borderRadius: 110,
    height: 220,
    position: 'absolute',
    right: -90,
    top: -100,
    width: 220,
  },
  heroOrbSmall: {
    backgroundColor: '#341016',
    borderRadius: 70,
    bottom: -70,
    height: 140,
    left: -44,
    position: 'absolute',
    width: 140,
  },
  heroEyebrow: {
    color: '#ff7b80',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  heroTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderColor: 'rgba(255,155,160,0.25)',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 11,
  },
  logoutText: {
    color: '#ff9ba0',
    fontSize: 11,
    fontWeight: '900',
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 18,
  },
  avatarRing: {
    alignItems: 'center',
    borderColor: '#ff626a',
    borderRadius: 38,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    width: 76,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#e51b2a',
    borderRadius: 31,
    height: 62,
    justifyContent: 'center',
    width: 62,
  },
  avatarText: {
    color: '#fff',
    fontSize: 29,
    fontWeight: '900',
  },
  identityCopy: {
    flex: 1,
    marginLeft: 15,
  },
  welcome: {
    color: '#c79fa4',
    fontSize: 12,
    fontWeight: '700',
  },
  username: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  profileMark: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  statsRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 22,
    paddingVertical: 13,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
  },
  statLabel: {
    color: '#b88f95',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statDivider: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    height: 30,
    width: 1,
  },
  sectionSwitcher: {
    backgroundColor: '#120f11',
    borderColor: '#2b2527',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginHorizontal: 18,
    marginTop: 18,
    padding: 4,
  },
  sectionButton: {
    alignItems: 'center',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },
  sectionButtonActive: {
    backgroundColor: '#9f1320',
  },
  sectionButtonText: {
    color: '#80777a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sectionButtonTextActive: {
    color: '#fff',
  },
  sectionContent: {
    paddingHorizontal: 18,
    paddingTop: 25,
  },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionEyebrow: {
    color: '#a79da0',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 3,
  },
  savedCount: {
    color: '#ff7b80',
    fontSize: 24,
    fontWeight: '900',
  },
  reviewCard: {
    backgroundColor: '#121012',
    borderColor: '#2b2527',
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
    padding: 15,
  },
  reviewAuthorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 13,
  },
  miniAvatar: {
    alignItems: 'center',
    backgroundColor: '#8f1320',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  miniAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  reviewAuthorCopy: {
    flex: 1,
    marginLeft: 9,
  },
  reviewAuthor: {
    color: '#f4eff0',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewDate: {
    color: '#746b6e',
    fontSize: 10,
    marginTop: 1,
  },
  watchedBadge: {
    alignItems: 'center',
    backgroundColor: '#2b1217',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  reviewActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: '#282116',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  editButtonText: {
    color: '#f6c85f',
    fontSize: 9,
    fontWeight: '900',
  },
  watchedBadgeText: {
    color: '#ff7379',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  reviewMovieRow: {
    flexDirection: 'row',
  },
  reviewPoster: {
    backgroundColor: '#201b1d',
    borderRadius: 12,
    height: 135,
    width: 91,
  },
  posterFallback: {
    alignItems: 'center',
    backgroundColor: '#1c181a',
    justifyContent: 'center',
  },
  reviewBody: {
    flex: 1,
    marginLeft: 14,
    paddingVertical: 3,
  },
  unmarkButton: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderColor: '#3a3033',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    marginTop: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  unmarkText: {
    color: '#b99ca1',
    fontSize: 10,
    fontWeight: '800',
  },
  reviewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
    marginBottom: 7,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    color: '#d0c8ca',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: 10,
  },
  emptyReviewText: {
    color: '#756c6f',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  posterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  posterCard: {
    backgroundColor: '#1b1719',
    borderRadius: 12,
    overflow: 'hidden',
  },
  savedPoster: {
    backgroundColor: '#1c181a',
    width: '100%',
  },
  posterShade: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    bottom: 0,
    height: 48,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  watchPill: {
    alignItems: 'center',
    backgroundColor: '#a20f1c',
    borderRadius: 10,
    bottom: 8,
    flexDirection: 'row',
    gap: 4,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    position: 'absolute',
  },
  watchedPill: {
    backgroundColor: '#246241',
  },
  watchPillText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(18,8,10,0.88)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    right: 7,
    top: 7,
    width: 30,
  },
  savedTitle: {
    color: '#d8d0d2',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
    marginTop: 7,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#110f10',
    borderColor: '#30292b',
    borderRadius: 22,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingHorizontal: 26,
    paddingVertical: 36,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: '#2a1116',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyText: {
    color: '#837a7c',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.97 }],
  },
});
