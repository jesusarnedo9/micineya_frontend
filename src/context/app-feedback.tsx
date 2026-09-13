import { Ionicons } from '@expo/vector-icons';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { getAccountStorageKey } from '../auth/session';

type Notice = { id: number; message: string; undo: () => Promise<void> };
type Feedback = {
  showUndo: (message: string, undo: () => Promise<void>) => void;
  newsOpen: boolean;
  cuesReady: boolean;
  swipeHintSeen: boolean;
  dismissSwipeHint: () => void;
};
const Context = createContext<Feedback | null>(null);
const NEWS_VERSION = 'discovery_popcorn_1';

export function AppFeedbackProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [newsOpen, setNewsOpen] = useState(false);
  const [cuesReady, setCuesReady] = useState(false);
  const [swipeHintSeen, setSwipeHintSeen] = useState(true);
  const accountRef = useRef<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [failedId, setFailedId] = useState<number | null>(null);
  const [screenReader, setScreenReader] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const sequence = useRef(0);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const account = (await getAccountStorageKey()).replace(/[^a-zA-Z0-9._-]/g, '_');
      const [news, hint] = await Promise.all([
        SecureStore.getItemAsync(`news_${NEWS_VERSION}_${account}`),
        SecureStore.getItemAsync(`swipe_hint_${account}`),
      ]);
      if (!mounted) return;
      accountRef.current = account;
      setNewsOpen(news !== 'seen');
      setSwipeHintSeen(hint === 'seen');
      setCuesReady(true);
    })().catch(() => { if (mounted) setCuesReady(true); });
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => { if (mounted) setScreenReader(enabled); }).catch(() => {});
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    const appState = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => { mounted = false; reader.remove(); appState.remove(); };
  }, []);

  const dismissNews = useCallback(() => {
    setNewsOpen(false);
    if (accountRef.current) void SecureStore.setItemAsync(`news_${NEWS_VERSION}_${accountRef.current}`, 'seen').catch(() => {});
  }, []);
  const dismissSwipeHint = useCallback(() => {
    setSwipeHintSeen(true);
    if (accountRef.current) void SecureStore.setItemAsync(`swipe_hint_${accountRef.current}`, 'seen').catch(() => {});
  }, []);
  const showUndo = useCallback((message: string, undo: () => Promise<void>) => {
    setFailedId(null);
    setNotice({ id: ++sequence.current, message, undo });
  }, []);

  useEffect(() => {
    if (!notice || busy || screenReader || !foreground || newsOpen || failedId === notice.id) return;
    const timer = setTimeout(() => setNotice((current) => current?.id === notice.id ? null : current), 10000);
    return () => clearTimeout(timer);
  }, [notice, busy, screenReader, foreground, newsOpen, failedId]);

  const undo = async () => {
    if (!notice || busyRef.current) return;
    const current = notice;
    busyRef.current = true; setBusy(true);
    try {
      await current.undo();
      setNotice((latest) => latest?.id === current.id ? null : latest);
    } catch {
      setFailedId(current.id);
    } finally { busyRef.current = false; setBusy(false); }
  };

  return <Context.Provider value={{ showUndo, newsOpen, cuesReady, swipeHintSeen, dismissSwipeHint }}>
    <View style={styles.root}>
      {children}
      {notice && !newsOpen && <View style={[styles.toast, { bottom: 66 + Math.max(insets.bottom, 8) }]}>
        <Text accessibilityLiveRegion="polite" style={styles.toastText}>
          {failedId === notice.id ? 'No se pudo deshacer. Probá de nuevo.' : notice.message}
        </Text>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void undo()} style={styles.action}>
          {busy ? <ActivityIndicator color="#ff9ba0" /> : <Text style={styles.actionText}>Deshacer</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar aviso" disabled={busy}
          onPress={() => setNotice(null)} style={styles.close}>
          <Ionicons name="close" size={20} color="#ccc" />
        </Pressable>
      </View>}
      <Modal visible={newsOpen} transparent animationType="fade" onRequestClose={dismissNews}>
        <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.news} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.newsContent}>
              <Text style={styles.eyebrow}>MICINEYA</Text>
              <Text accessibilityRole="header" style={styles.heading}>Hay más para disfrutar</Text>
              {([
                ['swap-horizontal', 'Películas y series', 'Deslizá hacia los costados para cambiar.'],
                ['people-outline', 'Tu comunidad', 'Seguí a tus amigos y descubrí sus reseñas.'],
                ['trophy-outline', 'Tus logros', 'Sumá pochoclos y completá tu estante de insignias.'],
              ] as const).map(([icon, title, copy]) => <View key={title} style={styles.feature}>
                <Ionicons name={icon} color="#edbd73" size={26} />
                <View style={styles.featureCopy}><Text style={styles.title}>{title}</Text><Text style={styles.copy}>{copy}</Text></View>
              </View>)}
              <Pressable accessibilityRole="button" onPress={dismissNews} style={styles.continue}>
                <Text style={styles.title}>Vamos al cine</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  </Context.Provider>;
}

export function useAppFeedback() {
  const value = useContext(Context);
  if (!value) throw new Error('Falta AppFeedbackProvider');
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  toast: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: '#302126', borderWidth: 1, borderColor: '#61414a', borderRadius: 16, paddingLeft: 14, elevation: 12 },
  toastText: { flex: 1, color: '#fff', fontSize: 13, paddingVertical: 12 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  actionText: { color: '#ffa6aa', fontWeight: '800', fontSize: 13 },
  close: { minHeight: 48, width: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: '#000c', justifyContent: 'center', paddingHorizontal: 20 },
  news: { maxHeight: '100%', backgroundColor: '#191315', borderRadius: 26, borderWidth: 1, borderColor: '#543039', overflow: 'hidden' },
  newsContent: { padding: 24, gap: 24 },
  eyebrow: { color: '#ff858c', letterSpacing: 3, fontSize: 11, fontWeight: '900' },
  heading: { color: '#fff5ec', fontSize: 28, fontWeight: '900' },
  feature: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  featureCopy: { flex: 1, gap: 5 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  copy: { color: '#bcaeb2', fontSize: 14, lineHeight: 21 },
  continue: { minHeight: 52, borderRadius: 18, backgroundColor: '#ba1323', alignItems: 'center', justifyContent: 'center', padding: 14 },
});
