import { describe, expect, it } from "vitest";

import type { ThemeSlug } from "@elmeragroup/fuse/theme";

import type { StudioSchemeSeed, StudioSeed } from "../src/lib/studio/seed";
import { createSeedStore } from "../src/lib/studio/seed-store";
import type { SeedState } from "../src/lib/studio/seed-store";

const ELMA: ThemeSlug = "external-elma-private";
const FKAS: ThemeSlug = "internal-fkas-private";

/** A seed the loader under test hands back; the store never reads into it. */
function fakeSeed(slug: ThemeSlug): StudioSeed {
  // SAFETY: the store passes a seed through untouched, so an empty scheme stands in.
  const scheme = {} as StudioSchemeSeed;
  return { slug, light: scheme, dark: scheme };
}

type Pending = { slug: ThemeSlug; resolve: (seed: StudioSeed) => void; reject: (error: Error) => void };

/** A loader whose calls stay pending until the test settles them, in call order. */
function deferredLoader() {
  const calls: Pending[] = [];
  const load = (slug: ThemeSlug) =>
    new Promise<StudioSeed>((resolve, reject) => {
      calls.push({ slug, resolve, reject });
    });
  return { calls, load };
}

/** Lets the store's promise handlers run. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function stateOf(store: { getState: () => SeedState | undefined }) {
  const state = store.getState();
  return state === undefined ? undefined : { status: state.status, slug: state.slug };
}

describe("createSeedStore", () => {
  it("loads a theme's seed and reports it ready", async () => {
    const { calls, load } = deferredLoader();
    const store = createSeedStore(load);
    store.request(ELMA);
    expect(stateOf(store)).toEqual({ status: "loading", slug: ELMA });
    calls[0]?.resolve(fakeSeed(ELMA));
    await settle();
    expect(store.getState()).toEqual({ status: "ready", slug: ELMA, seed: fakeSeed(ELMA) });
  });

  it("reports a failed load, and a retry loads it again", async () => {
    const { calls, load } = deferredLoader();
    const store = createSeedStore(load);
    const seen: (string | undefined)[] = [];
    store.subscribe(() => {
      seen.push(store.getState()?.status);
    });
    store.request(ELMA);
    calls[0]?.reject(new Error("ChunkLoadError"));
    await settle();
    expect(stateOf(store)).toEqual({ status: "failed", slug: ELMA });

    store.retry();
    expect(stateOf(store)).toEqual({ status: "loading", slug: ELMA });
    expect(calls.map((call) => call.slug)).toEqual([ELMA, ELMA]);
    calls[1]?.resolve(fakeSeed(ELMA));
    await settle();
    expect(stateOf(store)).toEqual({ status: "ready", slug: ELMA });
    expect(seen).toEqual(["loading", "failed", "loading", "ready"]);
  });

  it("ignores a stale load that succeeds after another theme was requested", async () => {
    const { calls, load } = deferredLoader();
    const store = createSeedStore(load);
    store.request(ELMA);
    store.request(FKAS);
    calls[0]?.resolve(fakeSeed(ELMA));
    await settle();
    expect(stateOf(store)).toEqual({ status: "loading", slug: FKAS });
    calls[1]?.resolve(fakeSeed(FKAS));
    await settle();
    expect(store.getState()).toEqual({ status: "ready", slug: FKAS, seed: fakeSeed(FKAS) });
  });

  it("ignores a stale load that fails after another theme was requested", async () => {
    const { calls, load } = deferredLoader();
    const store = createSeedStore(load);
    store.request(ELMA);
    store.request(FKAS);
    calls[0]?.reject(new Error("ChunkLoadError"));
    await settle();
    expect(stateOf(store)).toEqual({ status: "loading", slug: FKAS });
    calls[1]?.resolve(fakeSeed(FKAS));
    await settle();
    expect(store.getState()).toEqual({ status: "ready", slug: FKAS, seed: fakeSeed(FKAS) });
  });

  it("does not reload a theme that is loading or ready, and retries only a failure", async () => {
    const { calls, load } = deferredLoader();
    const store = createSeedStore(load);
    store.request(ELMA);
    store.request(ELMA);
    store.retry();
    expect(calls).toHaveLength(1);
    calls[0]?.resolve(fakeSeed(ELMA));
    await settle();
    store.request(ELMA);
    store.retry();
    expect(calls).toHaveLength(1);
  });
});
