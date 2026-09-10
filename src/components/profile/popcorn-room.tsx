import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { fetchPopcornProgress, type PopcornProgress } from '../../api/progress';
import { describeApiError } from '../../api/errors';
import { loadSeenPopcorn, saveSeenPopcorn } from '../../profile/popcorn-storage';

const SLOTS = [
  { x: 49, y: 174 }, { x: 84, y: 176 }, { x: 119, y: 173 },
  { x: 40, y: 133 }, { x: 84, y: 135 }, { x: 128, y: 132 },
  { x: 29, y: 91 }, { x: 64, y: 89 }, { x: 99, y: 92 }, { x: 134, y: 88 },
];

function Kernel() {
  return <View style={styles.kernel} accessible={false}>
    <View style={[styles.lobe, { left: 1, top: 10, transform: [{ rotate: '-25deg' }] }]} />
    <View style={[styles.lobe, { left: 12, top: 1, backgroundColor: '#fff1bf' }]} />
    <View style={[styles.lobe, { left: 17, top: 13, transform: [{ rotate: '30deg' }] }]} />
    <View style={[styles.lobe, { left: 8, top: 16, backgroundColor: '#f4d78b' }]} />
    <View style={styles.kernelCenter} />
  </View>;
}

function MiniBucket() {
  return <View style={styles.mini} accessible={false}>
    <View style={styles.miniPopcorn} />
    <View style={styles.miniCup}><View style={styles.miniStripe} /><View style={styles.miniStripe} /></View>
  </View>;
}

function Bucket({ filled, falling, drop, pulse }: { filled: number; falling: number | null; drop: Animated.Value; pulse: Animated.Value }) {
  const slot = falling === null ? null : SLOTS[falling];
  return <Animated.View style={[styles.stage, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1.06, 1] }) }] }]}>
    <View style={styles.halo} />
    <View style={styles.cup}>
      {[24, 69, 114].map((left) => <View key={left} style={[styles.stripe, { left }]} />)}
      <Ionicons name="film-outline" size={28} color="#71363c" style={styles.cupLogo} />
    </View>
    <View style={styles.rim} />
    {SLOTS.slice(0, filled).map((position, index) => <View key={index} style={[styles.settled, { left: position.x, top: position.y, transform: [{ rotate: `${index % 2 ? 12 : -14}deg` }] }]}><Kernel /></View>)}
    {slot && <Animated.View style={[styles.settled, { left: slot.x, top: 0, transform: [
      { translateY: drop.interpolate({ inputRange: [0, 0.85, 1], outputRange: [-32, slot.y - 6, slot.y] }) },
      { translateX: drop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [15, -9, 0] }) },
      { rotate: drop.interpolate({ inputRange: [0, 1], outputRange: ['-60deg', '12deg'] }) },
    ] }]}><Kernel /></Animated.View>}
    <View style={styles.base} />
  </Animated.View>;
}

