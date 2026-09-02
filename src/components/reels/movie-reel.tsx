import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import YoutubePlayer, {
  PLAYER_STATES,
  YoutubeIframeRef,
} from 'react-native-youtube-iframe';

import type { Movie } from '../../types/movie';

interface MovieReelProps {
  movie: Movie;
  active: boolean;
  mountVideo: boolean;
  width: number;
  height: number;
  muted: boolean;
  label: string;
  saved?: boolean;
  reviewed?: boolean;
  onToggleMuted: () => void;
  onSave?: (movie: Movie) => void;
  onReview?: (movie: Movie) => void;
}

export function MovieReel({
  movie,
  active,
  mountVideo,
  width,
  height,
  muted,
  label,
  saved = false,
  reviewed = false,
  onToggleMuted,
  onSave,
  onReview,
}: MovieReelProps) {
  const playerRef = useRef<YoutubeIframeRef | null>(null);
  const [paused, setPaused] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [playerStarted, setPlayerStarted] = useState(false);
  const [playRequested, setPlayRequested] = useState(false);

  const hasVideo = Boolean(movie.videoKey) && !playerError;
  const playerHeight = Math.max(200, Math.min(width * (9 / 16), height * 0.46));
  const playerTop = (height - playerHeight) / 2;

  useEffect(() => {
    if (!active) {
      setPaused(false);
      setPlayRequested(false);
    } else if (playerReady) {
      setPlayRequested(true);
    }
  }, [active, playerReady]);

  useEffect(() => {
    setPlayerError(false);
    setPlayerReady(false);
    setPlayerStarted(false);
    setPlayRequested(false);
    setPaused(false);
  }, [movie.id]);

  useEffect(() => {
    if (!mountVideo) {
      setPlayerReady(false);
      setPlayerStarted(false);
      setPlayRequested(false);
    }
  }, [mountVideo]);

  const handlePlayerState = (state: PLAYER_STATES) => {
    if (state === PLAYER_STATES.PLAYING) {
      setPlayerStarted(true);
      setPaused(false);
    }

    if (state === PLAYER_STATES.PAUSED && playerStarted) {
      setPaused(true);
    }

    if (state === PLAYER_STATES.ENDED && active) {
      playerRef.current?.seekTo(0, true);
    }
  };

  const handlePlaybackPress = () => {
    if (!active || !hasVideo || !playerReady) {
      return;
    }

    if (playerStarted && !paused) {
      setPaused(true);
      return;
    }

    setPaused(false);

    if (playRequested) {
      setPlayRequested(false);
      requestAnimationFrame(() => setPlayRequested(true));
    } else {
      setPlayRequested(true);
    }
  };

  const needsPlayButton = active
    && hasVideo
    && mountVideo
    && playerReady
    && (!playerStarted || paused);

  return (
    <View style={[styles.container, { width, height }]}>
      <View pointerEvents="none" style={styles.media}>
        {hasVideo && mountVideo ? (
          <>
            <YoutubePlayer
              ref={playerRef}
              height={playerHeight}
              width={width}
              videoId={movie.videoKey ?? undefined}
              play={active && playRequested && !paused}
              mute={muted}
              volume={100}
              forceAndroidAutoplay={Platform.OS === 'android'}
              onChangeState={handlePlayerState}
              onError={() => setPlayerError(true)}
              onReady={() => {
                setPlayerReady(true);
                if (active) {
                  setPlayRequested(true);
                }
              }}
              initialPlayerParams={{
                controls: false,
                end: 60,
                loop: true,
                preventFullScreen: true,
                rel: false,
              }}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
              }}
            />
            <View style={[styles.youtubeTopMask, { top: playerTop, width }]} />
            <View
              style={[
                styles.youtubeBottomMask,
                { top: playerTop + playerHeight - 48, width },
              ]}
            />
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
        <View pointerEvents="none" style={styles.topRow}>
          <View style={styles.labelPill}>
            <Text style={styles.label}>{label}</Text>
          </View>
          {paused && playerStarted ? (
            <View style={styles.pausedPill}>
              <Ionicons color="#fff" name="pause" size={14} />
              <Text style={styles.pausedText}>Pausado</Text>
            </View>
          ) : null}
        </View>

        {needsPlayButton ? (
          <View pointerEvents="box-none" style={styles.playLayer}>
            <Pressable
              accessibilityLabel={playerStarted ? 'Reanudar trailer' : 'Reproducir trailer'}
              accessibilityRole="button"
              onPress={handlePlaybackPress}
              style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
            >
              <Ionicons color="#fff" name="play" size={38} />
            </Pressable>
          </View>
        ) : null}

        <View pointerEvents="box-none" style={styles.bottomRow}>
          <View pointerEvents="none" style={styles.movieInfo}>
            <Text style={styles.title}>{movie.title}</Text>
            <Text numberOfLines={3} style={styles.overview}>
              {movie.overview || 'Sin descripción disponible.'}
            </Text>
            {!movie.videoKey || playerError ? (
              <Text style={styles.videoUnavailable}>Trailer no disponible</Text>
            ) : needsPlayButton ? (
              <Text style={styles.startHint}>Tocá ▶ para reproducir el trailer</Text>
            ) : (
              <Text style={styles.tapHint}>Usá el control lateral para pausar</Text>
            )}
          </View>

          <View pointerEvents="box-none" style={styles.actions}>
            <Pressable
              accessibilityLabel={muted ? 'Activar sonido' : 'Silenciar'}
              accessibilityRole="button"
              onPress={onToggleMuted}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <Ionicons
                color="#fff"
                name={muted ? 'volume-mute' : 'volume-high'}
                size={30}
              />
              <Text style={styles.actionText}>{muted ? 'Sonido' : 'Silenciar'}</Text>
            </Pressable>

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

            {hasVideo && mountVideo ? (
              <Pressable
                accessibilityLabel={paused || !playerStarted ? 'Reproducir trailer' : 'Pausar trailer'}
                accessibilityRole="button"
                disabled={!playerReady}
                onPress={handlePlaybackPress}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              >
                <Ionicons
                  color={playerReady ? '#fff' : '#777'}
                  name={paused || !playerStarted ? 'play' : 'pause'}
                  size={30}
                />
                <Text style={styles.actionText}>
                  {paused || !playerStarted ? 'Reproducir' : 'Pausar'}
                </Text>
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
  youtubeTopMask: {
    backgroundColor: 'rgba(0,0,0,0.92)',
    height: 38,
    left: 0,
    position: 'absolute',
  },
  youtubeBottomMask: {
    backgroundColor: 'rgba(0,0,0,0.96)',
    height: 48,
    left: 0,
    position: 'absolute',
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
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  pausedPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.86)',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pausedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  playLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(229, 9, 20, 0.94)',
    borderColor: 'rgba(255,255,255,0.42)',
    borderRadius: 42,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    paddingLeft: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.42,
    shadowRadius: 10,
    width: 84,
  },
  playButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.94 }],
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
  overview: {
    color: '#eee',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  tapHint: {
    color: '#bbb',
    fontSize: 12,
    marginTop: 10,
  },
  startHint: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 10,
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
