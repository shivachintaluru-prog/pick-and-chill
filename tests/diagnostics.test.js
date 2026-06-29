import test from "node:test";
import assert from "node:assert/strict";

import {
  DIAGNOSTIC_MAX_ENTRIES,
  DIAGNOSTIC_RETENTION_MS,
  appendDiagnosticEntry,
  createDiagnosticEvent,
  sanitizeDiagnosticContext
} from "../src/shared/diagnostics.js";
import { readFileSync } from "node:fs";

test("creates structured diagnostic events with sanitized context", () => {
  const event = createDiagnosticEvent(
    "lookup-success",
    {
      platform: "prime-video",
      requestId: "req-1",
      title: "Top Gun: Maverick",
      durationMs: 123,
      apiKey: "secret",
      url: "https://example.com/?token=secret",
      cookie: "private"
    },
    1_700_000_000_000
  );

  assert.deepEqual(event, {
    timestamp: 1_700_000_000_000,
    event: "lookup-success",
    platform: "prime-video",
    requestId: "req-1",
    title: "Top Gun: Maverick",
    durationMs: 123
  });
});

test("drops sensitive and unsupported diagnostic fields", () => {
  assert.deepEqual(
    sanitizeDiagnosticContext({
      apiKey: "secret",
      authorization: "bearer secret",
      cookie: "private",
      url: "https://example.com/?q=private",
      html: "<main>private</main>",
      platform: "hotstar",
      reason: "no-match"
    }),
    { platform: "hotstar", reason: "no-match" }
  );
});

test("does not persist diagnostics when debug mode is disabled", () => {
  const logs = [{ timestamp: 100, event: "existing" }];
  assert.deepEqual(appendDiagnosticEntry(logs, { timestamp: 200, event: "new" }, { enabled: false, now: 200 }), logs);
});

test("prunes expired diagnostics and caps the ring buffer", () => {
  const now = 1_700_000_000_000;
  const recent = Array.from({ length: DIAGNOSTIC_MAX_ENTRIES }, (_, index) => ({
    timestamp: now - index,
    event: `event-${index}`
  }));
  const expired = { timestamp: now - DIAGNOSTIC_RETENTION_MS - 1, event: "expired" };
  const next = { timestamp: now, event: "newest" };

  const result = appendDiagnosticEntry([expired, ...recent], next, { enabled: true, now });
  assert.equal(result.length, DIAGNOSTIC_MAX_ENTRIES);
  assert.equal(result.some((entry) => entry.event === "expired"), false);
  assert.equal(result.at(-1).event, "newest");
});

test("options page exposes diagnostic copy, download, and clear controls", () => {
  const html = readFileSync("src/options/options.html", "utf8");
  const script = readFileSync("src/options/options.js", "utf8");
  assert.match(html, /id="copy-logs"/);
  assert.match(html, /id="download-logs"/);
  assert.match(html, /id="clear-logs"/);
  assert.match(script, /ratings-and-chill:diagnostics:get/);
  assert.match(script, /ratings-and-chill:diagnostics:clear/);
});

test("manifest loads the content diagnostic bridge before the runtime", () => {
  const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.includes("src/content/diagnostics.js"));
  assert.ok(scripts.indexOf("src/content/diagnostics.js") < scripts.indexOf("src/content/runtime.js"));
});

test("rating lookups do not await diagnostic persistence", () => {
  const serviceWorker = readFileSync("src/background/service-worker.js", "utf8");
  assert.doesNotMatch(serviceWorker, /await recordDiagnostic\(/);
});
