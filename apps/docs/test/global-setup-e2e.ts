import type { TestProject } from "vitest/node";

import { serveDocs } from "./global-setup";

/**
 * The browser suite's server: `docs#build:e2e`, which adds Next's Instant Navigation testing API
 * to the production build for `instant()` (instant-navigation.browser.test.ts).
 */
export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  return serveDocs(project, { testingApi: true });
}
