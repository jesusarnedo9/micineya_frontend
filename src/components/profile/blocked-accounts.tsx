import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getBlockedPeople, setBlocked, type Person } from '../../api/community';
import { describeApiError } from '../../api/errors';
import { CommunityButton, s } from '../community/community-ui';

export function BlockedAccounts({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const revision = useRef(0);
  const load = useCallback(async () => {
    const request = ++revision.current;
    setLoading(true); setError(null);
    try {
      const result = await getBlockedPeople();
      if (request === revision.current) setPeople(result);
    } catch (failure) {
      if (request === revision.current) setError(describeApiError(failure).message);
    } finally { if (request === revision.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { revision.current += 1; }; }, [load]);

  const unblock = async (id: number) => {
    if (busy.current) return;
    busy.current = true; setBusyId(id); onBusyChange(true); setError(null);
    const request = revision.current;
    try {
      await setBlocked(id, false);
      if (request === revision.current) setPeople((current) => current.filter((person) => person.id !== id));
    } catch (failure) {
      if (request === revision.current) setError(describeApiError(failure).message);
    } finally {
      busy.current = false;
      if (request === revision.current) { setBusyId(null); onBusyChange(false); }
    }
  };

  return <View style={{ gap: 16, paddingVertical: 18 }}>
    <Text style={s.muted}>Desbloquear no vuelve a seguir a esa persona. Si también te bloqueó, su perfil seguirá sin estar disponible.</Text>
    {loading && <ActivityIndicator color="#ff9ba0" />}
    {!loading && !error && people.length === 0 && <Text style={s.name}>No tenés cuentas bloqueadas.</Text>}
    {people.map((person) => <View style={s.card} key={person.id}>
      <Text style={s.name}>@{person.username}</Text>
      <CommunityButton title={busyId === person.id ? 'Desbloqueando…' : 'Desbloquear'} secondary disabled={busyId !== null || loading} onPress={() => void unblock(person.id)} />
    </View>)}
    {error && <><Text style={s.error}>{error}</Text><CommunityButton title="Reintentar" secondary disabled={busyId !== null || loading} onPress={() => void load()} /></>}
  </View>;
}
