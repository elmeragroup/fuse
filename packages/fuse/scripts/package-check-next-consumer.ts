import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { cpSync } from "node:fs";
import { createServer } from "node:net";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { chromium } from "playwright";

import { releaseAgeCutoff, withPackedConsumer } from "./packed-consumer";
import { packageRootFromScript } from "./paths";
import { readWorkspaceCatalog } from "./published-dependencies";
import { runCommandAsync } from "./run-command";
import { findTarball } from "./tarball";

/** The consumer's dependencies beside the tarball, each installed at its workspace catalog version. */
const CONSUMER_DEPENDENCIES = ["next", "react", "react-dom", "tailwindcss", "@tailwindcss/postcss"] as const;

/** A running `next start` and the way to stop it. */
type NextServer = {
  readonly url: string;
  readonly close: () => Promise<void>;
};

const packageRoot = packageRootFromScript(import.meta.url);
const cutoff = releaseAgeCutoff(new Date());
const catalog = readWorkspaceCatalog();
const catalogVersion = (name: (typeof CONSUMER_DEPENDENCIES)[number]): string => {
  const version = catalog.get(name);
  if (version === undefined) {
    throw new Error(`Next consumer: pnpm-workspace.yaml catalog has no ${name}`);
  }
  return version;
};
const dependencies = Object.fromEntries(CONSUMER_DEPENDENCIES.map((name) => [name, catalogVersion(name)]));
const nextVersion = catalogVersion("next");

const controller = new AbortController();
const summary = await withPackedConsumer(
  {
    tarball: findTarball(packageRoot),
    prefix: "elmera-packed-next-",
    label: "Next App Router",
    dependencies,
    cutoff,
    signal: controller.signal,
  },
  async (consumer) => {
    cpSync(join(packageRoot, "test/packed-consumer/next-app-router"), consumer, { recursive: true });
    // A server namespace that dots into a client reference, or a lost "use client", fails here.
    await runCommandAsync(join(consumer, "node_modules/.bin/next"), ["build"], {
      cwd: consumer,
      timeoutMs: 300_000,
      signal: controller.signal,
    });
    const server = await startNextServer(consumer);
    try {
      await checkServerHtml(server.url);
      const svgRequests = await checkInBrowser(server.url);
      return { fixture: "next-app-router", next: nextVersion, svgRequests };
    } finally {
      await server.close();
    }
  }
);
console.log(JSON.stringify(summary));

/** The first paint, before any JavaScript runs: server-rendered namespace parts and theme attributes. */
async function checkServerHtml(url: string): Promise<void> {
  const html = await (await fetch(url)).text();
  for (const [marker, meaning] of [
    ['data-slot="item-title"', "the server page rendered no Item.Title markup part"],
    ["Rendered on the server", "the server page's Item.Title text is missing"],
    ['data-theme-brand="fkas"', "the server HTML lacks the theme brand attribute"],
    ['data-density="comfortable"', "the server HTML lacks the density attribute"],
  ] as const) {
    assert.ok(html.includes(marker), `Next consumer: ${meaning}`);
  }
}

/**
 * Tailwind-source styling, hydration and flag assets, asserted against the browser rather than
 * Fuse's own output.
 *
 * @returns The URLs of every SVG request the page made.
 */
async function checkInBrowser(url: string): Promise<string[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(15_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const svgRequests: string[] = [];
    const failures: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(".svg")) svgRequests.push(request.url());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
    });
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto(url);

    // Read before any click: the Button's background transition and hover paint would otherwise
    // be caught mid-change. The probe paints the theme token directly, so it is the oracle for
    // what `bg-primary` must compile to; the fixture's own files never write that class.
    await page.mouse.move(0, 0);
    await page.locator("#counter").waitFor();
    const colors = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = "var(--primary)";
      document.body.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const button = document.querySelector("#counter");
      if (!(button instanceof HTMLElement)) throw new Error("Missing #counter");
      return { expected, actual: getComputedStyle(button).backgroundColor };
    });
    assert.notEqual(colors.expected, "rgba(0, 0, 0, 0)", "Next consumer: the themes CSS did not load");
    assert.equal(
      colors.actual,
      colors.expected,
      "Next consumer: the Button is unstyled, so Tailwind did not scan the installed package"
    );

    await page.locator("#counter").click();
    await waitOrFail(
      page.waitForFunction(() => document.querySelector("#counter")?.textContent === "Clicked 1"),
      "Next consumer: #counter did not hydrate"
    );
    await page.getByRole("tab", { name: "Second" }).click();
    await waitOrFail(
      page.getByRole("tabpanel").filter({ hasText: "Second panel" }).waitFor(),
      "Next consumer: the Tabs did not hydrate"
    );

    await waitOrFail(
      page.waitForFunction(() =>
        Array.from(document.images).some((image) => image.complete && image.naturalWidth > 0)
      ),
      "Next consumer: no flag image loaded"
    );
    assert.ok(svgRequests.length > 0, "Next consumer: no flag SVG was requested");
    for (const svg of svgRequests)
      assert.ok(!svg.startsWith("data:"), `Next consumer: a flag was inlined as ${svg.slice(0, 40)}…`);
    assert.deepEqual(failures, []);
    return svgRequests;
  } finally {
    await browser.close();
  }
}

/** Awaits `wait`, replacing a timeout with a message that names the broken behavior. */
async function waitOrFail(wait: Promise<unknown>, message: string): Promise<void> {
  try {
    await wait;
  } catch (error) {
    throw new Error(message, { cause: error });
  }
}

/**
 * Starts `next start` on a reserved loopback port and resolves once it answers, following
 * `apps/docs/test/docs-server.ts`, which `packages/fuse/scripts` cannot import.
 */
async function startNextServer(consumer: string): Promise<NextServer> {
  const port = await reservePort();
  const url = `http://127.0.0.1:${String(port)}`;
  const child = spawn(
    process.execPath,
    [
      join(consumer, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: consumer, env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "ignore", "pipe"] }
  );
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
    stderr += chunk;
  });
  const close = () => stopServer(child);
  try {
    await waitForServer(url, child);
  } catch (error) {
    await close();
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${stderr === "" ? "" : `\n${stderr}`}`, { cause: error });
  }
  return { url, close };
}

async function reservePort(): Promise<number> {
  const server = createServer();
  return await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => {
        if (error) {
          reject(error);
        } else if (address !== null && isAddressInfo(address)) {
          resolve(address.port);
        } else {
          reject(new Error("Could not reserve a TCP port"));
        }
      });
    });
  });
}

function isAddressInfo(address: AddressInfo | string): address is AddressInfo {
  return address instanceof Object && Object.hasOwn(address, "port");
}

async function waitForServer(url: string, child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next consumer: next start exited before becoming ready (${String(child.exitCode)})`);
    }
    try {
      const response = await fetch(url, { redirect: "manual" });
      await response.arrayBuffer();
      if (response.status < 500) {
        return;
      }
    } catch {
      // The server is still binding.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`Next consumer: next start did not become ready at ${url}`);
}

/** SIGTERM, then SIGKILL if the server has not exited within 5 s. */
async function stopServer(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
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
}
