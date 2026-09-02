import * as SecureStore from 'expo-secure-store';

import type { ProfileReview } from '../types/profile';

function safeAccountKey(username: string): string {
  const normalized = username.toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 48);
  return normalized || 'current_user';
}

function indexKey(username: string): string {
  return `profile_reviews_${safeAccountKey(username)}`;
}

function reviewKey(username: string, tmdbId: number): string {
  return `profile_review_${safeAccountKey(username)}_${tmdbId}`;
}

async function loadReviewIds(username: string): Promise<number[]> {
  const stored = await SecureStore.getItemAsync(indexKey(username));
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is number => Number.isInteger(value))
      : [];
  } catch {
    return [];
  }
}

export async function loadProfileReviews(username: string): Promise<ProfileReview[]> {
  const ids = await loadReviewIds(username);
  const storedReviews = await Promise.all(
    ids.map((tmdbId) => SecureStore.getItemAsync(reviewKey(username, tmdbId))),
  );

  return storedReviews
    .map((stored) => {
      if (!stored) {
        return null;
      }

      try {
        return JSON.parse(stored) as ProfileReview;
      } catch {
        return null;
      }
    })
    .filter((review): review is ProfileReview => review !== null)
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
}

export async function saveProfileReview(
  username: string,
  review: ProfileReview,
): Promise<void> {
  const ids = await loadReviewIds(username);
  const nextIds = [review.tmdbId, ...ids.filter((id) => id !== review.tmdbId)];

  await Promise.all([
    SecureStore.setItemAsync(reviewKey(username, review.tmdbId), JSON.stringify(review)),
    SecureStore.setItemAsync(indexKey(username), JSON.stringify(nextIds)),
  ]);
}
