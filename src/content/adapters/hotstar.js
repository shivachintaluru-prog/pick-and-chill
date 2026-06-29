(function registerHotstarAdapter(root) {
  function parseLabel(label) {
    const value = String(label || "").trim();
    const match = value.match(/^(.*),(Movie|Show)$/);
    if (!match) return { eligible: false, reason: "unsupported-type" };

    const title = match[1].trim();
    if (!title) return { eligible: false, reason: "missing-title" };
    return { eligible: true, metadata: { title, year: "" } };
  }

  const adapter = {
    id: "hotstar",
    tileSelector: '[data-testid="tray-card-default"]',
    matches(hostname) {
      return (
        hostname === "hotstar.com" ||
        hostname.endsWith(".hotstar.com") ||
        hostname === "jiohotstar.com" ||
        hostname.endsWith(".jiohotstar.com")
      );
    },
    findTileRoot(element) {
      return element.closest('[data-testid="tray-card-default"]');
    },
    evaluateTile(tile) {
      const action = tile.querySelector('[data-testid="action"][aria-label]');
      if (!action) return { eligible: false, reason: "missing-title" };
      return parseLabel(action.getAttribute("aria-label"));
    },
    parseLabel
  };

  root.PickAndChillAdapters = root.PickAndChillAdapters || {};
  root.PickAndChillAdapters.hotstar = adapter;
})(globalThis);
