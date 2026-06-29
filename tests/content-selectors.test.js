import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contentScript = readFileSync("src/content/runtime.js", "utf8");
const netflixAdapter = readFileSync("src/content/adapters/netflix.js", "utf8");
const badgeStyles = readFileSync("src/styles/badge.css", "utf8");

test("content script does not use broad Netflix watch or title links as tile candidates", () => {
  assert.equal(netflixAdapter.includes("a[href*='/watch/']"), false);
  assert.equal(netflixAdapter.includes("a[href*='/title/']"), false);
});

test("content script skips Netflix preview overlays and action controls", () => {
  assert.match(netflixAdapter, /EXCLUDED_SELECTOR/);
  assert.match(netflixAdapter, /previewModal/);
  assert.match(netflixAdapter, /buttonControls/);
});

test("content script considers common Netflix image and metadata title sources", () => {
  assert.match(netflixAdapter, /boxart-container/);
  assert.match(netflixAdapter, /img\[alt\]/);
  assert.match(netflixAdapter, /\[aria-label\]/);
  assert.match(netflixAdapter, /\[data-title\]/);
});

test("content script prioritizes visible tiles and rescans on viewport changes", () => {
  assert.match(contentScript, /isTileInViewport/);
  assert.match(contentScript, /addEventListener\("scroll"/);
  assert.match(contentScript, /addEventListener\("resize"/);
  assert.match(contentScript, /requestScan/);
});

test("content script ignores mutations caused only by its own badges", () => {
  assert.match(contentScript, /isExtensionOnlyMutation/);
  assert.match(contentScript, /mutations\.every\(isExtensionOnlyMutation\)/);
});

test("must-watch shine is clipped to the badge label", () => {
  assert.match(badgeStyles, /\.ratings-and-chill-badge__label\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(badgeStyles, /\.ratings-and-chill-badge__label::before/);
  assert.doesNotMatch(badgeStyles, /\.ratings-and-chill-badge--must::before/);
});
