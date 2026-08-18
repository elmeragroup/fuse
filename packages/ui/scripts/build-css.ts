import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { generateThemesCss } from "../src/theme/generate-css";

export function buildCss(packageRoot: string): void {
  const distDir = join(packageRoot, "dist");
  const srcStylesDir = join(packageRoot, "src/styles");
  mkdirSync(distDir, { recursive: true });
  mkdirSync(join(distDir, "styles"), { recursive: true });

  const themesCss = generateThemesCss();
  writeFileSync(join(distDir, "themes.css"), themesCss);
  copyFileSync(join(srcStylesDir, "ui.css"), join(distDir, "styles/ui.css"));

  const compiled = spawnSync(
    "pnpm",
    [
      "exec",
      "tailwindcss",
      "-i",
      join(packageRoot, "scripts/standalone.css"),
      "-o",
      join(distDir, "styles.css"),
    ],
    { cwd: packageRoot, stdio: "inherit" }
  );

  if (compiled.status !== 0) {
    process.exit(compiled.status ?? 1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  buildCss(join(dirname(fileURLToPath(import.meta.url)), ".."));
}
