/**
 * The marker `@elmeragroup/fuse/temporal-polyfill` sets on `globalThis` once it has run, and the
 * one read of whether the host has a Temporal. A registry symbol, so two copies of Fuse in one
 * page agree on it. Its own module, so the polyfill entry carries nothing else of the Temporal core.
 */
export const TEMPORAL_INSTALL_MARKER: unique symbol = Symbol.for("@elmeragroup/fuse/temporal");

/**
 * The Temporal on `globalThis` as it stands now. The value, not `in`: a host that removed Temporal
 * by setting it to `undefined` or `null` lacks it too.
 *
 * @returns `globalThis.Temporal`, or `undefined` when the host has none.
 */
export function hostTemporal(): typeof Temporal | undefined {
  // TypeScript's lib declares `Temporal` on every global, so the global is widened to read it.
  const host: { readonly Temporal?: typeof Temporal | null } = globalThis;
  return host.Temporal ?? undefined;
}
