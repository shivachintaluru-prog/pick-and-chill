import test from "node:test";
import assert from "node:assert/strict";

import {
  CACHE_TTL_MS,
  buildCacheKey,
  createCacheEntry,
  isCacheEntryFresh
} from "../src/shared/cache.js";

test("builds stable cache keys from normalized title and year", () => {
  assert.equal(buildCacheKey("  Stranger Things  ", "2016"), "stranger things::2016");
});

test("builds cache keys without year when year is missing", () => {
  assert.equal(buildCacheKey("Dark", null), "dark::");
});

test("creates cache entries with timestamp and payload", () => {
  const entry = createCacheEntry({ score: 92 }, 1_700_000_000_000);

  assert.deepEqual(entry, {
    savedAt: 1_700_000_000_000,
    value: { score: 92 }
  });
});

test("treats cache entries within seven days as fresh", () => {
  const now = 1_700_000_000_000;
  const entry = createCacheEntry({ score: 92 }, now - CACHE_TTL_MS + 1);

  assert.equal(isCacheEntryFresh(entry, now), true);
});

test("treats cache entries older than seven days as stale", () => {
  const now = 1_700_000_000_000;
  const entry = createCacheEntry({ score: 92 }, now - CACHE_TTL_MS - 1);

  assert.equal(isCacheEntryFresh(entry, now), false);
});

test("treats malformed cache entries as stale", () => {
  assert.equal(isCacheEntryFresh(null, Date.now()), false);
  assert.equal(isCacheEntryFresh({ savedAt: "yesterday" }, Date.now()), false);
});
