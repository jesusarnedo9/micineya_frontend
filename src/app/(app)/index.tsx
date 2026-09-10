import { MovieReelFeed } from '../../components/reels/movie-reel-feed';
import { useAppExperience } from '../../context/app-experience';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { describeApiError } from '../../api/errors';
import { useCallback, useState } from 'react';
import { ContentTypeTabs } from '../../components/content-type-tabs';
import { mediaTypeOf, type MediaType } from '../../types/movie';

export default function RecommendedScreen() {
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const {
    loadRecommendations, recommendationsVersion, renewRecommendations,
    undoDismissal, clearDismissalNotice, lastDismissed, recommendationsBusy,
    recommendationNotices,
  } = useAppExperience();
  const loader = useCallback(() => loadRecommendations(mediaType), [loadRecommendations, mediaType]);

  const runAction = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      const failure = describeApiError(error);
      Alert.alert(failure.title, failure.message);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ paddingHorizontal: 16, paddingTop: 6 }}><ContentTypeTabs value={mediaType} onChange={setMediaType} /></View>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mostrarme otras diez recomendaciones"
          accessibilityState={{ disabled: recommendationsBusy, busy: recommendationsBusy }}
          disabled={recommendationsBusy}
          onPress={() => void runAction(() => renewRecommendations(mediaType))}
          style={[styles.refresh, recommendationsBusy && styles.disabled]}
        >
          {recommendationsBusy ? <ActivityIndicator color="#ff9ba0" size="small" />
            : <Ionicons name="refresh" color="#ff9ba0" size={18} />}
          <Text style={styles.refreshText}>{recommendationsBusy ? 'Un momento...' : 'Otras 10'}</Text>
        </Pressable>
      </View>
      {!!recommendationNotices[mediaType] && <Text style={{ color: '#d4b67b', fontSize: 11, paddingHorizontal: 16, paddingBottom: 8 }}>{recommendationNotices[mediaType]}</Text>}
      {lastDismissed && mediaTypeOf(lastDismissed) === mediaType ? (
        <View style={styles.notice}>
          <View style={styles.noticeCopy}>
            <Text numberOfLines={1} style={styles.noticeTitle}>{lastDismissed.title}</Text>
            <Text style={styles.secondaryText}>No te la mostraremos por 30 días.</Text>
          </View>
          <Pressable accessibilityRole="button" disabled={recommendationsBusy}
            onPress={() => void runAction(undoDismissal)} style={styles.undo}>
            <Text style={styles.refreshText}>Deshacer</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso"
            disabled={recommendationsBusy} onPress={clearDismissalNotice} style={styles.closeNotice}>
            <Ionicons name="close" color="#bbb" size={20} />
          </Pressable>
        </View>
      ) : null}
      <MovieReelFeed
        key={`${mediaType}:${recommendationsVersion}`}
        emptyMessage={mediaType === 'tv'
          ? 'No encontramos más series con estos gustos y plataformas. Algunos géneros, como Terror o Romance, no tienen equivalente en series en TMDB. Podés agregar géneros desde Mi perfil o pedir Otras 10.'
          : 'No encontramos más películas con estos gustos y plataformas. Podés probar Otras 10 o ampliar tus preferencias desde Mi perfil.'}
        label={mediaType === 'tv' ? 'Series para vos' : 'Para vos'}
        loader={loader}
        maxItems={10}
        allowDismiss
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000', flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 6 },
  secondaryText: { color: '#bbb', fontSize: 12 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#241b1e', paddingHorizontal: 15, minHeight: 44, borderRadius: 22 },
  refreshText: { color: '#ff9ba0', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  notice: { backgroundColor: '#201719', paddingLeft: 16, flexDirection: 'row', alignItems: 'center' },
  noticeCopy: { flex: 1, gap: 3, paddingVertical: 8 },
  noticeTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  undo: { padding: 16, minHeight: 48 },
  closeNotice: { minHeight: 48, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
});
