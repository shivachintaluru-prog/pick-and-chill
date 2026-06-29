import { buildCacheKey, createCacheEntry, isCacheEntryFresh } from "../shared/cache.js";
import { calculateRecommendation } from "../shared/scoring.js";
import { appendDiagnosticEntry, createDiagnosticEvent } from "../shared/diagnostics.js";

const STORAGE_KEYS = {
  apiKey: "omdbApiKey",
  debugMode: "debugMode",
  cache: "ratingsCache",
  diagnostics: "diagnosticLogs"
};

const LOOKUP_CACHE_VERSION = "lookup-v2";
const LOOKUP_DELAY_MS = 250;

let lookupQueue = Promise.resolve();
let diagnosticWriteQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return false;

  if (message.type === "ratings-and-chill:diagnostic") {
    recordDiagnostic(message.payload?.event, message.payload?.context);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "ratings-and-chill:diagnostics:get") {
    getDiagnostics().then(sendResponse);
    return true;
  }

  if (message.type === "ratings-and-chill:diagnostics:clear") {
    clearDiagnostics().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type !== "ratings-and-chill:lookup") return false;

  lookupRating(message.payload)
    .then(sendResponse)
    .catch((error) => {
      recordDiagnostic("lookup-exception", {
        platform: String(message.payload?.platform || "unknown"),
        requestId: String(message.payload?.requestId || ""),
        title: String(message.payload?.title || ""),
        reason: error?.message || "fetch-error"
      });
      sendResponse({
        ok: false,
        reason: "fetch-error",
        score: null,
        label: null,
        sourceStatus: "unavailable"
      });
    });

  return true;
});

async function lookupRating(payload) {
  const title = String(payload?.title || "").trim();
  const year = normalizeYear(payload?.year);
  const platform = String(payload?.platform || "unknown");
  const requestId = String(payload?.requestId || "");
  const startedAt = Date.now();

  if (!title) {
    return quietFailure("missing-title");
  }

  const settings = await chrome.storage.local.get([
    STORAGE_KEYS.apiKey,
    STORAGE_KEYS.debugMode,
    STORAGE_KEYS.cache
  ]);
  const apiKey = String(settings[STORAGE_KEYS.apiKey] || "").trim();
  const debugEnabled = Boolean(settings[STORAGE_KEYS.debugMode]);

  if (!apiKey) {
    recordDiagnostic("lookup-failure", { platform, requestId, title, reason: "missing-api-key" }, debugEnabled);
    return quietFailure("missing-api-key");
  }

  const cache = settings[STORAGE_KEYS.cache] || {};
  const cacheKey = buildLookupCacheKey(title, year);
  const cached = cache[cacheKey];

  if (isCacheEntryFresh(cached)) {
    recordDiagnostic("cache-hit", { platform, requestId, title, cacheHit: true }, debugEnabled);
    return {
      ...cached.value,
      cacheHit: true,
      debugMode: Boolean(settings[STORAGE_KEYS.debugMode])
    };
  }

  recordDiagnostic("cache-miss", { platform, requestId, title, cacheHit: false }, debugEnabled);
  const queuedAt = Date.now();
  recordDiagnostic("lookup-queued", { platform, requestId, title }, debugEnabled);
  const omdbResult = await enqueueOmdbLookup(async () => {
    recordDiagnostic(
      "lookup-started",
      { platform, requestId, title, queueWaitMs: Date.now() - queuedAt },
      debugEnabled
    );
    return fetchOmdbResult({ apiKey, title, year, platform, requestId, debugEnabled });
  });
  const normalized = normalizeOmdbResult(omdbResult);
  const result = {
    ...normalized,
    cacheHit: false,
    debugMode: Boolean(settings[STORAGE_KEYS.debugMode])
  };

  if (result.ok) {
    const latest = await chrome.storage.local.get([STORAGE_KEYS.cache]);
    const latestCache = latest[STORAGE_KEYS.cache] || {};
    latestCache[cacheKey] = createCacheEntry(result);
    await chrome.storage.local.set({ [STORAGE_KEYS.cache]: latestCache });
    recordDiagnostic(
      "lookup-success",
      { platform, requestId, title, score: result.score, durationMs: Date.now() - startedAt },
      debugEnabled
    );
  } else {
    recordDiagnostic(
      "lookup-failure",
      { platform, requestId, title, reason: result.reason, durationMs: Date.now() - startedAt },
      debugEnabled
    );
  }

  return result;
}

function buildLookupCacheKey(title, year) {
  return `${LOOKUP_CACHE_VERSION}::${buildCacheKey(title, year)}`;
}

function enqueueOmdbLookup(task) {
  const queuedLookup = lookupQueue.then(async () => {
    await wait(LOOKUP_DELAY_MS);
    return task();
  });

  lookupQueue = queuedLookup.catch(() => {});
  return queuedLookup;
}

