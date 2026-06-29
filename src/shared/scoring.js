export function parseImdbRating(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const rating = Number.parseFloat(String(value));
  if (!Number.isFinite(rating) || rating < 0) {
    return null;
  }

  return clampPercent(Math.round(rating * 10));
}

export function parseRottenTomatoesRating(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/(\d{1,3})\s*%/);
  if (!match) {
    return null;
  }

  return clampPercent(Number.parseInt(match[1], 10));
}

export function labelForScore(score) {
  if (!Number.isFinite(score)) {
    return null;
  }

  if (score >= 85) {
    return "Must watch";
  }

  if (score >= 70) {
    return "Worth it";
  }

  if (score >= 50) {
    return "Mixed";
  }

  return "Skip";
}

export function calculateRecommendation({ imdbRating, rottenTomatoesRating }) {
  const imdb = parseImdbRating(imdbRating);
  const rottenTomatoes = parseRottenTomatoesRating(rottenTomatoesRating);
  const displaySources = {
    imdb: formatImdbDisplayRating(imdbRating),
    rottenTomatoes: rottenTomatoes === null ? "Unavailable" : `${rottenTomatoes}%`
  };
  const availableScores = [imdb, rottenTomatoes].filter((score) => score !== null);

  if (availableScores.length === 0) {
    return {
      score: null,
      label: null,
      sourceStatus: "unavailable",
      sources: {
        imdb: null,
        rottenTomatoes: null
      },
      displaySources
    };
  }

  const score = Math.round(
    availableScores.reduce((total, current) => total + current, 0) / availableScores.length
  );

  return {
    score,
    label: labelForScore(score),
    sourceStatus: imdb !== null && rottenTomatoes !== null ? "complete" : "partial",
    sources: {
      imdb,
      rottenTomatoes
    },
    displaySources
  };
}

export function formatImdbDisplayRating(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "Unavailable";
  }

  const rating = Number.parseFloat(String(value));
  if (!Number.isFinite(rating) || rating < 0) {
    return "Unavailable";
  }

  return `${rating.toFixed(1)}/10`;
}

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, value));
}
