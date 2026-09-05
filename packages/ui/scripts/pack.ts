import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { packageRootFromScript } from "./paths.ts";
import { ARTIFACTS_DIR, findTarball } from "./tarball.ts";

const packageRoot = packageRootFromScript(import.meta.url);
const dist = join(packageRoot, "dist");
const artifacts = join(packageRoot, ARTIFACTS_DIR);

rmSync(artifacts, { recursive: true, force: true });
mkdirSync(artifacts, { recursive: true });

const packed = spawnSync("pnpm", ["pack", "--pack-destination", artifacts], {
  cwd: dist,
  stdio: "inherit",
});
if (packed.status !== 0) {
  process.exit(packed.status ?? 1);
}

findTarball(packageRoot);
