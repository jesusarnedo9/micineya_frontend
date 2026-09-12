import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AccessibilityInfo, ActivityIndicator, Animated, AppState, Easing, Image, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { fetchPopcornProgress, type PopcornProgress } from '../../api/progress';
import { describeApiError } from '../../api/errors';
import { loadSeenPopcorn, saveSeenPopcorn } from '../../profile/popcorn-storage';

const BUCKET = require('../../../assets/images/gamification/popcorn-bucket-textured.png');
const POPCORN = require('../../../assets/images/gamification/popcorn-kernel.png');
const BADGES = [
  { code: 'SERIE_TRONOS', title: 'Game of Thrones', image: require('../../../assets/images/gamification/badge-thrones.png') },
  { code: 'SERIE_QUIMICA', title: 'Breaking Bad', image: require('../../../assets/images/gamification/badge-chemistry.png') },
  { code: 'SERIE_CICLO', title: 'Dark', image: require('../../../assets/images/gamification/badge-cycle.png') },
] as const;

const SLOTS = [
  { x: 56, y: 59 }, { x: 91, y: 57 }, { x: 126, y: 59 },
  { x: 40, y: 43 }, { x: 74, y: 39 }, { x: 109, y: 41 }, { x: 144, y: 42 },
  { x: 59, y: 22 }, { x: 96, y: 18 }, { x: 133, y: 22 },
];

function Kernel() {
  return <Image source={POPCORN} style={styles.kernel} accessible={false} />;
}

function MiniBucket() {
  return <View style={styles.mini} accessible={false}>
    <Image source={BUCKET} style={styles.miniBucket} />
    <Image source={POPCORN} style={[styles.miniKernel, { left: 2 }]} />
    <Image source={POPCORN} style={[styles.miniKernel, { left: 10, top: 0 }]} />
  </View>;
}

function Bucket({ filled, falling, drop, pulse }: { filled: number; falling: number | null; drop: Animated.Value; pulse: Animated.Value }) {
  const slot = falling === null ? null : SLOTS[falling];
  return <Animated.View style={[styles.stage, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1.06, 1] }) }] }]}>
    <View style={styles.halo} />
    <Image source={BUCKET} style={styles.bucketImage} />
    {SLOTS.slice(0, filled).map((position, index) => <View key={index} style={[styles.settled, { left: position.x, top: position.y, transform: [{ rotate: `${index % 2 ? 12 : -14}deg` }] }]}><Kernel /></View>)}
    {slot && <Animated.View style={[styles.settled, { left: slot.x, top: 0, transform: [
      { translateY: drop.interpolate({ inputRange: [0, 0.85, 1], outputRange: [-32, slot.y - 6, slot.y] }) },
      { translateX: drop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [15, -9, 0] }) },
      { rotate: drop.interpolate({ inputRange: [0, 1], outputRange: ['-60deg', '12deg'] }) },
    ] }]}><Kernel /></Animated.View>}
  </Animated.View>;
}

