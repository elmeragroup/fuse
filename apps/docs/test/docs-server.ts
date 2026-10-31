import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, inject } from "vitest";

import { reservePort } from "./tcp-port";

const docsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(docsRoot, "node_modules/next/dist/bin/next");

/**
 * The build the suite's server serves: the testing build with `testingApi`, else the production
 * build. `next start` inherits this process's environment, so it reads `distDir` from
 * `next.config.ts` the same way.
 */
export function docsBuildDir(testingApi = false): string {
  // oxlint-disable-next-line turbo/no-undeclared-env-vars -- mirrors `distDir` in `next.config.ts`; only `pnpm shots` sets it, outside turbo
  return path.join(docsRoot, process.env.DOCS_DIST_DIR ?? (testingApi ? ".cache/next-e2e" : ".next"));
}

/**
 * The origin the suite's server reads as `DOCS_ORIGIN` at runtime. Every page's card URL
 * prerenders with the build's origin, so none may carry this one. It is a reserved test host that
 * resolves nowhere, so a card can only name it if the server took it from the environment.
 */
const TEST_RUNTIME_ORIGIN = "https://og.fuse.test";

export type DocsServer = {
  url: string;
  close: () => Promise<void>;
};

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`docs production server exited before becoming ready (${String(child.exitCode)})`);
    }
    try {
      const response = await fetch(url, { redirect: "manual" });
      await response.arrayBuffer();
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still binding.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`docs production server did not become ready at ${url}`);
}

/**
 * Starts `next start` on a free port.
 *
 * @param testingApi - Serve `docs#build:e2e`, the build with Next's Instant Navigation testing API,
 * instead of the production build in `.next`. `next.config.ts` picks that build's directory from
 * the same variable its build set.
 */
export async function startDocsProductionServer({ testingApi = false } = {}): Promise<DocsServer> {
  const port = await reservePort();
  // Not `127.0.0.1`: see the loopback note in `src/proxy.ts`.
  const url = `http://localhost:${String(port)}`;
  // `next start` writes request-time route cache entries into the build. A turbo cache hit
  // restores a build over the directory and keeps the entries the last server wrote, which would
  // then serve the previous build's pages.
  await rm(path.join(docsBuildDir(testingApi), "server/route-cache"), { recursive: true, force: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DOCS_ORIGIN: TEST_RUNTIME_ORIGIN,
    DOCS_TESTING_API: testingApi ? "1" : "0",
  };
  if (testingApi) {
    // The testing build prerenders in New York, as its `build:e2e` script sets, far from the
    // Nordic markets the docs show. A date formatted without an explicit zone then differs from a
    // browser in Europe/Oslo, which `time-zone-hydration.browser.test.ts` catches.
    env.TZ = "America/New_York";
  }
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "localhost", "--port", String(port)],
    {
      cwd: docsRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (chunk: Buffer) => {
    stderrChunks.push(chunk);
  });

  try {
    await waitForServer(url, child);
  } catch (error) {
    child.kill("SIGKILL");
    const stderr = Buffer.concat(stderrChunks).toString("utf8");
    const build = testingApi
      ? "pnpm turbo run build:e2e --filter docs"
      : "pnpm turbo run build --filter docs";
    throw new Error(
      `${error instanceof Error ? error.message : "docs production server failed to start"} (build it with \`${build}\`)${
        stderr === "" ? "" : `\n${stderr}`
      }`
    );
  }

  return {
    url,
    close: async () => {
      if (child.exitCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 5_000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
  };
}

/** The origin of the server the running project's globalSetup started. */
export function docsBaseUrl(): string {
  return inject("docsBaseUrl");
}

/**
 * Fetches a site-relative path off the running server and reads its body as text,
 * then asserts a non-error response.
 */
export async function fetchOk(pathname: string): Promise<{ response: Response; text: string }> {
  const response = await fetch(new URL(pathname, docsBaseUrl()));
  const text = await response.text();
  expect(response.ok, `${pathname} responded ${String(response.status)}`).toBe(true);
  return { response, text };
}

/** The same fetch, returning only the response body. */
export async function fetchText(pathname: string): Promise<string> {
  return (await fetchOk(pathname)).text;
}
