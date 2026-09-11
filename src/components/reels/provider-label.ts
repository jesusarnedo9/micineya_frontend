const SHORT_NAMES: Record<string, string> = {
  'Amazon Prime Video': 'Prime Video',
  'Disney Plus': 'Disney+',
  'Apple TV Plus': 'Apple TV+',
  'Paramount Plus': 'Paramount+',
  'HBO Max': 'Max',
};

export function formatPlatforms(platforms?: string[]): string | null {
  if (!platforms?.length) return null;
  const names = [...new Set(platforms.map((name) => SHORT_NAMES[name] ?? name))];
  return names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0];
}
