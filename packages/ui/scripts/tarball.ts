import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ARTIFACTS_DIR = ".artifacts";

export function findTarball(packageRoot: string): string {
  const artifactsDir = join(packageRoot, ARTIFACTS_DIR);
  if (!existsSync(artifactsDir)) {
    throw new Error(`No ${ARTIFACTS_DIR} directory. Run the pack task first.`);
  }
  const tarballs = readdirSync(artifactsDir).filter((name) => name.endsWith(".tgz"));
  if (tarballs.length !== 1 || tarballs[0] === undefined) {
    throw new Error(
      `Expected exactly one tarball in ${ARTIFACTS_DIR}, found ${tarballs.join(", ") || "none"}`
    );
  }
  return join(artifactsDir, tarballs[0]);
}

export function extractTarball(tarball: string, destination: string): string {
  const result = spawnSync("tar", ["-xzf", tarball, "-C", destination], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`tar extract failed: ${result.stderr}`);
  }
  const extracted = join(destination, "package");
  if (!existsSync(join(extracted, "package.json"))) {
    throw new Error("Packed tarball is missing package/package.json");
  }
  return extracted;
}

export function extractPackedPackage(tarball: string, destination: string, packageRoot: string): string {
  const extracted = extractTarball(tarball, destination);
  const extractedModules = join(extracted, "node_modules");
  if (!existsSync(extractedModules)) {
    // Peer/regular deps resolve from the packed package realpath, not the consumer symlink.
    symlinkSync(join(packageRoot, "node_modules"), extractedModules);
  }
  return extracted;
}

export function withExtractedTarball<T>(
  packageRoot: string,
  prefix: string,
  fn: (extracted: string) => T
): T {
  const tarball = findTarball(packageRoot);
  const scratch = mkdtempSync(join(tmpdir(), prefix));
  try {
    return fn(extractPackedPackage(tarball, scratch, packageRoot));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
