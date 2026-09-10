import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MediaType } from '../types/movie';

export function ContentTypeTabs({ value, onChange, disabled = false }: {
  value: MediaType; onChange: (type: MediaType) => void; disabled?: boolean;
}) {
  return <View style={styles.tabs}>
    {(['movie', 'tv'] as const).map((type) => <Pressable key={type} accessibilityRole="tab"
      accessibilityState={{ selected: value === type, disabled }} disabled={disabled}
      onPress={() => onChange(type)} style={[styles.tab, value === type && styles.selected]}>
      <Text style={[styles.label, value === type && styles.active]}>{type === 'movie' ? 'Películas' : 'Series'}</Text>
    </Pressable>)}
  </View>;
}

export function ContentTypeBadge({ type = 'movie' }: { type?: MediaType }) {
  return <Text style={styles.badge}>{type === 'tv' ? 'Serie' : 'Peli'}</Text>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: '#171315', borderRadius: 18, padding: 4, gap: 4, alignSelf: 'stretch' },
  tab: { flex: 1, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  selected: { backgroundColor: '#a61522' }, label: { color: '#aba1a4', fontSize: 14, fontWeight: '800' },
  active: { color: '#fff' }, badge: { color: '#ffacb2', backgroundColor: '#32171e', alignSelf: 'flex-start',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: '800', marginVertical: 4 },
});
