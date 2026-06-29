(function registerNetflixAdapter(root) {
  const EXCLUDED_SELECTOR = [
    ".previewModal",
    ".previewModal--wrapper",
    ".bob-card",
    ".jawBone",
    ".buttonControls--container",
    ".ltr-1q9etc9"
  ].join(",");

  function cleanTitle(value) {
    const text = String(value || "")
      .replace(/^watch\s+/i, "")
      .replace(/^play\s+/i, "")
      .replace(/^explore\s+titles\s+related\s+to\s+/i, "")
      .replace(/^more\s+info\s+for\s+/i, "")
      .replace(/\b(19|20)\d{2}\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return text && text.length <= 120 ? text : "";
  }

  function extractTitle(tile) {
    const ownAttributes = ["aria-label", "title", "data-title"];
    for (const attribute of ownAttributes) {
      const title = cleanTitle(tile.getAttribute(attribute));
      if (title) return title;
    }

    const titleElement = tile.querySelector(
      ["img[alt]", "[aria-label]", "[data-title]", "[title]", ".fallback-text", ".fallback-text-container"].join(",")
    );
    if (titleElement) {
      const title = cleanTitle(
        titleElement.getAttribute("alt") ||
          titleElement.getAttribute("aria-label") ||
          titleElement.getAttribute("data-title") ||
          titleElement.getAttribute("title") ||
          titleElement.textContent
      );
      if (title) return title;
    }

    const link = tile.querySelector("a[aria-label], a[href]");
    return cleanTitle(link?.getAttribute("aria-label") || link?.textContent || tile.textContent);
  }

  function extractYear(value) {
    const match = String(value || "").match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : "";
  }

  const adapter = {
    id: "netflix",
    tileSelector: [".slider-item", ".title-card", "[data-uia*='title-card']", ".boxart-container", "img[alt]"].join(","),
    matches(hostname) {
      return hostname === "netflix.com" || hostname.endsWith(".netflix.com");
    },
    findTileRoot(element) {
      return (
        element.closest(".slider-item") ||
        element.closest(".title-card") ||
        element.closest("[data-uia*='title-card']") ||
        element.closest(".boxart-container")
      );
    },
    evaluateTile(tile) {
      if (tile.closest(EXCLUDED_SELECTOR)) return { eligible: false, reason: "excluded-region" };
      const inBrowseRow = tile.closest(".lolomoRow, .slider, .sliderContent, .aro-row");
      if (!inBrowseRow) return { eligible: false, reason: "excluded-region" };

      const title = extractTitle(tile);
      if (!title) return { eligible: false, reason: "missing-title" };
      return { eligible: true, metadata: { title, year: extractYear(tile.textContent) } };
    }
  };

  root.PickAndChillAdapters = root.PickAndChillAdapters || {};
  root.PickAndChillAdapters.netflix = adapter;
})(globalThis);
