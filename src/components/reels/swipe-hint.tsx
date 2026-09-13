import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useAppFeedback } from '../../context/app-feedback';

export function SwipeHint() {
  const { newsOpen, cuesReady, swipeHintSeen, dismissSwipeHint } = useAppFeedback();
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const visible = focused && foreground && cuesReady && !newsOpen && !swipeHintSeen;
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismissSwipeHint, 6500);
    return () => clearTimeout(timer);
  }, [visible, dismissSwipeHint]);
  if (!visible) return null;
  return <View pointerEvents="none" style={styles.hint}>
    <Ionicons name="swap-horizontal" size={19} color="#e6bc7d" />
    <Text style={styles.text}>Deslizá a los costados: pelis ↔ series</Text>
  </View>;
}
const styles = StyleSheet.create({
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7 },
  text: { color: '#d3b990', fontSize: 12, flexShrink: 1 },
});
