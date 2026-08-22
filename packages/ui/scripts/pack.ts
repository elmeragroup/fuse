import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ARTIFACTS_DIR } from "./tarball.ts";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
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

const tarballs = readdirSync(artifacts).filter((name) => name.endsWith(".tgz"));
if (tarballs.length !== 1 || tarballs[0] === undefined) {
  throw new Error(
    `Expected one tarball in ${ARTIFACTS_DIR} after pack, found ${tarballs.join(", ") || "none"}`
  );
}
