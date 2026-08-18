import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = join(packageRoot, ".artifacts");

rmSync(artifacts, { recursive: true, force: true });
mkdirSync(artifacts, { recursive: true });

const packed = spawnSync("pnpm", ["pack", "--pack-destination", artifacts], {
  cwd: packageRoot,
  stdio: "inherit",
});
process.exit(packed.status ?? 1);
