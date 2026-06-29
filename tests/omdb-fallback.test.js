import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const serviceWorker = readFileSync("src/background/service-worker.js", "utf8");

test("service worker falls back from exact title lookup to OMDb search", () => {
  assert.match(serviceWorker, /fetchOmdbSearchResult/);
  assert.match(serviceWorker, /searchParams\.set\("s", title\)/);
  assert.match(serviceWorker, /searchParams\.set\("i", searchMatch\.imdbID\)/);
});

test("service worker returns display source labels from scoring", () => {
  assert.match(serviceWorker, /displaySources: recommendation\.displaySources/);
});

test("service worker invalidates older lookup cache entries after lookup changes", () => {
  assert.match(serviceWorker, /LOOKUP_CACHE_VERSION/);
  assert.match(serviceWorker, /buildLookupCacheKey/);
});

test("service worker only caches successful rating lookups", () => {
  assert.match(serviceWorker, /if \(result\.ok\)/);
  assert.match(serviceWorker, /latestCache\[cacheKey\] = createCacheEntry\(result\)/);
  assert.match(serviceWorker, /\[STORAGE_KEYS\.cache\]: latestCache/);
});

test("service worker queues uncached OMDb lookups to avoid request bursts", () => {
  assert.match(serviceWorker, /LOOKUP_DELAY_MS/);
  assert.match(serviceWorker, /enqueueOmdbLookup/);
  assert.match(serviceWorker, /lookupQueue/);
  assert.match(serviceWorker, /await enqueueOmdbLookup/);
});
