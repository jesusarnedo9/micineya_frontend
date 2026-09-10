import * as SecureStore from 'expo-secure-store';

import type { ProfileReview } from '../types/profile';
import { mediaTypeOf, type MediaType } from '../types/movie';

type StoredId = number | `tv_${number}`;
const storedId = (id: number, type: MediaType): StoredId => type === 'tv' ? `tv_${id}` : id;
const writes = new Map<string, Promise<void>>();
function serialize(account: string, operation: () => Promise<void>): Promise<void> {
  const key = safeAccountKey(account);
  const task = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
  writes.set(key, task);
  void task.finally(() => { if (writes.get(key) === task) writes.delete(key); }).catch(() => {});
  return task;
}

function safeAccountKey(username: string): string {
  const normalized = username.toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 48);
  return normalized || 'current_user';
}

function indexKey(username: string): string {
  return `profile_reviews_${safeAccountKey(username)}`;
}

function reviewKey(username: string, tmdbId: StoredId): string {
  return `profile_review_${safeAccountKey(username)}_${tmdbId}`;
}

async function loadReviewIds(username: string): Promise<StoredId[]> {
  const stored = await SecureStore.getItemAsync(indexKey(username));
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is StoredId => (Number.isInteger(value) && value > 0)
          || (typeof value === 'string' && /^tv_[1-9][0-9]*$/.test(value)))
      : [];
  } catch {
    return [];
  }
}

export async function loadProfileReviews(username: string): Promise<ProfileReview[]> {
  await writes.get(safeAccountKey(username))?.catch(() => {});
  const ids = await loadReviewIds(username);
  const storedReviews = await Promise.all(
    ids.map((tmdbId) => SecureStore.getItemAsync(reviewKey(username, tmdbId))),
  );

  return storedReviews
    .map((stored, index) => {
      if (!stored) {
        return null;
      }

      try {
        const review = JSON.parse(stored) as ProfileReview;
        if (!Number.isInteger(review.tmdbId) || typeof review.title !== 'string' || typeof review.reviewedAt !== 'string') return null;
        return { ...review, mediaType: typeof ids[index] === 'string' ? 'tv' as const : 'movie' as const,
          seasonsWatched: review.seasonsWatched ?? [] } as ProfileReview;
      } catch {
        return null;
      }
    })
    .filter((review): review is ProfileReview => review !== null)
    .sort((a, b) => (b.watchedAt ?? b.reviewedAt).localeCompare(a.watchedAt ?? a.reviewedAt));
}

async function saveNow(
  username: string,
  review: ProfileReview,
): Promise<void> {
  const ids = await loadReviewIds(username);
  const id = storedId(review.tmdbId, mediaTypeOf(review));
  const nextIds = [id, ...ids.filter((value) => value !== id)];

  await Promise.all([
    SecureStore.setItemAsync(reviewKey(username, id), JSON.stringify(review)),
    SecureStore.setItemAsync(indexKey(username), JSON.stringify(nextIds)),
  ]);
}

async function deleteNow(
  username: string,
  tmdbId: number,
  type: MediaType = 'movie',
): Promise<void> {
  const ids = await loadReviewIds(username);
  const target = storedId(tmdbId, type);
  await Promise.all([
    SecureStore.deleteItemAsync(reviewKey(username, target)),
    SecureStore.setItemAsync(
      indexKey(username),
      JSON.stringify(ids.filter((id) => id !== target)),
    ),
  ]);
}

async function clearNow(accountKey: string): Promise<void> {
  const ids = await loadReviewIds(accountKey);
  await Promise.all(ids.map((id) => SecureStore.deleteItemAsync(reviewKey(accountKey, id))));
  await SecureStore.deleteItemAsync(indexKey(accountKey));
}

export function saveProfileReview(account: string, review: ProfileReview): Promise<void> {
  return serialize(account, () => saveNow(account, review));
}
export function deleteProfileReview(account: string, id: number, type: MediaType = 'movie'): Promise<void> {
  return serialize(account, () => deleteNow(account, id, type));
}
export function clearProfileReviews(account: string): Promise<void> {
  return serialize(account, () => clearNow(account));
}
