import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'jwt_token';
export const USERNAME_KEY = 'profile_username';
export const REMEMBERED_EMAIL_KEY = 'remembered_email';
export const REMEMBERED_LOGIN_KEY = 'remembered_login';

export function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export function saveToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token);
}

export function getUsername(): Promise<string | null> {
  return SecureStore.getItemAsync(USERNAME_KEY);
}

export function getRememberedEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY);
}

export async function getRememberedLogin(): Promise<string | null> {
  return (await SecureStore.getItemAsync(REMEMBERED_LOGIN_KEY))
    || getRememberedEmail();
}

function readTokenSubject(token: string): string | null {
  try {
    const encodedPayload = token.split('.')[1];
    const normalizedPayload = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );
    const payload = JSON.parse(globalThis.atob(paddedPayload)) as { sub?: string };
    return payload.sub?.trim() || null;
  } catch {
    return null;
  }
}

export async function getProfileName(): Promise<string> {
  const storedUsername = await getUsername();
  if (storedUsername?.trim()) {
    return storedUsername.trim();
  }

  const token = await getToken();
  if (token) {
    const subject = readTokenSubject(token);
    if (subject) {
      return subject.split('@')[0];
    }
  }

  return 'Cinéfilo';
}

export async function getAccountStorageKey(): Promise<string> {
  const token = await getToken();
  const subject = token ? readTokenSubject(token) : null;
  if (subject) {
    return subject;
  }

  return (await getUsername()) || 'current_user';
}

export async function saveSession(
  token: string,
  username: string,
  loginIdentifier?: string,
): Promise<void> {
  const writes = [
    SecureStore.setItemAsync(TOKEN_KEY, token),
    SecureStore.setItemAsync(USERNAME_KEY, username),
  ];

  if (loginIdentifier?.trim()) {
    writes.push(
      SecureStore.setItemAsync(REMEMBERED_LOGIN_KEY, loginIdentifier.trim()),
    );
  }

  await Promise.all(writes);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(USERNAME_KEY),
  ]);
}
