import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, FlatList, Keyboard, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  acceptCommunityRules, getCommunityStatus, getFollowingFeed, getModerationQueue,
  getPublicProfile, reportContent, resolveReport, searchPeople, setBlocked, setFollowing,
  type CommunityReport, type CommunityStatus, type ModerationAction, type Person, type Post, type PostPage, type ReportReason,
} from '../../api/community';
import { describeApiError } from '../../api/errors';
import type { PopcornProgress } from '../../api/progress';
import { COMMUNITY_RULES, COMMUNITY_RULES_VERSION } from '../../components/community/community-rules';
import { CommunityButton as Button, PersonRow, PostCard, s } from '../../components/community/community-ui';
import { ReportSheet } from '../../components/community/report-sheet';
import { PopcornRoom } from '../../components/profile/popcorn-room';
import { ProfileAvatar } from '../../components/profile/profile-avatar';

type Screen = { type: 'feed' } | { type: 'search'; query: string } | { type: 'profile'; id: number } | { type: 'moderation' };
type ReportTarget = { usuarioId: number; resenaId: number | null };

export default function CommunityScreen() {
  const [screen, setScreen] = useState<Screen>({ type: 'feed' });
  const [status, setStatus] = useState<CommunityStatus | null>(null);
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [progress, setProgress] = useState<PopcornProgress | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const requestRef = useRef(0);
  const mutationRef = useRef(false);
  const loadRef = useRef(false);
  const activeRef = useRef(false);

  const load = useCallback(async (target: Screen, nextPage = 0, append = false) => {
    const request = ++requestRef.current;
    loadRef.current = true;
    setLoading(true);
    setError(null);
    if (!append) {
      // No dejar publicaciones antiguas visibles después de bloquear/cambiar de perfil o cuenta.
      setPosts([]); setPeople([]); setPerson(null); setReports([]); setHasMore(false);
      setProgress(null);
    }
    try {
      const current = await getCommunityStatus();
      if (request !== requestRef.current) return;
      setStatus(current);
      if (!current.normasAceptadas || current.suspendida) return;
      if (target.type === 'feed' || target.type === 'profile') {
        let result: PostPage;
        if (target.type === 'profile') {
          const profile = await getPublicProfile(target.id, nextPage);
          if (request !== requestRef.current) return;
          setPerson(profile.persona);
          setProgress(profile.progreso ?? null);
          result = profile;
        } else result = await getFollowingFeed(nextPage);
        if (request !== requestRef.current) return;
        setPosts((previous) => {
          const combined = append ? [...previous, ...result.publicaciones] : result.publicaciones;
          return [...new Map(combined.map((post) => [post.id, post])).values()];
        });
        setHasMore(result.hayMas); setPage(nextPage);
      } else if (target.type === 'search') {
        const result = await searchPeople(target.query);
        if (request === requestRef.current) setPeople(result);
      } else if (target.type === 'moderation' && current.puedeModerar) {
        const result = await getModerationQueue();
        if (request === requestRef.current) setReports(result);
      }
    } catch (failure) {
      if (request === requestRef.current) setError(describeApiError(failure).message);
    } finally {
      if (request === requestRef.current) { loadRef.current = false; setLoading(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    activeRef.current = true;
    void load(screen);
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mutationRef.current) return true;
      if (screen.type === 'feed') return false;
      setScreen({ type: 'feed' }); return true;
    });
    return () => { activeRef.current = false; requestRef.current += 1; loadRef.current = false; back.remove(); };
  }, [load, screen]));

  const mutate = async (action: () => Promise<void>, after?: () => void) => {
    if (mutationRef.current) return;
    mutationRef.current = true; setBusy(true); setError(null);
    try {
      await action();
      if (activeRef.current) {
        if (after) after();
        else await load(screen);
      }
    } catch (failure) {
      if (activeRef.current) setError(describeApiError(failure).message);
    } finally { mutationRef.current = false; setBusy(false); }
  };

  const openProfile = (id: number) => { if (!mutationRef.current) setScreen({ type: 'profile', id }); };
  const block = (target: Person) => Alert.alert('¿Bloquear a esta persona?', `Vos y @${target.username} dejarán de verse en Comunidad. También se elimina el seguimiento en ambos sentidos.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Bloquear', style: 'destructive', onPress: () => void mutate(() => setBlocked(target.id, true), () => setScreen({ type: 'feed' })) },
  ]);
  const showReport = (usuarioId: number, resenaId: number | null) => { setReportError(null); setReportTarget({ usuarioId, resenaId }); };
  const sendReport = async (reason: ReportReason) => {
    if (!reportTarget || mutationRef.current) return;
    mutationRef.current = true; setBusy(true); setReportError(null);
    try {
      await reportContent(reportTarget.usuarioId, reportTarget.resenaId, reason);
      setReportTarget(null);
      Alert.alert('Reporte enviado', 'Quedó pendiente de revisión. Si no querés ver a esta persona, podés bloquearla desde su perfil.');
    } catch (failure) { setReportError(describeApiError(failure).message); }
    finally { mutationRef.current = false; setBusy(false); }
  };
  const moderate = (report: CommunityReport, action: ModerationAction, label: string) => Alert.alert(label, `Se aplicará a @${report.username}. Esta acción quedará registrada.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: action === 'DESESTIMAR' ? 'default' : 'destructive', onPress: () => void mutate(() => resolveReport(report.id, action)) },
  ]);
  const search = () => {
    Keyboard.dismiss();
    if (query.trim().length >= 2 && !busy) setScreen({ type: 'search', query: query.trim() });
  };
  const ready = status?.normasAceptadas && !status.suspendida;
  const disabled = busy || loading;

  return <SafeAreaView edges={['top']} style={s.screen}>
    <FlatList
      data={posts}
      keyExtractor={(post) => String(post.id)}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      refreshing={loading && posts.length === 0}
      onRefresh={() => { if (!busy) void load(screen); }}
      renderItem={({ item }) => <PostCard post={item} onAuthor={() => openProfile(item.autorId)} onReport={item.autorId === status?.miId || busy ? undefined : () => showReport(item.autorId, item.id)} />}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      ListHeaderComponent={<View style={{ gap: 16, marginBottom: posts.length ? 16 : 0 }}>
        {(screen.type === 'profile' || screen.type === 'moderation') && <Button title="‹ Volver a Siguiendo" secondary disabled={busy} onPress={() => setScreen({ type: 'feed' })} />}
        <Text style={s.heading}>{screen.type === 'profile' ? 'Su cine personal' : screen.type === 'moderation' ? 'Revisar reportes' : 'Siguiendo'}</Text>
        {status && !status.normasAceptadas && !status.suspendida && <View style={s.card}>
          <Text style={s.movie}>El cine también se comparte</Text>
          <Text style={s.muted}>{COMMUNITY_RULES}</Text>
          {status.versionNormas !== COMMUNITY_RULES_VERSION && <Text style={s.error}>Actualizá la app para leer y aceptar la nueva versión de las normas.</Text>}
          <Button title="Acepto las normas y quiero participar" disabled={disabled || status.versionNormas !== COMMUNITY_RULES_VERSION} onPress={() => void mutate(() => acceptCommunityRules(COMMUNITY_RULES_VERSION))} />
          <Text style={s.muted}>Si todavía no querés participar, podés seguir usando las otras secciones.</Text>
        </View>}
        {status?.suspendida && <Text style={s.error}>Tu participación en Comunidad está suspendida por moderación. Tu cuenta y tu biblioteca personal siguen disponibles.</Text>}
        {ready && (screen.type === 'feed' || screen.type === 'search') && <>
          <TextInput accessibilityLabel="Buscar por nombre de usuario" autoCapitalize="none" autoCorrect={false} value={query} onChangeText={setQuery} maxLength={50} placeholder="Buscar por nombre de usuario" placeholderTextColor="#95878b" style={s.input} returnKeyType="search" onSubmitEditing={search} editable={!busy} />
          <Button title="Buscar personas" disabled={busy || query.trim().length < 2} onPress={search} />
          {status.puedeModerar && <Button title="Revisar reportes" secondary disabled={busy} onPress={() => setScreen({ type: 'moderation' })} />}
          {screen.type === 'search' && <Text style={s.muted}>Resultados para “{screen.query}”</Text>}
          {screen.type === 'search' && people.map((p) => <PersonRow key={p.id} person={p} onPress={() => openProfile(p.id)} />)}
        </>}
        {ready && screen.type === 'profile' && person && <View style={s.card}>
          <View style={s.row}><ProfileAvatar uri={person.foto} username={person.username} /><Text style={[s.movie, { flex: 1 }]}>@{person.username}</Text></View>
          <Text style={s.muted}>Películas vistas, puntuaciones y reseñas públicas.</Text>
          {person.id !== status.miId && <>
            <Button title={person.siguiendo ? 'Dejar de seguir' : 'Seguir'} secondary={person.siguiendo} disabled={disabled} onPress={() => void mutate(() => setFollowing(person.id, !person.siguiendo))} />
            <View style={s.row}>
              <Button title="Reportar perfil" secondary disabled={disabled} onPress={() => showReport(person.id, null)} />
              <Button title="Bloquear" secondary disabled={disabled} onPress={() => block(person)} />
            </View>
          </>}
        </View>}
        {ready && screen.type === 'profile' && progress && <PopcornRoom key={`${progress.usuarioId}-${progress.peliculasVistas}`} progress={progress} />}
        {ready && screen.type === 'moderation' && reports.map((report) => <View style={s.card} key={report.id}>
          <Text style={s.eyebrow}>REPORTE #{report.id} · {report.motivo.replaceAll('_', ' ')}</Text>
          <View style={s.row}><ProfileAvatar uri={report.foto} username={report.username} size={42} /><Text style={s.name}>@{report.username}</Text></View>
          {report.publicacion && <PostCard post={report.publicacion} />}
          {report.publicacion && <>
            <Button title="Ocultar reseña" disabled={disabled} onPress={() => moderate(report, 'OCULTAR_RESENA', '¿Ocultar esta reseña?')} />
            <Button title="Marcar como spoiler" secondary disabled={disabled} onPress={() => moderate(report, 'MARCAR_SPOILER', '¿Marcar spoiler?')} />
          </>}
          {report.foto && <Button title="Quitar foto" secondary disabled={disabled} onPress={() => moderate(report, 'QUITAR_FOTO', '¿Quitar la foto actual?')} />}
          <Button title="Suspender de Comunidad" secondary disabled={disabled} onPress={() => moderate(report, 'SUSPENDER', '¿Suspender su participación en Comunidad?')} />
          <Button title="Desestimar reporte" secondary disabled={disabled} onPress={() => moderate(report, 'DESESTIMAR', '¿Desestimar este reporte?')} />
        </View>)}
        {loading && <ActivityIndicator color="#ff7c85" />}
        {busy && <Text style={s.muted}>Guardando cambios…</Text>}
        {error && <View style={s.card}><Text style={s.error}>{error}</Text><Button title="Reintentar" secondary disabled={disabled} onPress={() => void load(screen)} /></View>}
        {ready && !loading && !error && posts.length === 0 && people.length === 0 && reports.length === 0 && <View style={s.card}>
          <Text style={s.movie}>{screen.type === 'feed' ? 'Tu próxima charla sobre cine empieza acá' : 'Todavía no hay contenido'}</Text>
          <Text style={s.muted}>{screen.type === 'feed' ? 'Buscá a tus amigos por su usuario y seguilos. Sus puntuaciones y reseñas aparecerán en este espacio.' : screen.type === 'search' ? 'No encontramos coincidencias disponibles. Revisá el nombre de usuario.' : screen.type === 'moderation' ? 'No hay reportes pendientes de revisión.' : 'Esta persona aún no tiene publicaciones visibles.'}</Text>
        </View>}
      </View>}
      ListFooterComponent={<View style={{ gap: 14, marginTop: 'auto', paddingBottom: 4, paddingTop: 32 }}>
        {hasMore && <Button title={loading ? 'Cargando…' : 'Ver más'} secondary disabled={disabled} onPress={() => { if (!loadRef.current) void load(screen, page + 1, true); }} />}
         {screen.type === 'search' && <Button title="Volver al feed de Siguiendo" secondary disabled={busy} onPress={() => { setQuery(''); setScreen({ type: 'feed' }); }} />}
        {status && <Text style={s.muted}>Tu ID de cuenta: {status.miId} · Guardadas y preferencias privadas.</Text>}
      </View>}
    />
    <ReportSheet visible={reportTarget !== null} busy={busy} error={reportError} onClose={() => setReportTarget(null)} onReason={(reason) => void sendReport(reason)} />
  </SafeAreaView>;
}
