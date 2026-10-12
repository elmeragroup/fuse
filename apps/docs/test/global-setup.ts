import type { TestProject } from "vitest/node";

import { startDocsProductionServer } from "./docs-server";

declare module "vitest" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Vitest types `provide`/`inject` by interface declaration merging; a type alias cannot augment.
  interface ProvidedContext {
    /** The origin of the docs server this project's globalSetup started. */
    docsBaseUrl: string;
  }
}

/**
 * Serves a docs build for `project`'s run and provides its origin to that project only. Vitest
 * sets up every selected project before any test runs, so a value shared through the process
 * environment would send both projects to whichever server started last.
 */
export async function serveDocs(
  project: TestProject,
  { testingApi }: { testingApi: boolean }
): Promise<() => Promise<void>> {
  const server = await startDocsProductionServer({ testingApi });
  project.provide("docsBaseUrl", server.url);
  return async () => {
    await server.close();
  };
}

/** The unit suite's server: the production build in `.next`, as the container ships it. */
export default async function globalSetup(project: TestProject): Promise<() => Promise<void>> {
  return serveDocs(project, { testingApi: false });
}
