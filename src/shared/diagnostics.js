export const DIAGNOSTIC_MAX_ENTRIES = 500;
export const DIAGNOSTIC_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const ALLOWED_CONTEXT_KEYS = new Set([
  "platform",
  "event",
  "requestId",
  "title",
  "durationMs",
  "queueWaitMs",
  "reason",
  "trigger",
  "hostname",
  "candidates",
  "visible",
  "eligible",
  "score",
  "cacheHit",
  "lookupMode",
  "status"
]);

export function sanitizeDiagnosticContext(context = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(context)) {
    if (!ALLOWED_CONTEXT_KEYS.has(key)) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) continue;
    sanitized[key] = typeof value === "string" ? value.slice(0, 160) : value;
  }
  return sanitized;
}

export function createDiagnosticEvent(event, context = {}, now = Date.now()) {
  return {
    timestamp: now,
    event: String(event || "unknown").slice(0, 80),
    ...sanitizeDiagnosticContext(context)
  };
}

export function appendDiagnosticEntry(logs, entry, { enabled, now = Date.now() }) {
  const current = Array.isArray(logs) ? logs : [];
  if (!enabled) return current;

  return [...current, entry]
    .filter((item) => Number.isFinite(item?.timestamp) && now - item.timestamp <= DIAGNOSTIC_RETENTION_MS)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-DIAGNOSTIC_MAX_ENTRIES);
}
