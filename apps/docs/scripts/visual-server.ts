/**
 * Runs Playwright's browser server in the Linux image that matches the installed Playwright, for
 * `test/chart-visual.browser.test.ts`. The image comes from the version the workspace resolves, so
 * a Playwright bump moves the image with it, and the baselines with them.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const manifest = readFileSync(require.resolve("playwright/package.json"), "utf8");
const version = /"version":\s*"(?<version>[^"]+)"/u.exec(manifest)?.groups?.version;
if (version === undefined) throw new Error("playwright/package.json names no version");
// oxlint-disable-next-line turbo/no-undeclared-env-vars -- set by hand for the visual suite only, outside turbo
const port = process.env.CHART_VISUAL_PORT ?? "3333";

const child = spawn(
  "docker",
  [
    "run",
    "--rm",
    "--init",
    "--publish",
    `127.0.0.1:${port}:${port}`,
    `mcr.microsoft.com/playwright:v${version}-noble`,
    "npx",
    "--yes",
    `playwright@${version}`,
    "run-server",
    "--port",
    port,
    "--host",
    "0.0.0.0",
  ],
  { stdio: "inherit" }
);
console.log(`CHART_VISUAL_ENDPOINT=ws://127.0.0.1:${port}/`);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
