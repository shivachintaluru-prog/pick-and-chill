import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function loadAdapters() {
  const context = vm.createContext({ console });
  for (const file of ["netflix", "hotstar", "prime-video"]) {
    vm.runInContext(readFileSync(`src/content/adapters/${file}.js`, "utf8"), context);
  }
  return context.PickAndChillAdapters;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("registers adapters for Netflix, JioHotstar, and Prime Video", () => {
  const adapters = loadAdapters();
  assert.deepEqual(Object.keys(adapters).sort(), ["hotstar", "netflix", "primeVideo"]);
  for (const adapter of Object.values(adapters)) {
    assert.equal(typeof adapter.matches, "function");
    assert.equal(typeof adapter.findTileRoot, "function");
    assert.equal(typeof adapter.evaluateTile, "function");
    assert.equal(typeof adapter.tileSelector, "string");
  }
});

test("selects adapters by supported hostnames", () => {
  const adapters = loadAdapters();
  assert.equal(adapters.netflix.matches("www.netflix.com"), true);
  assert.equal(adapters.hotstar.matches("www.hotstar.com"), true);
  assert.equal(adapters.hotstar.matches("www.jiohotstar.com"), true);
  assert.equal(adapters.primeVideo.matches("www.primevideo.com"), true);
  assert.equal(adapters.primeVideo.matches("www.amazon.in"), true);
  assert.equal(adapters.primeVideo.matches("example.com"), false);
});

test("parses JioHotstar movie and show labels and rejects other content", () => {
  const adapter = loadAdapters().hotstar;
  assert.deepEqual(plain(adapter.parseLabel("Vivah,Movie")), {
    eligible: true,
    metadata: { title: "Vivah", year: "" }
  });
  assert.deepEqual(plain(adapter.parseLabel("Save The Tigers,Show")), {
    eligible: true,
    metadata: { title: "Save The Tigers", year: "" }
  });
  assert.deepEqual(plain(adapter.parseLabel("India vs Australia,Live")), {
    eligible: false,
    reason: "unsupported-type"
  });
});

test("accepts only Prime Video movies and TV shows", () => {
  const adapter = loadAdapters().primeVideo;
  assert.deepEqual(plain(adapter.parseCardMetadata("Top Gun: Maverick", "Movie")), {
    eligible: true,
    metadata: { title: "Top Gun: Maverick", year: "" }
  });
  assert.deepEqual(plain(adapter.parseCardMetadata("The Family Man", "TV Show")), {
    eligible: true,
    metadata: { title: "The Family Man", year: "" }
  });
  assert.deepEqual(plain(adapter.parseCardMetadata("Live Cricket", "Live Event")), {
    eligible: false,
    reason: "unsupported-type"
  });
});

test("removes Prime Video season suffixes without changing movie sequel titles", () => {
  const adapter = loadAdapters().primeVideo;
  assert.deepEqual(plain(adapter.parseCardMetadata("Off Campus - Season 1", "TV Show")), {
    eligible: true,
    metadata: { title: "Off Campus", year: "" }
  });
  assert.deepEqual(plain(adapter.parseCardMetadata("Two and a Half Men, Season 4", "TV Show")), {
    eligible: true,
    metadata: { title: "Two and a Half Men", year: "" }
  });
  assert.deepEqual(plain(adapter.parseCardMetadata("Drishyam 3", "Movie")), {
    eligible: true,
    metadata: { title: "Drishyam 3", year: "" }
  });
});
