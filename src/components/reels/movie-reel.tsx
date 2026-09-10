import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import YoutubePlayer, { PLAYER_STATES } from 'react-native-youtube-iframe';

import type { Movie } from '../../types/movie';

interface MovieReelProps {
  movie: Movie;
  active: boolean;
  mountVideo: boolean;
  width: number;
  height: number;
  label: string;
  saved?: boolean;
  reviewed?: boolean;
  onSave?: (movie: Movie) => void;
  onReview?: (movie: Movie) => void;
  onDismiss?: (movie: Movie) => void;
  dismissDisabled?: boolean;
}

export function MovieReel({
  movie,
  active,
  mountVideo,
  width,
  height,
  label,
  saved = false,
  reviewed = false,
  onSave,
  onReview,
  onDismiss,
  dismissDisabled = false,
}: MovieReelProps) {
  const [playerError, setPlayerError] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [minimumPosterElapsed, setMinimumPosterElapsed] = useState(false);

  const hasVideo = Boolean(movie.videoKey) && !playerError;
  const playerHeight = Math.max(200, Math.min(width * (9 / 16), height * 0.46));

  useEffect(() => {
    setPlaying(active && playerReady && minimumPosterElapsed);
  }, [active, minimumPosterElapsed, playerReady]);

  useEffect(() => {
    setPlayerError(false);
    setPlayerReady(false);
    setPlaying(false);
  }, [movie.id]);

  useEffect(() => {
    setMinimumPosterElapsed(false);
    if (!mountVideo || !movie.videoKey) {
      return;
    }

    const timer = setTimeout(() => setMinimumPosterElapsed(true), 1000);
    return () => clearTimeout(timer);
  }, [mountVideo, movie.id, movie.videoKey]);

  useEffect(() => {
    if (!mountVideo) {
      setPlayerReady(false);
      setPlaying(false);
    }
  }, [mountVideo]);

  const handlePlayerState = (state: PLAYER_STATES) => {
    if (state === PLAYER_STATES.PLAYING) {
      setPlaying(true);
    }

    if (state === PLAYER_STATES.PAUSED || state === PLAYER_STATES.ENDED) {
      setPlaying(false);
    }
  };
  const showLoadingPoster = hasVideo
    && mountVideo
    && (!playerReady || !minimumPosterElapsed);
  const hasRating = typeof movie.vote_average === 'number' && movie.vote_average > 0;

  return (
    <View style={[styles.container, { width, height }]}>
      <View style={styles.media}>
        {hasVideo && mountVideo ? (
          <>
            <YoutubePlayer
              height={playerHeight}
              width={width}
              videoId={movie.videoKey ?? undefined}
              play={playing}
              onChangeState={handlePlayerState}
              onError={() => setPlayerError(true)}
              onReady={() => setPlayerReady(true)}
              initialPlayerParams={{
                controls: true,
                preventFullScreen: true,
                rel: false,
              }}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
              }}
            />
            {showLoadingPoster ? (
              <View style={styles.loadingPoster}>
                {movie.poster_path ? (
                  <Image
                    blurRadius={1}
                    resizeMode="cover"
                    source={{ uri: `https://image.tmdb.org/t/p/w780${movie.poster_path}` }}
                    style={styles.poster}
                  />
                ) : (
                  <View style={styles.noPoster} />
                )}
                <View style={styles.loadingShade} />
                <View style={styles.loadingContent}>
                  <ActivityIndicator color="#fff" size="large" />
                  <Text style={styles.loadingLabel}>Preparando trailer...</Text>
                </View>
              </View>
            ) : null}
          </>
        ) : movie.poster_path ? (
          <Image
            resizeMode="cover"
            source={{ uri: `https://image.tmdb.org/t/p/w780${movie.poster_path}` }}
            style={styles.poster}
          />
        ) : (
          <View style={styles.noPoster}>
            <Ionicons color="#555" name="film-outline" size={64} />
          </View>
        )}
      </View>

      <View pointerEvents="box-none" style={styles.overlay}>
        <View pointerEvents="box-none" style={styles.topRow}>
          <View style={styles.labelPill}>
            <Text style={styles.label}>{label}</Text>
          </View>
          {onDismiss ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`No me interesa ${movie.title}`}
              disabled={dismissDisabled}
              onPress={() => onDismiss(movie)}
              style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
            >
              <Ionicons name="eye-off-outline" color="#ccc" size={17} />
              <Text style={styles.dismissText}>No me interesa</Text>
            </Pressable>
          ) : null}
        </View>

        <View pointerEvents="box-none" style={styles.bottomRow}>
          <View pointerEvents="none" style={styles.movieInfo}>
            <Text style={styles.title}>{movie.title}</Text>
            {hasRating ? (
              <View style={styles.ratingPill}>
                <Ionicons color="#f6c85f" name="star" size={14} />
                <Text style={styles.ratingText}>{movie.vote_average?.toFixed(1)} / 10</Text>
                <Text style={styles.tmdbLabel}>TMDB</Text>
              </View>
            ) : null}
            {!movie.videoKey || playerError ? (
              <Text style={styles.videoUnavailable}>Trailer no disponible</Text>
            ) : null}
          </View>

          <View pointerEvents="box-none" style={styles.actions}>
            {onSave ? (
              <Pressable
                accessibilityLabel={saved ? 'Quitar película guardada' : 'Guardar película'}
                accessibilityRole="button"
                onPress={() => onSave(movie)}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <Ionicons
                  color={saved ? '#e50914' : '#fff'}
                  name={saved ? 'bookmark' : 'bookmark-outline'}
                  size={30}
                />
                <Text style={styles.actionText}>{saved ? 'Quitar' : 'Guardar'}</Text>
              </Pressable>
            ) : null}

            {onReview ? (
              <Pressable
                accessibilityLabel={reviewed ? 'Película reseñada' : 'Marcar como vista y reseñar'}
                accessibilityRole="button"
                disabled={reviewed}
                onPress={() => onReview(movie)}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <Ionicons
                  color={reviewed ? '#52d273' : '#fff'}
                  name={reviewed ? 'checkmark-circle' : 'star-outline'}
                  size={30}
                />
                <Text style={styles.actionText}>{reviewed ? 'Reseñada' : 'La vi'}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  media: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  poster: {
    height: '100%',
    opacity: 0.72,
    width: '100%',
  },
  noPoster: {
    alignItems: 'center',
    backgroundColor: '#101010',
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
  loadingPoster: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090909',
    zIndex: 3,
  },
  loadingShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  loadingContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  loadingLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingBottom: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dismissButton: {
    alignItems: 'center', flexDirection: 'row', gap: 5, minHeight: 44,
    paddingHorizontal: 10, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.66)',
  },
  dismissText: { color: '#ccc', fontSize: 11, fontWeight: '600' },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
  movieInfo: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    color: '#fff',
    fontSize: 27,
    fontWeight: '800',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  ratingPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.68)',
    borderColor: 'rgba(246,200,95,0.34)',
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ratingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  tmdbLabel: {
    color: '#978e90',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  videoUnavailable: {
    color: '#ffb3b8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
  },
  actions: {
    alignItems: 'center',
    gap: 22,
  },
  actionButton: {
    alignItems: 'center',
    minWidth: 62,
  },
  pressed: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  actionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 5,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
