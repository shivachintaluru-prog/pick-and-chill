(function startPickAndChill(root) {
  const adapters = Object.values(root.PickAndChillAdapters || {});
  root.PickAndChillRuntime?.start({
    adapters,
    diagnostics: root.PickAndChillDiagnostics
  });
})(globalThis);
