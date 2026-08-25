// HIGHFLY native builds are intentionally offline-first.
// Upstream ClaudeCraft exposes local Sim only in DEV; this deliberate seam
// allows the HIGHFLY build contract to opt into the same local engine in a
// production Vite bundle without enabling any online realm.
export function isOfflineModeAvailable(isDev: boolean): boolean {
  const env = import.meta.env as Record<string, unknown>;
  return isDev || env.VITE_HIGHFLY_OFFLINE === '1';
}
