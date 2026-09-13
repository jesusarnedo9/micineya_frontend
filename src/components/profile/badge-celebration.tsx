import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Image, type ImageSourcePropType, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadSeenBadges, rememberBadge } from '../../profile/popcorn-storage';

type Badge = { code: string; title: string; image: ImageSourcePropType };
export function BadgeCelebration({ userId, badges, reduced }: {
  userId: number; badges: readonly Badge[]; reduced: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [seen, setSeen] = useState<Set<string> | null>(null);
  const [screenReader, setScreenReader] = useState(true);
  const [shownCode, setShownCode] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const badge = seen ? badges.find((candidate) => !seen.has(candidate.code)) : null;
  const code = badge?.code;

  useEffect(() => {
    let mounted = true;
    void loadSeenBadges(userId).then((values) => { if (mounted) setSeen(values); }).catch(() => {});
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => { if (mounted) setScreenReader(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { mounted = false; listener.remove(); scale.stopAnimation(); };
  }, [userId, scale]);

  useEffect(() => {
    if (!code || shownCode !== code) return;
    void rememberBadge(userId, code).catch(() => {});
    if (!reduced) {
      scale.setValue(0.85);
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    } else scale.setValue(1);
    if (screenReader) return;
    const timer = setTimeout(() => setSeen((current) => new Set(current).add(code)), 4000);
    return () => { clearTimeout(timer); scale.stopAnimation(); };
  }, [code, shownCode, reduced, scale, screenReader, userId]);

  if (!badge) return null;
  const close = () => setSeen((current) => new Set(current).add(badge.code));
  return <Modal key={badge.code} visible transparent animationType={reduced ? 'none' : 'fade'}
    onShow={() => setShownCode(badge.code)} onRequestClose={close}>
    <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View accessibilityViewIsModal style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar celebración" onPress={close} style={styles.close}>
          <Ionicons name="close" color="#e7d3ad" size={22} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.label}>¡Nueva insignia!</Text>
        <Animated.View style={{ transform: [{ scale }] }}><Image source={badge.image} style={styles.badge} /></Animated.View>
        <Text style={styles.title}>{badge.title}</Text>
        <Pressable accessibilityRole="button" onPress={close} style={styles.button}><Text style={styles.buttonText}>Al estante</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000c', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#231a17', borderColor: '#916e40', borderWidth: 1, borderRadius: 28, padding: 24, alignItems: 'center' },
  close: { alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', width: 44, minHeight: 44, marginTop: -12, marginRight: -12 },
  label: { color: '#f8d58e', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  badge: { width: 160, height: 160, marginVertical: 14 },
  title: { color: '#fff4df', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  button: { minHeight: 48, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 16, backgroundColor: '#533b27', marginTop: 22 },
  buttonText: { color: '#ffdfa3', fontWeight: '800', fontSize: 14 },
});
