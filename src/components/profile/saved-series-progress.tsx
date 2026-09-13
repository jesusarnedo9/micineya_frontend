import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchCachedSeasons, type Season } from '../../api/series';
import { type FavoriteMovie } from '../../api/movies';
import { mediaTypeOf } from '../../types/movie';
import { type ProfileReview } from '../../types/profile';

export function useSavedSeriesProgress(favorites: FavoriteMovie[], enabled: boolean) {
  const focused = useIsFocused();
  const ids = favorites.filter((f) => mediaTypeOf(f) === 'tv').map((f) => f.tmdbId).sort((a, b) => a - b).join(',');
  const [catalogs, setCatalogs] = useState<Record<number, Season[]>>({});
  useEffect(() => {
    if (!enabled || !focused || !ids) return;
    let cancelled = false;
    const queue = ids.split(',').map(Number);
    const worker = async () => {
      while (!cancelled && queue.length) {
        const id = queue.shift()!;
        try {
          const seasons = await fetchCachedSeasons(id);
          if (!cancelled) setCatalogs((current) => ({ ...current, [id]: seasons }));
        } catch { /* A missing catalog must not prevent using saved content. */ }
      }
    };
    // At most two metadata requests at once; stop queuing when the tab is hidden.
    void worker(); void worker();
    return () => { cancelled = true; };
  }, [enabled, focused, ids]);
  return catalogs;
}

export function SavedSeriesProgress({ tmdbId, seasons, reviews }: {
  tmdbId: number; seasons?: Season[]; reviews: ProfileReview[];
}) {
  const watched = new Set(reviews.filter((r) => mediaTypeOf(r) === 'tv' && r.tmdbId === tmdbId)
    .flatMap((r) => r.seasonNumber ? [r.seasonNumber] : r.seasonsWatched ?? []));
  const today = new Date().toISOString().slice(0, 10);
  const available = seasons?.filter((s) => s.numero > 0 && s.cantidadEpisodios !== 0 && s.estreno && s.estreno <= today);
  const total = seasons ? new Set([...(available ?? []).map((s) => s.numero), ...watched]).size : null;
  const text = total ? `${watched.size} de ${total} temporada${total === 1 ? '' : 's'}`
    : watched.size ? `${watched.size} temporada${watched.size === 1 ? ' vista' : 's vistas'}` : 'Sin empezar';
  return <View style={styles.block}>
    <Text style={styles.text}>{text}</Text>
    {total != null && total > 0 && <View accessible accessibilityRole="progressbar" accessibilityLabel="Temporadas vistas"
      accessibilityValue={{ min: 0, max: total, now: watched.size, text }} style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, watched.size / total * 100)}%` }]} />
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  block: { marginTop: 6, gap: 6, paddingBottom: 3 },
  text: { color: '#d6bd90', fontSize: 11, fontWeight: '600' },
  track: { height: 4, borderRadius: 3, backgroundColor: '#322b29', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#ddb572', borderRadius: 3 },
});