function BadgeShelf({ earned }: { earned: string[] }) {
  const unlocked = new Set(earned);
  return <View style={styles.badgeSection}>
    <Text style={styles.eyebrow}>INSIGNIAS</Text>
    <View style={styles.badgeRow}>
      {BADGES.map((badge) => {
        const active = unlocked.has(badge.code);
        return <View key={badge.code} accessible accessibilityLabel={`${badge.title}: ${active ? 'conseguida' : 'bloqueada'}`} style={styles.badgeSlot}>
          <View style={styles.badgePedestal}>
            <Image source={badge.image} style={[styles.badgeImage, !active && styles.badgeLocked]} />
            {!active && <Ionicons name="lock-closed" color="#6f6663" size={17} style={styles.lock} />}
          </View>
          <Text numberOfLines={1} style={[styles.badgeTitle, !active && styles.badgeTitleLocked]}>{badge.title}</Text>
        </View>;
      })}
    </View>
    <View style={styles.shelfTop} />
    <View style={styles.shelfFront} />
  </View>;
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
  return <View style={styles.room}>
    <View style={styles.titleRow}>
      <Ionicons name="sparkles-outline" size={18} color="#e3c079" />
      <Text style={styles.eyebrow}>SALÓN DE POCHOCLOS</Text>
    </View>
    <Text style={styles.heading}>{celebrating ? '¡Balde completo!' : `Balde ${completed + 1}`}</Text>
    {progress.tituloCinefilo && <View style={styles.cinephileTitle}><Ionicons name="ribbon-outline" size={15} color="#f3cf83" /><Text style={styles.cinephileTitleText}>{progress.tituloCinefilo}</Text></View>}
    <Bucket filled={filled} falling={falling} drop={drop} pulse={pulse} />
    <View accessible accessibilityRole="progressbar" accessibilityLabel={`Balde ${completed + 1}`} accessibilityValue={{ min: 0, max: 10, now: filled }} style={styles.progressBlock}>
      <View style={styles.progressLabels}><Text style={styles.bucketLabel}>BALDE {completed + 1}</Text><Text style={styles.count}>{filled} / 10</Text></View>
      <View style={styles.track}><View style={[styles.fill, { width: `${filled * 10}%` }]} /></View>
    </View>
    <View style={styles.shelf}>
      <View style={styles.collection}>{Array.from({ length: Math.min(completed, 5) }, (_, i) => <MiniBucket key={i} />)}
        {completed === 0 && <Ionicons name="film-outline" size={27} color="#77664b" />}
      </View>
      <Text style={styles.shelfTitle}>{completed} ×</Text>
    </View>
    <BadgeShelf earned={progress.insignias ?? []} />
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
  cinephileTitle: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#382818', borderColor: '#70522d', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 6, marginTop: 9, paddingHorizontal: 11, paddingVertical: 6 },
  cinephileTitleText: { color: '#f3cf83', fontSize: 12, fontWeight: '900' },
  subtitle: { color: '#b6a99c', fontSize: 12, lineHeight: 19, marginTop: 7 },
  stage: { width: 220, height: 226, alignSelf: 'center', marginVertical: 2 },
  halo: { position: 'absolute', top: 34, left: 2, width: 216, height: 184, borderRadius: 108, backgroundColor: '#b78c2314' },
  bucketImage: { position: 'absolute', left: 0, top: 16, width: 220, height: 220 },
  settled: { position: 'absolute', width: 42, height: 42, zIndex: 2 },
  kernel: { width: 42, height: 42 },
  progressBlock: { gap: 8 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  bucketLabel: { color: '#ac9471', fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  count: { color: '#f5d391', fontSize: 13, fontWeight: '900' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#322b25', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#d7af63', borderRadius: 4 },
  shelf: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: '#3b3029', marginTop: 19, paddingTop: 12 },
  collection: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1, gap: 3 },
  shelfTitle: { color: '#e8cf9b', fontSize: 13, fontWeight: '800' },
  mini: { width: 30, height: 34 },
  miniBucket: { position: 'absolute', left: 1, top: 6, width: 28, height: 28 },
  miniKernel: { position: 'absolute', top: 2, width: 16, height: 16, zIndex: 2 },
  badgeSection: { marginTop: 20 },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 11, paddingHorizontal: 2 },
  badgeSlot: { alignItems: 'center', width: '31%' },
  badgePedestal: { alignItems: 'center', height: 76, justifyContent: 'flex-end', width: 76 },
  badgeImage: { height: 72, width: 72 },
  badgeLocked: { opacity: 0.16 },
  lock: { position: 'absolute', bottom: 27 },
  badgeTitle: { color: '#e7d3ad', fontSize: 9, fontWeight: '800', marginTop: 5, maxWidth: 94 },
  badgeTitleLocked: { color: '#625b59' },
  shelfTop: { backgroundColor: '#6e4431', borderRadius: 3, height: 7, marginTop: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.55, shadowRadius: 3 },
  shelfFront: { alignSelf: 'center', backgroundColor: '#3d251d', borderBottomLeftRadius: 4, borderBottomRightRadius: 4, height: 8, width: '94%' },
  skip: { alignItems: 'center', padding: 12, minHeight: 44, marginTop: 8 },
  skipText: { color: '#dec091', fontSize: 12, fontWeight: '700' },
  footnote: { color: '#978a7e', fontSize: 10, lineHeight: 15, marginTop: 13 },
});
