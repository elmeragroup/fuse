import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateThemesCss } from "../src/theme/generate-css";
import { generateDemoStageComfortableCss } from "../src/theme/generate-demo-stage-css";
import { TOOLING_ONLY_CSS_ENTRIES } from "./entries";
import { packageRootFromScript } from "./paths";
import { runCommand } from "./run-command";

type ToolingOnlyCssFile = (typeof TOOLING_ONLY_CSS_ENTRIES)[number]["distFile"];

// Keyed by the entry list, so a generator without an entry (which the publish `.npmignore` would
// miss) or an entry without a generator fails type-check.
const TOOLING_ONLY_CSS_GENERATORS = {
  "demo-stage-comfortable.css": generateDemoStageComfortableCss,
} satisfies Record<ToolingOnlyCssFile, () => string>;

export function buildCss(packageRoot: string): void {
  const distDir = join(packageRoot, "dist");
  const srcStylesDir = join(packageRoot, "src/styles");
  mkdirSync(distDir, { recursive: true });
  mkdirSync(join(distDir, "styles"), { recursive: true });

  const fuseCssPath = join(srcStylesDir, "fuse.css");
  writeFileSync(join(distDir, "themes.css"), generateThemesCss());
  for (const entry of TOOLING_ONLY_CSS_ENTRIES) {
    writeFileSync(join(distDir, entry.distFile), TOOLING_ONLY_CSS_GENERATORS[entry.distFile]());
  }
  copyFileSync(fuseCssPath, join(distDir, "styles/fuse.css"));

  runCommand(
    "pnpm",
    [
      "exec",
      "tailwindcss",
      "-i",
      join(packageRoot, "scripts/standalone.css"),
      "-o",
      join(distDir, "styles.css"),
    ],
    packageRoot
  );
}

if (import.meta.main) {
  buildCss(packageRootFromScript(import.meta.url));
}