/** Visual only: balances are derived by the server, never awarded by the animation. */
export function PopcornRoom({ progress, from = progress.totalPochoclos ?? progress.peliculasVistas, animate = false }: {
  progress: PopcornProgress; from?: number; animate?: boolean;
}) {
  const total = progress.totalPochoclos ?? progress.peliculasVistas;
  const start = Math.min(total, Math.max(from, total - 20));
  const [shown, setShown] = useState(start);
  const [falling, setFalling] = useState<number | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [running, setRunning] = useState(false);
  const [skip, setSkip] = useState(false);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const drop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const writing = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (mounted) setReduced(value); }).catch(() => { if (mounted) setReduced(true); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { mounted = false; listener.remove(); };
  }, []);

  useEffect(() => {
    if (reduced === null) return;
    let cancelled = false;
    const remember = async (value: number) => {
      if (!animate || cancelled) return;
      writing.current = writing.current.catch(() => {}).then(() => saveSeenPopcorn(progress.usuarioId, value));
      try { await writing.current; }
      catch { if (!cancelled) setStorageWarning(true); }
    };
    const play = (value: Animated.Value, duration: number) => new Promise<boolean>((resolve) => {
      value.setValue(0);
      Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(({ finished }) => resolve(finished));
    });
    const run = async () => {
      setFalling(null); setCelebrating(false);
      if (!animate || reduced || skip || total <= from) {
        setShown(total); setRunning(false);
        await remember(total);
        return;
      }
      setShown(start); setRunning(true);
      // Large backlogs are summarized; animate at most two buckets, without losing the real total.
      if (start > from) await remember(start);
      for (let count = start; count < total && !cancelled; count += 1) {
        setFalling(count % 10);
        const finished = await play(drop, total - start > 10 ? 260 : 420);
        if (!finished || cancelled) return;
        setFalling(null); setShown(count + 1);
        if ((count + 1) % 10 === 0) {
          setCelebrating(true);
          const completed = await play(pulse, 850);
          if (!completed || cancelled) return;
          setCelebrating(false);
        }
        await remember(count + 1);
      }
      if (!cancelled) setRunning(false);
    };
    void run();
    return () => { cancelled = true; drop.stopAnimation(); pulse.stopAnimation(); };
  }, [animate, drop, from, progress.usuarioId, pulse, reduced, skip, start, total]);

  const completed = Math.floor(shown / 10) - (celebrating ? 1 : 0);
  const filled = celebrating ? 10 : shown % 10;
  const pending = Math.max(0, total - from);
  return <View style={styles.room}>
    <View style={styles.titleRow}>
      <Ionicons name="sparkles-outline" size={18} color="#e3c079" />
      <Text style={styles.eyebrow}>SALÓN DE POCHOCLOS</Text>
    </View>
    <Text style={styles.heading}>{celebrating ? '¡Otro balde completo!' : 'Tu historia llena el balde'}</Text>
    <Text style={styles.subtitle}>{animate && running && pending > 1
      ? `Tenías ${pending} pochoclos por sumar${pending > 20 ? '. Agrupamos los anteriores' : ''}.`
      : `${progress.peliculasVistas} pelis · ${progress.temporadasVistas ?? 0} temporadas. Cada 10 pochoclos completás un balde.`}</Text>
    <Text style={styles.subtitle}>Una película o una temporada completa = un pochoclo.</Text>
    <Bucket filled={filled} falling={falling} drop={drop} pulse={pulse} />
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Balde ${completed + 1}`} accessibilityValue={{ min: 0, max: 10, now: filled }} style={styles.progressBlock}>
      <View style={styles.progressLabels}><Text style={styles.bucketLabel}>BALDE {completed + 1}</Text><Text style={styles.count}>{filled} / 10</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${filled * 10}%` }]} /></View>
    </View>
    <View style={styles.shelf}>
      <View style={styles.collection}>{Array.from({ length: Math.min(completed, 5) }, (_, i) => <MiniBucket key={i} />)}
        {completed === 0 && <Ionicons name="film-outline" size={27} color="#77664b" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.shelfTitle}>{completed ? `${completed} ${completed === 1 ? 'balde completo' : 'baldes completos'}` : 'Tu colección empieza acá'}</Text>
        <Text style={styles.shelfCaption}>{completed > 5 ? `Mostramos 5 de tus ${completed} baldes.` : completed ? 'Cada uno representa 10 pochoclos de tu historia.' : 'El primer balde lleno quedará en este estante.'}</Text>
      </View>
    </View>
    {running && <Pressable accessibilityRole="button" onPress={() => setSkip(true)} style={styles.skip}><Text style={styles.skipText}>Ver el resultado sin animación</Text></Pressable>}
    {storageWarning && <Text style={styles.subtitle}>El progreso está guardado en tu cuenta. No pudimos recordar la animación en este teléfono.</Text>}
  </View>;
}

