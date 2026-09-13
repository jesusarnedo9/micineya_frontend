import * as SecureStore from 'expo-secure-store';

function key(account: string) { return `popcorn_seen_${account.replace(/[^a-zA-Z0-9._-]/g, '_')}`; }
const pendingWrites = new Map<string, Promise<void>>();

function write(storageKey: string, operation: () => Promise<void>): Promise<void> {
  const pending = (pendingWrites.get(storageKey) ?? Promise.resolve()).catch(() => {}).then(operation);
  pendingWrites.set(storageKey, pending);
  const cleanup = () => { if (pendingWrites.get(storageKey) === pending) pendingWrites.delete(storageKey); };
  void pending.then(cleanup, cleanup);
  return pending;
}

export async function loadSeenPopcorn(userId: number): Promise<number> {
  const storageKey = key(`account_${userId}`);
  // Al volver rápido al perfil, esperar el último checkpoint de la animación anterior.
  await pendingWrites.get(storageKey)?.catch(() => {});
  const stored = await SecureStore.getItemAsync(storageKey);
  const value = Number(stored);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export async function saveSeenPopcorn(userId: number, count: number): Promise<void> {
  const storageKey = key(`account_${userId}`);
  await write(storageKey, () => SecureStore.setItemAsync(storageKey, String(count)));
}

export async function clearPopcornProgress(account: string): Promise<void> {
  const storageKey = key(account);
  const badgesKey = `${storageKey}_badges`;
  seenBadges.delete(badgesKey);
  await Promise.all([
    write(storageKey, () => SecureStore.deleteItemAsync(storageKey)),
    write(badgesKey, () => SecureStore.deleteItemAsync(badgesKey)),
  ]);
}

const seenBadges = new Map<string, Set<string>>();
export async function loadSeenBadges(userId: number): Promise<Set<string>> {
  const storageKey = `${key(`account_${userId}`)}_badges`;
  await pendingWrites.get(storageKey)?.catch(() => {});
  if (seenBadges.has(storageKey)) return new Set(seenBadges.get(storageKey));
  const raw = await SecureStore.getItemAsync(storageKey);
  const parsed: unknown = raw ? JSON.parse(raw) : [];
  const values = new Set<string>(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []);
  seenBadges.set(storageKey, values);
  return new Set(values);
}

export async function rememberBadge(userId: number, badge: string): Promise<void> {
  const storageKey = `${key(`account_${userId}`)}_badges`;
  // Keep it seen during this session even if secure storage temporarily fails.
  const values = seenBadges.get(storageKey) ?? new Set<string>();
  values.add(badge);
  seenBadges.set(storageKey, values);
  await write(storageKey, () => SecureStore.setItemAsync(storageKey, JSON.stringify([...values])));
}
