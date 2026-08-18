import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generateThemesCss } from "../src/theme/generate-css";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(packageRoot, "dist");

mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, "themes.css"), generateThemesCss());

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
