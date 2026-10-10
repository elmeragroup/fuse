import type { ThemeSlug } from "@elmeragroup/fuse/theme";

import type { StudioSeed } from "./seed";

/** Where the base theme's seed stands: in flight, loaded, or failed until a retry. */
export type SeedState =
  | { readonly status: "loading"; readonly slug: ThemeSlug }
  | { readonly status: "ready"; readonly slug: ThemeSlug; readonly seed: StudioSeed }
  | { readonly status: "failed"; readonly slug: ThemeSlug };

/** The base theme's seed, loaded on request, for `useSyncExternalStore`. */
export type SeedStore = {
  /** The seed's state for the theme requested last, `undefined` before any request. */
  getState: () => SeedState | undefined;
  subscribe: (listener: () => void) => () => void;
  /** Loads `slug`'s seed unless it is the theme requested last; a failure waits for `retry`. */
  request: (slug: ThemeSlug) => void;
  /** Loads the requested theme's seed again after a failure. */
  retry: () => void;
};

/**
 * A seed store over `load`. Only the theme requested last counts: a load that settles after
 * another theme was requested is ignored, whether it succeeded or failed.
 *
 * @param load - Loads one theme's seed, such as a generated chunk's dynamic import.
 */
export function createSeedStore(load: (slug: ThemeSlug) => Promise<StudioSeed>): SeedStore {
  let state: SeedState | undefined;
  const listeners = new Set<() => void>();
  const set = (next: SeedState) => {
    state = next;
    for (const listener of listeners) {
      listener();
    }
  };
  const start = (slug: ThemeSlug) => {
    const loading: SeedState = { status: "loading", slug };
    set(loading);
    load(slug).then(
      (seed) => {
        if (state === loading) {
          set({ status: "ready", slug, seed });
        }
      },
      () => {
        if (state === loading) {
          set({ status: "failed", slug });
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
      if (state?.slug !== slug) {
        start(slug);
      }
    },
    retry: () => {
      if (state?.status === "failed") {
        start(state.slug);
      }
    },
  };
}
