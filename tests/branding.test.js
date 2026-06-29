import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const optionsHtml = readFileSync("src/options/options.html", "utf8");

test("extension uses Pick and Chill branding", () => {
  assert.equal(manifest.name, "Pick and Chill");
  assert.equal(manifest.action.default_title, "Pick and Chill");
  assert.match(optionsHtml, /Pick and Chill/);
});

test("extension declares generated icon assets", () => {
  assert.deepEqual(manifest.icons, {
    16: "assets/icons/icon-16.png",
    32: "assets/icons/icon-32.png",
    48: "assets/icons/icon-48.png",
    128: "assets/icons/icon-128.png"
  });
  assert.deepEqual(manifest.action.default_icon, manifest.icons);

  for (const iconPath of Object.values(manifest.icons)) {
    assert.equal(existsSync(iconPath), true, `${iconPath} should exist`);
  }
});

test("manifest covers all supported streaming platforms", () => {
  const matches = manifest.content_scripts.flatMap((entry) => entry.matches);
  assert.ok(matches.includes("https://www.netflix.com/*"));
  assert.ok(matches.includes("https://*.hotstar.com/*"));
  assert.ok(matches.includes("https://*.jiohotstar.com/*"));
  assert.ok(matches.includes("https://*.primevideo.com/*"));
  assert.ok(matches.includes("https://*.amazon.in/gp/video/*"));
  assert.ok(matches.includes("https://*.amazon.com/gp/video/*"));
});
