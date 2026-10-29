import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildCss } from "./build-css";
import { writePublishManifest } from "./generate-exports";
import type { ReleaseStamp } from "./generate-exports";
import { packageRootFromScript } from "./paths";
import { runCommand } from "./run-command";

/**
 * Writes each chart namespace module's declarations from its source, which holds only JSDoc and
 * `export * as` lines. The declaration bundler drops the namespaces' JSDoc, which carries the
 * preview label and the growth rule, so the source text becomes the declaration, with each parts
 * specifier pointing at its emitted sibling.
 */
function writeChartNamespaceDeclarations(packageRoot: string): void {
  const source = join(packageRoot, "src/components/chart");
  for (const name of readdirSync(source).filter((file) => file.endsWith("-namespace.ts"))) {
    const text = readFileSync(join(source, name), "utf8").replaceAll(
      /(from "\.\/[a-z-]+-parts)";$/gmu,
      '$1.js";'
    );
    writeFileSync(join(packageRoot, "dist/components/chart", name.replace(/\.ts$/u, ".d.ts")), text);
  }
}

export function buildPackage(packageRoot: string, release?: ReleaseStamp): void {
  runCommand("pnpm", ["exec", "tsdown"], packageRoot);
  writeChartNamespaceDeclarations(packageRoot);

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
}

if (import.meta.main) {
  buildPackage(packageRootFromScript(import.meta.url));
}
