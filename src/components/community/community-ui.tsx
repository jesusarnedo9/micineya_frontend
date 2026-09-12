import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Person, Post } from '../../api/community';
import { ProfileAvatar } from '../profile/profile-avatar';
import { ContentTypeBadge } from '../content-type-tabs';

export function CommunityButton({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: 0.5 }]}>
    <Text style={s.buttonText}>{title}</Text>
  </Pressable>;
}

export function PersonRow({ person, onPress }: { person: Person; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil de ${person.username}`} onPress={onPress} style={s.row}>
    <ProfileAvatar uri={person.foto} username={person.username} size={42} />
    <View style={{ flex: 1 }}><Text style={s.name}>@{person.username}</Text>{person.siguiendo && <Text style={s.muted}>Siguiendo</Text>}</View>
    <Ionicons name="chevron-forward" color="#aaa" size={20} />
  </Pressable>;
}

export function PostCard({ post, onAuthor, onReport }: { post: Post; onAuthor?: () => void; onReport?: () => void }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => setRevealed(false), [post.id, post.comentario, post.spoiler]);
  const date = post.fecha ? new Date(post.fecha) : null;
  return <View style={s.card}>
    <View style={s.row}>
      <Pressable accessibilityRole="button" disabled={!onAuthor} onPress={onAuthor} style={{ flex: 1 }}>
        <Text style={s.name}>@{post.username}</Text>
        <Text style={s.muted}>{date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('es-AR') : 'Vista'}</Text>
      </Pressable>
      {onReport && <Pressable accessibilityRole="button" accessibilityLabel="Reportar reseña" hitSlop={12} onPress={onReport} style={{ padding: 10 }}>
        <Ionicons name="flag-outline" size={19} color="#b8a6a8" />
      </Pressable>}
    </View>
    <View style={[s.row, { alignItems: 'flex-start' }]}>
      {post.posterPath && /^\/[\w.-]+$/.test(post.posterPath) ? <Image source={{ uri: `https://image.tmdb.org/t/p/w185${post.posterPath}` }} style={s.poster} /> : null}
      <View style={{ flex: 1, gap: 10 }}>
        <ContentTypeBadge type={post.mediaType} />
        {post.mediaType === 'tv' && post.numeroTemporada && <Text style={s.muted}>Temporada {post.numeroTemporada}</Text>}
        <Text style={s.movie}>{post.titulo}</Text>
        <Text accessibilityLabel={`${post.calificacion} de 5 estrellas`} style={s.stars}>{'★'.repeat(Math.max(0, Math.min(5, post.calificacion)))}{'☆'.repeat(Math.max(0, 5 - post.calificacion))}</Text>
        {!!post.comentario && (post.spoiler && !revealed
          ? <CommunityButton title="Contiene spoilers · Mostrar" secondary onPress={() => setRevealed(true)} />
          : <Text style={s.comment}>{post.comentario}</Text>)}
        {!post.comentario && <Text style={s.muted}>Puntuó esta {post.mediaType === 'tv' ? 'serie' : 'película'}</Text>}
      </View>
    </View>
  </View>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#090708' },
  content: { flexGrow: 1, padding: 20, paddingBottom: 30, gap: 16 },
  eyebrow: { color: '#ff7c85', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  heading: { color: '#fff', fontSize: 30, fontWeight: '900' },
  muted: { color: '#b1a6a8', fontSize: 13, lineHeight: 20 },
  name: { color: '#fff', fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 8 },
  card: { backgroundColor: '#181315', borderWidth: 1, borderColor: '#33272b', borderRadius: 20, padding: 16, gap: 10 },
  button: { backgroundColor: '#b2162a', borderRadius: 24, paddingVertical: 13, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  secondary: { backgroundColor: '#2b2225' },
  buttonText: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  input: { backgroundColor: '#1c1719', borderColor: '#433238', borderWidth: 1, borderRadius: 16, padding: 14, color: '#fff', fontSize: 16 },
  error: { color: '#ff9ca4', lineHeight: 21 },
  movie: { color: '#fff', fontSize: 19, fontWeight: '800' },
  poster: { width: 66, height: 99, borderRadius: 9, backgroundColor: '#30272a' },
  stars: { color: '#f6c85f', fontSize: 20 },
  comment: { color: '#e0d5d7', fontSize: 15, lineHeight: 22 },
});
