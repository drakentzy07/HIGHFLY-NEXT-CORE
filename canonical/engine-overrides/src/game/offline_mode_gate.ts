// HIGHFLY native is an offline-first product. The upstream engine's local Sim is
// a supported runtime here, not a dev-only convenience.
export function isOfflineModeAvailable(isDev: boolean): boolean {
  return isDev || import.meta.env.VITE_HIGHFLY_NATIVE === '1';
}
