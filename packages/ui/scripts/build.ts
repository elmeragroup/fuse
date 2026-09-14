import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { buildCss } from "./build-css";
import { writePublishManifest } from "./generate-exports";
import { packageRootFromScript } from "./paths";
import { releaseStampFromEnv } from "./release-stamp";
import { runCommand } from "./run-command";

const packageRoot = packageRootFromScript(import.meta.url);
const release = releaseStampFromEnv(process.env);

runCommand("pnpm", ["exec", "tsdown"], packageRoot);

buildCss(packageRoot);

const flagsSource = join(packageRoot, "src/flags");
const flagsDest = join(packageRoot, "dist/flags");
mkdirSync(flagsDest, { recursive: true });
for (const name of readdirSync(flagsSource)) {
  if (name.endsWith(".svg") || name === "LICENSE" || name === "PROVENANCE.md") {
    copyFileSync(join(flagsSource, name), join(flagsDest, name));
  }
}

writePublishManifest(packageRoot, release);
