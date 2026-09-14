import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

import { packageRootFromScript } from "./paths.ts";
import { runCommand } from "./run-command.ts";
import { ARTIFACTS_DIR, findTarball } from "./tarball.ts";

const packageRoot = packageRootFromScript(import.meta.url);
const dist = join(packageRoot, "dist");
const artifacts = join(packageRoot, ARTIFACTS_DIR);

rmSync(artifacts, { recursive: true, force: true });
mkdirSync(artifacts, { recursive: true });

runCommand("pnpm", ["pack", "--pack-destination", artifacts], dist);

findTarball(packageRoot);