function wait(durationMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function fetchOmdbResult({ apiKey, title, year, platform, requestId, debugEnabled }) {
  const diagnostic = { platform, requestId, title, debugEnabled };
  recordDiagnostic("omdb-exact-attempt", { platform, requestId, title, lookupMode: "exact" }, debugEnabled);
  const exactMatch = await fetchOmdbExactResult({ apiKey, title, year, diagnostic });
  if (exactMatch?.Response !== "False") {
    return exactMatch;
  }

  recordDiagnostic(
    "omdb-search-fallback",
    { platform, requestId, title, lookupMode: "search", reason: exactMatch?.Error || "exact-no-match" },
    debugEnabled
  );
  return fetchOmdbSearchResult({ apiKey, title, year, diagnostic });
}

async function fetchOmdbExactResult({ apiKey, title, year, diagnostic }) {
  const url = createOmdbUrl(apiKey);
  url.searchParams.set("t", title);

  if (year) {
    url.searchParams.set("y", year);
  }

  let data = await fetchOmdbJson(url, { ...diagnostic, lookupMode: "exact" });

  if (data?.Response === "False" && year) {
    url.searchParams.delete("y");
    data = await fetchOmdbJson(url, { ...diagnostic, lookupMode: "exact-without-year" });
  }

  return data;
}

async function fetchOmdbSearchResult({ apiKey, title, year, diagnostic }) {
  const url = createOmdbUrl(apiKey);
  url.searchParams.set("s", title);

  if (year) {
    url.searchParams.set("y", year);
  }

  let searchData = await fetchOmdbJson(url, { ...diagnostic, lookupMode: "search" });

  if (searchData?.Response === "False" && year) {
    url.searchParams.delete("y");
    searchData = await fetchOmdbJson(url, { ...diagnostic, lookupMode: "search-without-year" });
  }

  const searchMatch = bestSearchMatch(searchData?.Search, title);
  if (!searchMatch?.imdbID) {
    return searchData;
  }

  const detailsUrl = createOmdbUrl(apiKey);
  detailsUrl.searchParams.set("i", searchMatch.imdbID);
  return fetchOmdbJson(detailsUrl, { ...diagnostic, lookupMode: "id" });
}

async function fetchOmdbJson(url, diagnostic) {
  const startedAt = Date.now();
  const response = await fetch(url);
  recordDiagnostic(
    "omdb-response",
    {
      platform: diagnostic.platform,
      requestId: diagnostic.requestId,
      title: diagnostic.title,
      lookupMode: diagnostic.lookupMode,
      status: response.status,
      durationMs: Date.now() - startedAt
    },
    diagnostic.debugEnabled
  );
  return response.json();
}

function createOmdbUrl(apiKey) {
  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", apiKey);
  return url;
}

function normalizeOmdbResult(data) {
  if (!data || data.Response === "False") {
    return quietFailure("no-match");
  }

  const rottenTomatoesRating = findSourceRating(data.Ratings, "Rotten Tomatoes");
  const recommendation = calculateRecommendation({
    imdbRating: data.imdbRating,
    rottenTomatoesRating
  });

  if (recommendation.score === null) {
    return quietFailure("ratings-unavailable");
  }

  return {
    ok: true,
    title: data.Title || null,
    year: data.Year || null,
    score: recommendation.score,
    label: recommendation.label,
    sourceStatus: recommendation.sourceStatus,
    sources: recommendation.sources,
    displaySources: recommendation.displaySources
  };
}

function bestSearchMatch(results, title) {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const normalizedTitle = normalizeSearchTitle(title);
  return (
    results.find((result) => normalizeSearchTitle(result?.Title) === normalizedTitle) ||
    results.find((result) => normalizeSearchTitle(result?.Title).includes(normalizedTitle)) ||
    results[0]
  );
}

function findSourceRating(ratings, source) {
  if (!Array.isArray(ratings)) {
    return null;
  }

  const entry = ratings.find((rating) => rating?.Source === source);
  return entry?.Value || null;
}

function normalizeYear(year) {
  const match = String(year || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
}

function normalizeSearchTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function quietFailure(reason) {
  return {
    ok: false,
    reason,
    score: null,
    label: null,
    sourceStatus: "unavailable"
  };
}

function recordDiagnostic(event, context = {}, enabledOverride) {
  diagnosticWriteQueue = diagnosticWriteQueue.catch(() => {}).then(async () => {
    const settings = await chrome.storage.local.get([STORAGE_KEYS.debugMode, STORAGE_KEYS.diagnostics]);
    const enabled = typeof enabledOverride === "boolean" ? enabledOverride : Boolean(settings[STORAGE_KEYS.debugMode]);
    if (!enabled) return;

    const entry = createDiagnosticEvent(event, context);
    const logs = appendDiagnosticEntry(settings[STORAGE_KEYS.diagnostics], entry, { enabled: true });
    console.debug("[Pick and Chill]", entry);
    await chrome.storage.local.set({ [STORAGE_KEYS.diagnostics]: logs });
  });

  return diagnosticWriteQueue;
}

async function getDiagnostics() {
  await diagnosticWriteQueue.catch(() => {});
  const settings = await chrome.storage.local.get([STORAGE_KEYS.diagnostics]);
  return { ok: true, logs: Array.isArray(settings[STORAGE_KEYS.diagnostics]) ? settings[STORAGE_KEYS.diagnostics] : [] };
}

async function clearDiagnostics() {
  await diagnosticWriteQueue.catch(() => {});
  await chrome.storage.local.set({ [STORAGE_KEYS.diagnostics]: [] });
}
