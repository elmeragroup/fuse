import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCss } from "./build-css";
import { writePublishManifest, writeSourceExports } from "./generate-exports";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

writeSourceExports(packageRoot);

const tsdown = spawnSync("pnpm", ["exec", "tsdown"], {
  cwd: packageRoot,
  stdio: "inherit",
});
if (tsdown.status !== 0) {
  process.exit(tsdown.status ?? 1);
}

buildCss(packageRoot);

const flagsSource = join(packageRoot, "src/flags");
const flagsDest = join(packageRoot, "dist/flags");
mkdirSync(flagsDest, { recursive: true });
for (const name of readdirSync(flagsSource)) {
  if (name.endsWith(".svg") || name === "LICENSE" || name === "PROVENANCE.md") {
    copyFileSync(join(flagsSource, name), join(flagsDest, name));
  }
}

writePublishManifest(packageRoot);
