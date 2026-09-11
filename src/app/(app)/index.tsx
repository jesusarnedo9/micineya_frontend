import { MovieReelFeed } from '../../components/reels/movie-reel-feed';
import { useAppExperience } from '../../context/app-experience';
import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { describeApiError } from '../../api/errors';
import { useCallback, useState } from 'react';
import { ContentTypeTabs } from '../../components/content-type-tabs';
import { mediaTypeOf, type MediaType } from '../../types/movie';

export default function RecommendedScreen() {
  const router = useRouter();
  const [mediaType, setMediaType] = useState<MediaType>('movie');
  const {
    loadRecommendations, recommendationsVersion, renewRecommendations,
    undoDismissal, clearDismissalNotice, lastDismissed, recommendationsBusy,
  } = useAppExperience();
  const loader = useCallback(() => loadRecommendations(mediaType), [loadRecommendations, mediaType]);
  const switchContentType = useCallback(() => setMediaType((current) => current === 'movie' ? 'tv' : 'movie'), []);

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
      <View style={styles.topBar}>
        <View style={styles.contentTabs}><ContentTypeTabs value={mediaType} onChange={setMediaType} /></View>
        <Pressable accessibilityLabel="Buscar películas" accessibilityRole="button"
          onPress={() => router.push('/search' as Href)} style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
          <Ionicons color="#fff" name="search" size={22} />
        </Pressable>
      </View>
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
          ? 'Por ahora no hay más series para mostrar.'
          : 'Por ahora no hay más películas para mostrar.'}
        label={mediaType === 'tv' ? 'Series para vos' : 'Para vos'}
        loader={loader}
        maxItems={10}
        allowDismiss
        onRenew={() => void runAction(() => renewRecommendations(mediaType))}
        onHorizontalSwipe={switchContentType}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#000', flex: 1 },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 16, paddingVertical: 6 },
  contentTabs: { flex: 1 },
  searchButton: {
    alignItems: 'center', backgroundColor: '#24191c', borderColor: '#493137', borderRadius: 22,
    borderWidth: 1, height: 44, justifyContent: 'center', width: 44,
  },
  pressed: { opacity: 0.65, transform: [{ scale: 0.96 }] },
  secondaryText: { color: '#bbb', fontSize: 12 },
  refreshText: { color: '#ff9ba0', fontSize: 13, fontWeight: '800' },
  notice: { backgroundColor: '#201719', paddingLeft: 16, flexDirection: 'row', alignItems: 'center' },
  noticeCopy: { flex: 1, gap: 3, paddingVertical: 8 },
  noticeTitle: { color: '#fff', fontSize: 12, fontWeight: '700' },
  undo: { padding: 16, minHeight: 48 },
  closeNotice: { minHeight: 48, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
});
