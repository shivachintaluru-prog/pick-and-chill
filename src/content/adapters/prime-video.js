(function registerPrimeVideoAdapter(root) {
  const SUPPORTED_TYPES = new Set(["Movie", "TV Show"]);

  function parseCardMetadata(titleValue, entityType) {
    if (!SUPPORTED_TYPES.has(entityType)) return { eligible: false, reason: "unsupported-type" };
    const rawTitle = String(titleValue || "").trim();
    const title = entityType === "TV Show"
      ? rawTitle.replace(/\s*(?:-|,)\s*Season\s+\d+\s*$/i, "").trim()
      : rawTitle;
    if (!title) return { eligible: false, reason: "missing-title" };
    return { eligible: true, metadata: { title, year: "" } };
  }

  const adapter = {
    id: "prime-video",
    tileSelector: 'article[data-testid="card"]',
    matches(hostname) {
      return (
        hostname === "primevideo.com" ||
        hostname.endsWith(".primevideo.com") ||
        hostname === "amazon.in" ||
        hostname.endsWith(".amazon.in") ||
        hostname === "amazon.com" ||
        hostname.endsWith(".amazon.com")
      );
    },
    findTileRoot(element) {
      return element.closest('article[data-testid="card"]');
    },
    evaluateTile(tile) {
      return parseCardMetadata(tile.getAttribute("data-card-title"), tile.getAttribute("data-card-entity-type"));
    },
    parseCardMetadata
  };

  root.PickAndChillAdapters = root.PickAndChillAdapters || {};
  root.PickAndChillAdapters.primeVideo = adapter;
})(globalThis);
