export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function buildCacheKey(title, year) {
  const normalizedTitle = normalizeTitle(title);
  const normalizedYear = typeof year === "string" || typeof year === "number" ? String(year).trim() : "";

  return `${normalizedTitle}::${normalizedYear}`;
}

export function createCacheEntry(value, savedAt = Date.now()) {
  return {
    savedAt,
    value
  };
}

export function isCacheEntryFresh(entry, now = Date.now()) {
  if (!entry || !Number.isFinite(entry.savedAt)) {
    return false;
  }

  return now - entry.savedAt <= CACHE_TTL_MS;
}

function normalizeTitle(title) {
  return String(title || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
