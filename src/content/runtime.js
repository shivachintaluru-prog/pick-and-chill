(function registerRuntime(root) {
  function start({ adapters, diagnostics }) {
    const logger = diagnostics || { log() {} };
    const adapter = adapters.find((candidate) => candidate.matches(location.hostname));
    if (!adapter) {
      logger.log("unsupported-host", { hostname: location.hostname });
      return;
    }

    let scanScheduled = false;
    const requestScan = (trigger = "manual") => {
      logger.log("scan-requested", { platform: adapter.id, trigger });
      if (scanScheduled) return;
      scanScheduled = true;
      requestAnimationFrame(() => {
        scanScheduled = false;
        scanVisibleTiles(adapter, logger);
      });
    };

    const observer = new MutationObserver((mutations) => {
      if (mutations.every(isExtensionOnlyMutation)) return;
      requestScan("mutation");
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("scroll", () => requestScan("scroll"), { passive: true });
    window.addEventListener("resize", () => requestScan("resize"), { passive: true });

    logger.log("adapter-selected", { platform: adapter.id, hostname: location.hostname });
    requestScan("startup");
  }

  function scanVisibleTiles(adapter, logger) {
    const candidates = document.querySelectorAll(adapter.tileSelector);
    const roots = new Set();
    const counts = { candidates: candidates.length, visible: 0, eligible: 0 };
    logger.log("scan-started", { platform: adapter.id, candidates: candidates.length });

    for (const candidate of candidates) {
      try {
        const tile = adapter.findTileRoot(candidate);
        if (!tile || roots.has(tile)) continue;
        roots.add(tile);

        if (tile.dataset.pickAndChillProcessed === "true") {
          logger.log("tile-skipped", { platform: adapter.id, reason: "already-processed" });
          continue;
        }
        if (!isTileInViewport(tile)) {
          logger.log("tile-skipped", { platform: adapter.id, reason: "offscreen" });
          continue;
        }
        counts.visible += 1;

        const evaluation = adapter.evaluateTile(tile);
        if (!evaluation.eligible) {
          logger.log("tile-skipped", { platform: adapter.id, reason: evaluation.reason || "unsupported-type" });
          continue;
        }

        counts.eligible += 1;
        tile.dataset.pickAndChillProcessed = "true";
        renderLoadingBadge(tile);
        requestRating(tile, evaluation.metadata, adapter.id, logger);
      } catch (error) {
        logger.log("adapter-error", { platform: adapter.id, reason: error?.message || "unknown" });
      }
    }

    logger.log("scan-completed", { platform: adapter.id, ...counts });
  }

  async function requestRating(tile, metadata, platform, logger) {
    const requestId = createRequestId();
    logger.log("rating-requested", { platform, requestId, title: metadata.title });
    try {
      const result = await chrome.runtime.sendMessage({
        type: "ratings-and-chill:lookup",
        payload: { ...metadata, platform, requestId }
      });
      updateBadge(tile, result, metadata, platform, requestId, logger);
    } catch (error) {
      removeBadge(tile);
      logger.log("badge-removed", { platform, requestId, reason: error?.message || "message-error" });
    }
  }

  function updateBadge(tile, result, metadata, platform, requestId, logger) {
    if (result?.ok && Number.isFinite(result.score) && result.label) {
      const badge = ensureBadge(tile);
      badge.className = `ratings-and-chill-badge ratings-and-chill-badge--${toneForLabel(result.label)}`;
      badge.tabIndex = 0;
      badge.replaceChildren(createBadgeLabel(`${result.score}% ${result.label}`), createDetailCard(result));
      badge.title = sourceTitle(result);
      logger.log("badge-rendered", { platform, requestId, title: metadata.title, score: result.score });
      return;
    }

    if (result?.debugMode) {
      const badge = ensureBadge(tile);
      badge.className = "ratings-and-chill-badge ratings-and-chill-badge--debug";
      badge.textContent = "?";
      badge.title = `No rating match for ${metadata.title}`;
      logger.log("badge-debug-rendered", { platform, requestId, title: metadata.title, reason: result.reason });
      return;
    }

    removeBadge(tile);
    logger.log("badge-removed", { platform, requestId, title: metadata.title, reason: result?.reason || "no-result" });
  }

  function isTileInViewport(tile) {
    const rect = tile.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
  }

  function isExtensionOnlyMutation(mutation) {
    const target = mutation.target instanceof Element ? mutation.target : mutation.target?.parentElement;
    if (target?.closest(".ratings-and-chill-badge")) return true;

    const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return (
      changedNodes.length > 0 &&
      changedNodes.every(
        (node) => node instanceof Element && node.matches(".ratings-and-chill-badge")
      )
    );
  }

  function renderLoadingBadge(tile) {
    const badge = ensureBadge(tile);
    badge.className = "ratings-and-chill-badge ratings-and-chill-badge--loading";
    badge.removeAttribute("tabindex");
    badge.textContent = "...";
    badge.title = "Loading rating";
  }

  function ensureBadge(tile) {
    let badge = tile.querySelector(":scope > .ratings-and-chill-badge");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "ratings-and-chill-badge ratings-and-chill-badge--loading";
      tile.append(badge);
    }
    if (getComputedStyle(tile).position === "static") tile.style.position = "relative";
    return badge;
  }

  function removeBadge(tile) {
    tile.querySelector(":scope > .ratings-and-chill-badge")?.remove();
  }

  function createBadgeLabel(text) {
    const label = document.createElement("span");
    label.className = "ratings-and-chill-badge__label";
    label.textContent = text;
    return label;
  }

  function createDetailCard(result) {
    const card = document.createElement("span");
    card.className = "ratings-and-chill-card";
    card.setAttribute("aria-hidden", "true");
    const heading = document.createElement("span");
    heading.className = "ratings-and-chill-card__heading";
    heading.textContent = `${result.score}% ${result.label}`;
    card.append(heading);
    card.append(createSourceRow("IMDb", formatImdbSourceScore(result)));
    card.append(createSourceRow("RT", formatRottenTomatoesSourceScore(result)));
    if (result.sourceStatus === "partial") {
      const note = document.createElement("span");
      note.className = "ratings-and-chill-card__note";
      note.textContent = "Using available source only";
      card.append(note);
    }
    return card;
  }

  function createSourceRow(label, value) {
    const row = document.createElement("span");
    row.className = "ratings-and-chill-card__row";
    const source = document.createElement("span");
    source.className = "ratings-and-chill-card__source";
    source.textContent = label;
    const score = document.createElement("span");
    score.className = "ratings-and-chill-card__score";
    score.textContent = value;
    row.append(source, score);
    return row;
  }

  function toneForLabel(label) {
    return { "Must watch": "must", "Worth it": "worth", Mixed: "mixed", Skip: "skip" }[label] || "debug";
  }

  function formatImdbSourceScore(result) {
    if (typeof result.displaySources?.imdb === "string") return result.displaySources.imdb;
    return Number.isFinite(result.sources?.imdb) ? `${(result.sources.imdb / 10).toFixed(1)}/10` : "Unavailable";
  }

  function formatRottenTomatoesSourceScore(result) {
    if (typeof result.displaySources?.rottenTomatoes === "string") return result.displaySources.rottenTomatoes;
    return Number.isFinite(result.sources?.rottenTomatoes) ? `${result.sources.rottenTomatoes}%` : "Unavailable";
  }

  function sourceTitle(result) {
    const parts = [];
    if (Number.isFinite(result.sources?.imdb)) parts.push(`IMDb ${formatImdbSourceScore(result)}`);
    if (Number.isFinite(result.sources?.rottenTomatoes)) parts.push(`RT ${formatRottenTomatoesSourceScore(result)}`);
    return parts.length ? parts.join(" | ") : "Rating unavailable";
  }

  function createRequestId() {
    return globalThis.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  root.PickAndChillRuntime = { start, isTileInViewport };
})(globalThis);
