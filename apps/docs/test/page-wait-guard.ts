/**
 * How long a page's actions, locators and `expect.poll` calls wait. A hang guard, not a budget: no
 * docs e2e test asserts timing, and a step that slows on a loaded runner must not fail for it. It
 * imports nothing, so `vitest.config.ts` can read it too.
 */
export const PAGE_WAIT_GUARD = 60_000;
