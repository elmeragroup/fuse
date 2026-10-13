import { describe, expect, it } from "vitest";

import type { ThemeSlug } from "@elmeragroup/fuse/theme";

import type { StudioSchemeSeed, StudioSeed } from "../../src/studio/lib/seed";
import { createSeedCache } from "../../src/studio/lib/seed-store";
import type { SeedState } from "../../src/studio/lib/seed-store";

const ELMA: ThemeSlug = "external-elma-private";
const FKAS: ThemeSlug = "internal-fkas-private";

/** A seed the loader under test hands back; the cache never reads into it. */
function fakeSeed(slug: ThemeSlug): StudioSeed {
  // SAFETY: the cache passes a seed through untouched, so an empty scheme stands in.
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

/** Lets the cache's promise handlers run. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

/** Each requested theme's status, by slug. */
function statuses(cache: { getState: () => ReadonlyMap<ThemeSlug, SeedState> }) {
  return Object.fromEntries([...cache.getState()].map(([slug, load]) => [slug, load.status]));
}

describe("createSeedCache", () => {
  it("loads each requested theme's seed and reports it ready", async () => {
    const { calls, load } = deferredLoader();
    const cache = createSeedCache(load);
    cache.request(ELMA);
    expect(statuses(cache)).toEqual({ [ELMA]: "loading" });
    calls[0]?.resolve(fakeSeed(ELMA));
    await settle();
    expect(cache.getState().get(ELMA)).toEqual({ status: "ready", seed: fakeSeed(ELMA) });
  });

  it("loads several themes side by side, each settling on its own", async () => {
    const { calls, load } = deferredLoader();
    const cache = createSeedCache(load);
    cache.request(ELMA);
    cache.request(FKAS);
    expect(calls.map((call) => call.slug)).toEqual([ELMA, FKAS]);
    calls[1]?.resolve(fakeSeed(FKAS));
    await settle();
    expect(statuses(cache)).toEqual({ [ELMA]: "loading", [FKAS]: "ready" });
    calls[0]?.reject(new Error("ChunkLoadError"));
    await settle();
    expect(statuses(cache)).toEqual({ [ELMA]: "failed", [FKAS]: "ready" });
  });

  it("loads a theme once, and a retry loads only the failed ones again", async () => {
    const { calls, load } = deferredLoader();
    const cache = createSeedCache(load);
    const seen: Record<string, string>[] = [];
    cache.subscribe(() => {
      seen.push(statuses(cache));
    });
    cache.request(ELMA);
    cache.request(FKAS);
    cache.request(ELMA);
    calls[0]?.reject(new Error("ChunkLoadError"));
    calls[1]?.resolve(fakeSeed(FKAS));
    await settle();
    // A failed theme waits for a retry rather than a new request.
    cache.request(ELMA);
    expect(calls).toHaveLength(2);

    cache.retry();
    expect(calls.map((call) => call.slug)).toEqual([ELMA, FKAS, ELMA]);
    calls[2]?.resolve(fakeSeed(ELMA));
    await settle();
    expect(statuses(cache)).toEqual({ [ELMA]: "ready", [FKAS]: "ready" });
    expect(seen.map((each) => each[ELMA])).toEqual([
      "loading",
      "loading",
      "failed",
      "failed",
      "loading",
      "ready",
    ]);
  });
});
