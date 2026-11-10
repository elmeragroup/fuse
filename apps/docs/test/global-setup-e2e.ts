import type { TestProject } from "vitest/node";

import { serveDocs } from "./global-setup";

/**
 * The browser suite's server: `docs#build:e2e`, the production build the e2e suite serves.
 */
export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  return serveDocs(project, { testingApi: true });
}
