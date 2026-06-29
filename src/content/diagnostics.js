(function registerContentDiagnostics(root) {
  let enabled = false;
  const ready = chrome.storage.local.get(["debugMode"]).then((settings) => {
    enabled = Boolean(settings.debugMode);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.debugMode) enabled = Boolean(changes.debugMode.newValue);
  });

  function log(event, context = {}) {
    ready.then(() => {
      if (!enabled) return;
      console.debug("[Pick and Chill]", event, context);
      chrome.runtime.sendMessage({
        type: "ratings-and-chill:diagnostic",
        payload: { event, context }
      }).catch(() => {});
    });
  }

  root.PickAndChillDiagnostics = { log };
})(globalThis);
