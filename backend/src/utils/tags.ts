export function normalizeTagName(tag: string) {
  return tag.trim().toLowerCase();
}

export function sanitizeTags(tags: string[]) {
  const unique = new Map<string, string>();

  for (const rawTag of tags) {
    const trimmed = rawTag.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = normalizeTagName(trimmed);
    if (!unique.has(normalized)) {
      unique.set(normalized, trimmed);
    }
  }

  return [...unique.entries()].map(([normalizedName, name]) => ({
    name,
    normalizedName,
  }));
}
