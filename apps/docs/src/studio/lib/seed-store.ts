import type { ThemeSlug } from "@elmeragroup/fuse/theme";

import type { StudioSeed } from "./seed";

/** Where one theme's seed stands: in flight, loaded, or failed until a retry. */
export type SeedState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly seed: StudioSeed }
  | { readonly status: "failed" };

/**
 * The seeds of every theme the studio renders, the base theme's and each artboard's own, loaded
 * on request, for `useSyncExternalStore`.
 */
export type SeedCache = {
  /** Each requested theme's load. A change replaces the map, so a new map is a new snapshot. */
  getState: () => ReadonlyMap<ThemeSlug, SeedState>;
  subscribe: (listener: () => void) => () => void;
  /** Loads `slug`'s seed unless it was requested before; a failure waits for `retry`. */
  request: (slug: ThemeSlug) => void;
  /** Loads every failed theme's seed again. */
  retry: () => void;
};

/**
 * A seed cache over `load`. Each theme loads once, and again on a retry after it failed.
 *
 * @param load - Loads one theme's seed, such as a generated chunk's dynamic import.
 */
export function createSeedCache(load: (slug: ThemeSlug) => Promise<StudioSeed>): SeedCache {
  let state: ReadonlyMap<ThemeSlug, SeedState> = new Map();
  const listeners = new Set<() => void>();
  const set = (slug: ThemeSlug, next: SeedState) => {
    state = new Map(state).set(slug, next);
    for (const listener of listeners) {
      listener();
    }
  };
  const start = (slug: ThemeSlug) => {
    const loading: SeedState = { status: "loading" };
    set(slug, loading);
    load(slug).then(
      (seed) => {
        if (state.get(slug) === loading) {
          set(slug, { status: "ready", seed });
        }
      },
      () => {
        if (state.get(slug) === loading) {
          set(slug, { status: "failed" });
        }
      }
    );
  };
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    request: (slug) => {
      if (!state.has(slug)) {
        start(slug);
      }
    },
    retry: () => {
      for (const [slug, load] of state) {
        if (load.status === "failed") {
          start(slug);
        }
      }
    },
  };
}

/**
 * Whether the seed of any theme in `needed` failed to load. A failed theme outside `needed`, one
 * no longer on screen, does not count, though the cache keeps it for a retry.
 *
 * @param loads - Each requested theme's load, as the cache reports it.
 * @param needed - The slugs of the themes on screen.
 */
export function failedAmong(loads: ReadonlyMap<ThemeSlug, SeedState>, needed: Iterable<ThemeSlug>): boolean {
  return [...needed].some((slug) => loads.get(slug)?.status === "failed");
}
