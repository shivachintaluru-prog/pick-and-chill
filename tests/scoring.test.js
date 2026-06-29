import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateRecommendation,
  labelForScore,
  parseImdbRating,
  parseRottenTomatoesRating
} from "../src/shared/scoring.js";

test("converts IMDb rating out of 10 into a percentage", () => {
  assert.equal(parseImdbRating("8.7"), 87);
});

test("parses Rotten Tomatoes percentage ratings", () => {
  assert.equal(parseRottenTomatoesRating("94%"), 94);
});

test("averages IMDb and Rotten Tomatoes when both are available", () => {
  const result = calculateRecommendation({
    imdbRating: "8.0",
    rottenTomatoesRating: "90%"
  });

  assert.deepEqual(result, {
    score: 85,
    label: "Must watch",
    sourceStatus: "complete",
    sources: {
      imdb: 80,
      rottenTomatoes: 90
    },
    displaySources: {
      imdb: "8.0/10",
      rottenTomatoes: "90%"
    }
  });
});

test("falls back to IMDb-only scoring when Rotten Tomatoes is missing", () => {
  const result = calculateRecommendation({
    imdbRating: "7.4",
    rottenTomatoesRating: null
  });

  assert.deepEqual(result, {
    score: 74,
    label: "Worth it",
    sourceStatus: "partial",
    sources: {
      imdb: 74,
      rottenTomatoes: null
    },
    displaySources: {
      imdb: "7.4/10",
      rottenTomatoes: "Unavailable"
    }
  });
});

test("returns no-score result when ratings are invalid or missing", () => {
  const result = calculateRecommendation({
    imdbRating: "N/A",
    rottenTomatoesRating: "N/A"
  });

  assert.deepEqual(result, {
    score: null,
    label: null,
    sourceStatus: "unavailable",
    sources: {
      imdb: null,
      rottenTomatoes: null
    },
    displaySources: {
      imdb: "Unavailable",
      rottenTomatoes: "Unavailable"
    }
  });
});

test("maps recommendation labels at threshold boundaries", () => {
  assert.equal(labelForScore(100), "Must watch");
  assert.equal(labelForScore(85), "Must watch");
  assert.equal(labelForScore(84), "Worth it");
  assert.equal(labelForScore(70), "Worth it");
  assert.equal(labelForScore(69), "Mixed");
  assert.equal(labelForScore(50), "Mixed");
  assert.equal(labelForScore(49), "Skip");
  assert.equal(labelForScore(0), "Skip");
});
