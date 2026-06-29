const STORAGE_KEYS = {
  apiKey: "omdbApiKey",
  debugMode: "debugMode"
};

const form = document.querySelector("#settings-form");
const apiKeyInput = document.querySelector("#api-key");
const debugModeInput = document.querySelector("#debug-mode");
const status = document.querySelector("#status");
const copyLogsButton = document.querySelector("#copy-logs");
const downloadLogsButton = document.querySelector("#download-logs");
const clearLogsButton = document.querySelector("#clear-logs");
const diagnosticStatus = document.querySelector("#diagnostic-status");

loadSettings();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const debugMode = debugModeInput.checked;

  await chrome.storage.local.set({
    [STORAGE_KEYS.apiKey]: apiKey,
    [STORAGE_KEYS.debugMode]: debugMode
  });

  if (!debugMode) {
    await clearDiagnostics();
  }

  status.textContent = apiKey ? "Settings saved." : "Settings saved. Add an OMDb key to show badges.";
  await refreshDiagnosticStatus();
});

copyLogsButton.addEventListener("click", async () => {
  const logs = await getDiagnostics();
  await navigator.clipboard.writeText(formatExport(logs));
  diagnosticStatus.textContent = `Copied ${logs.length} diagnostic events.`;
});

downloadLogsButton.addEventListener("click", async () => {
  const logs = await getDiagnostics();
  const blob = new Blob([formatExport(logs)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pick-and-chill-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  link.click();
  URL.revokeObjectURL(url);
  diagnosticStatus.textContent = `Downloaded ${logs.length} diagnostic events.`;
});

clearLogsButton.addEventListener("click", async () => {
  await clearDiagnostics();
  diagnosticStatus.textContent = "Diagnostic logs cleared.";
});

async function loadSettings() {
  const settings = await chrome.storage.local.get([STORAGE_KEYS.apiKey, STORAGE_KEYS.debugMode]);

  apiKeyInput.value = settings[STORAGE_KEYS.apiKey] || "";
  debugModeInput.checked = Boolean(settings[STORAGE_KEYS.debugMode]);
  status.textContent = apiKeyInput.value ? "OMDb key is saved." : "No OMDb key saved yet.";
  await refreshDiagnosticStatus();
}

async function getDiagnostics() {
  const response = await chrome.runtime.sendMessage({ type: "ratings-and-chill:diagnostics:get" });
  return Array.isArray(response?.logs) ? response.logs : [];
}

async function clearDiagnostics() {
  await chrome.runtime.sendMessage({ type: "ratings-and-chill:diagnostics:clear" });
}

async function refreshDiagnosticStatus() {
  const logs = await getDiagnostics();
  diagnosticStatus.textContent = debugModeInput.checked
    ? `Diagnostics enabled. ${logs.length} events stored.`
    : "Diagnostics disabled.";
}

function formatExport(logs) {
  return JSON.stringify(
    {
      product: "Pick and Chill",
      exportedAt: new Date().toISOString(),
      events: logs
    },
    null,
    2
  );
}
