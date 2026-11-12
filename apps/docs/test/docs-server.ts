import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, inject } from "vitest";

import { reservePort } from "./tcp-port";

const docsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(docsRoot, "node_modules/next/dist/bin/next");

/**
 * The build the suite's server serves: `docs#build:e2e` with `e2eBuild`, else the production
 * build. `next start` inherits this process's environment, so it reads `distDir` from
 * `next.config.ts` the same way.
 */
export function docsBuildDir(e2eBuild = false): string {
  // oxlint-disable-next-line turbo/no-undeclared-env-vars -- mirrors `distDir` in `next.config.ts`; only `pnpm shots` sets it, outside turbo
  return path.join(docsRoot, process.env.DOCS_DIST_DIR ?? (e2eBuild ? ".cache/next-e2e" : ".next"));
}

/** The fields of a prerender manifest route the suites read. */
export type PrerenderedRoute = {
  readonly routeType: string;
  readonly renderingMode: string;
  readonly response: string;
  readonly initialRevalidateSeconds: number | false;
};

/**
 * The build's record of each path it prerendered, keyed by path: `prerender-manifest.json` in the
 * build directory {@link docsBuildDir} picks.
 */
export function prerenderManifest(e2eBuild = false): Partial<Record<string, PrerenderedRoute>> {
  // SAFETY: `next build` writes this manifest, and every reader compares each field it reads
  // against an expected value, so a shape that disagrees with the type fails the reader.
  return (
    JSON.parse(readFileSync(path.join(docsBuildDir(e2eBuild), "prerender-manifest.json"), "utf8")) as {
      readonly routes: Partial<Record<string, PrerenderedRoute>>;
    }
  ).routes;
}

/**
 * The HTML pages the build prerendered, sorted: every `page` route but Next's own (`/_…`) and
 * `/private`, an empty noindex page. API, Open Graph image and text routes are `route`s.
 */
export function prerenderedRoutes(e2eBuild = false): string[] {
  return Object.entries(prerenderManifest(e2eBuild))
    .filter(
      ([route, record]) => record?.routeType === "page" && !route.startsWith("/_") && route !== "/private"
    )
    .map(([route]) => route)
    .toSorted();
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

/**
 * How long `next start` may take to answer. A hang guard, not a budget: a starved runner only
 * starts the server later, and a server that never answers still fails the run.
 */
const READY_GUARD_MS = 120_000;

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + READY_GUARD_MS;
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

/** How long `next start` may take to exit after SIGTERM before it is killed. */
const SHUTDOWN_GRACE_MS = 5_000;

/**
 * Starts `next start` on a free port.
 *
 * @param e2eBuild - Serve `docs#build:e2e`, the production build the e2e suite runs against,
 * instead of the container's build in `.next`. `next.config.ts` picks that build's directory from
 * the same variable its build set.
 */
export async function startDocsProductionServer({ e2eBuild = false } = {}): Promise<DocsServer> {
  const port = await reservePort();
  // Not `127.0.0.1`: see the loopback note in `src/proxy.ts`.
  const url = `http://localhost:${String(port)}`;
  // `next start` writes request-time route cache entries into the build. A turbo cache hit
  // restores a build over the directory and keeps the entries the last server wrote, which would
  // then serve the previous build's pages.
  await rm(path.join(docsBuildDir(e2eBuild), "server/route-cache"), { recursive: true, force: true });
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    DOCS_ORIGIN: TEST_RUNTIME_ORIGIN,
    DOCS_E2E_BUILD: e2eBuild ? "1" : "0",
  };
  if (e2eBuild) {
    // The e2e build prerenders in New York, as its `build:e2e` script sets, far from the
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
    const build = e2eBuild ? "pnpm turbo run build:e2e --filter docs" : "pnpm turbo run build --filter docs";
    throw new Error(
      `${error instanceof Error ? error.message : "docs production server failed to start"} (build it with \`${build}\`)${
        stderr === "" ? "" : `\n${stderr}`
      }`
    );
  }

  return {
    url,
    // `next start` exits on SIGTERM once its cleanup has run. Global teardown has no hook timeout,
    // and `vitest run` awaits it without a bound, so a server stalled in shutdown would hang the
    // run. One still running after the grace period is killed and the close throws, failing the run.
    close: async () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      const exited = once(child, "exit").then(() => "exited" as const);
      child.kill("SIGTERM");
      let watchdog: NodeJS.Timeout | undefined;
      const killed = new Promise<"killed">((resolve) => {
        // oxlint-disable-next-line fuse/no-fixed-delay -- a cleanup watchdog, not a wait for a condition: the close still awaits the exit, and the grace period only bounds how long a stalled graceful shutdown may hold the run
        watchdog = setTimeout(() => {
          child.kill("SIGKILL");
          resolve("killed");
        }, SHUTDOWN_GRACE_MS);
      });
      const outcome = await Promise.race([exited, killed]);
      clearTimeout(watchdog);
      if (outcome === "killed") {
        await exited;
        throw new Error(`docs production server ignored SIGTERM for ${SHUTDOWN_GRACE_MS} ms and was killed`);
      }
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