export function ProfilePopcornRoom({ reviewKey }: { reviewKey: string }) {
  const [snapshot, setSnapshot] = useState<{ progress: PopcornProgress; from: number; revision: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  const revision = useRef(0);

  const load = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true); setError(null); setSnapshot(null);
    try {
      const progress = await fetchPopcornProgress();
      const from = await loadSeenPopcorn(progress.usuarioId).catch(() => 0);
      if (request === revision.current) setSnapshot({ progress, from, revision: request });
    } catch (failure) {
      if (request === revision.current) setError(describeApiError(failure).message);
    } finally { if (request === revision.current) setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); revision.current += 1; }; }, []));
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (focused && foreground) void load();
    return () => { revision.current += 1; };
  }, [focused, foreground, reviewKey, load]);

  return <View style={{ marginHorizontal: 18, marginTop: 18 }}>
    {focused && foreground && snapshot ? <PopcornRoom key={snapshot.revision} progress={snapshot.progress} from={snapshot.from} animate /> : null}
    {loading && <View style={styles.room}><ActivityIndicator color="#e3c079" /><Text style={styles.subtitle}>Preparando tus pochoclos…</Text></View>}
    {error && <View style={styles.room}><Text style={styles.shelfTitle}>No pudimos cargar tus pochoclos</Text><Text style={styles.subtitle}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.skip}><Text style={styles.skipText}>Reintentar</Text></Pressable></View>}
  </View>;
}

const styles = StyleSheet.create({
  room: { backgroundColor: '#191416', borderColor: '#4a392c', borderWidth: 1, borderRadius: 24, padding: 18, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { color: '#d8b577', fontSize: 10, letterSpacing: 1.4, fontWeight: '900' },
  heading: { color: '#fff3db', fontSize: 23, fontWeight: '900', marginTop: 10 },
  subtitle: { color: '#b6a99c', fontSize: 12, lineHeight: 19, marginTop: 7 },
  stage: { width: 200, height: 235, alignSelf: 'center', marginVertical: 5 },
  halo: { position: 'absolute', top: 45, left: -5, width: 210, height: 185, borderRadius: 105, backgroundColor: '#b78c2310' },
  cup: { position: 'absolute', left: 20, top: 76, width: 160, height: 142, borderColor: '#ae6552', borderWidth: 2, backgroundColor: '#491e28', borderBottomLeftRadius: 35, borderBottomRightRadius: 35, overflow: 'hidden' },
  stripe: { position: 'absolute', width: 20, height: 145, backgroundColor: '#743440', top: 0, transform: [{ rotate: '-3deg' }] },
  cupLogo: { position: 'absolute', alignSelf: 'center', top: 53 },
  rim: { position: 'absolute', top: 64, left: 13, width: 174, height: 23, borderRadius: 13, backgroundColor: '#201819', borderWidth: 2, borderColor: '#b68666' },
  base: { position: 'absolute', bottom: 14, left: 54, width: 94, height: 4, backgroundColor: '#a26853', borderRadius: 4 },
  settled: { position: 'absolute', width: 36, height: 36 },
  kernel: { width: 36, height: 36 },
  lobe: { position: 'absolute', width: 20, height: 21, borderRadius: 10, backgroundColor: '#ffe9a5', borderColor: '#edcc80', borderWidth: 1 },
  kernelCenter: { position: 'absolute', left: 14, top: 17, width: 9, height: 8, backgroundColor: '#c39443', borderRadius: 4 },
  progressBlock: { gap: 8 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  bucketLabel: { color: '#ac9471', fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  count: { color: '#f5d391', fontSize: 13, fontWeight: '900' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#322b25', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#d7af63', borderRadius: 4 },
  shelf: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#3b3029', marginTop: 19, paddingTop: 15 },
  collection: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', maxWidth: 100, gap: 3 },
  shelfTitle: { color: '#e8cf9b', fontSize: 13, fontWeight: '800' },
  shelfCaption: { color: '#9b8c7c', fontSize: 11, lineHeight: 16, marginTop: 4 },
  mini: { width: 29, height: 36 },
  miniPopcorn: { position: 'absolute', left: 1, top: 3, width: 27, height: 12, borderRadius: 7, backgroundColor: '#e9d298', borderWidth: 2, borderColor: '#bf9c55' },
  miniCup: { position: 'absolute', left: 3, top: 11, width: 23, height: 24, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: '#76303a', borderColor: '#bd805a', borderWidth: 1, flexDirection: 'row', justifyContent: 'space-evenly' },
  miniStripe: { width: 3, height: 20, backgroundColor: '#d5a871' },
  skip: { alignItems: 'center', padding: 12, minHeight: 44, marginTop: 8 },
  skipText: { color: '#dec091', fontSize: 12, fontWeight: '700' },
  footnote: { color: '#978a7e', fontSize: 10, lineHeight: 15, marginTop: 13 },
});
