import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";

import { reservePort } from "./tcp-port";

const docsRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(docsRoot, "node_modules/next/dist/bin/next");

/**
 * The origin the suite's server reads as `DOCS_ORIGIN` at runtime, which the landing's card URLs
 * must carry. It is a reserved test host that resolves nowhere, so a card can only name it if the
 * server took it from the environment.
 */
export const TEST_RUNTIME_ORIGIN = "https://og.fuse.test";

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

export async function startDocsProductionServer(): Promise<DocsServer> {
  const port = await reservePort();
  const url = `http://127.0.0.1:${String(port)}`;
  const child = spawn(
    process.execPath,
    [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: docsRoot,
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        DOCS_ORIGIN: TEST_RUNTIME_ORIGIN,
      },
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
    throw new Error(
      `${error instanceof Error ? error.message : "docs production server failed to start"}${
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

export function docsBaseUrl(): string {
  const url = process.env.DOCS_BASE_URL;
  if (url === undefined || url === "") {
    throw new Error("DOCS_BASE_URL is missing. Vitest globalSetup must start the docs production server.");
  }
  return url;
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
