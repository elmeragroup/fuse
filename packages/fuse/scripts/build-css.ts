import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generateThemesCss } from "../src/theme/generate-css";
import { generateDemoStageComfortableCss } from "../src/theme/generate-demo-stage-css";
import { packageRootFromScript } from "./paths";
import { runCommand } from "./run-command";

export function buildCss(packageRoot: string): void {
  const distDir = join(packageRoot, "dist");
  const srcStylesDir = join(packageRoot, "src/styles");
  mkdirSync(distDir, { recursive: true });
  mkdirSync(join(distDir, "styles"), { recursive: true });

  const fuseCssPath = join(srcStylesDir, "fuse.css");
  const fuseCss = readFileSync(fuseCssPath, "utf8");
  writeFileSync(join(distDir, "themes.css"), generateThemesCss());
  writeFileSync(join(distDir, "demo-stage-comfortable.css"), generateDemoStageComfortableCss(fuseCss));
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
