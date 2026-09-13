import { StyleSheet, Text } from 'react-native';

export function CinephileTitle({ title }: { title?: string | null }) {
  if (!title) return null;
  return <Text style={styles.title}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: { color: '#f3cf83', fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 5, flexShrink: 1 },
});
