import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const ARTIFACTS_DIR = ".artifacts";

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

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

function packageDependencies(packageRoot: string): string[] {
  return readdirSync(join(packageRoot, "node_modules")).filter(
    (entry) => entry !== ".bin" && entry !== "@elmeragroup"
  );
}

/**
 * Give a scratch consumer a `node_modules` that resolves `@elmeragroup/fuse` to the extracted
 * tarball and the named dependencies (every installed one by default) to this package's install.
 */
export function linkConsumerModules(
  consumerRoot: string,
  extracted: string,
  packageRoot: string,
  dependencies: readonly string[] = packageDependencies(packageRoot)
): string {
  const modules = join(consumerRoot, "node_modules");
  mkdirSync(join(modules, "@elmeragroup"), { recursive: true });
  for (const dependency of dependencies) {
    symlinkSync(join(packageRoot, "node_modules", dependency), join(modules, dependency));
  }
  symlinkSync(extracted, join(modules, "@elmeragroup", "fuse"));
  return modules;
}

export type ExtractedTarball = {
  /** The extracted `package/` directory, with its dependencies linked. */
  extracted: string;
  tarball: string;
  /** The temporary directory that owns `extracted`; removed after the callback settles. */
  scratch: string;
};

/**
 * Extracts the packed tarball into a fresh temporary directory, links its dependencies, and
 * removes the directory once `fn` settles, whether it resolves or throws.
 */
export async function withExtractedTarballAsync<T>(
  packageRoot: string,
  prefix: string,
  fn: (extracted: ExtractedTarball) => Promise<T>
): Promise<T> {
  const tarball = findTarball(packageRoot);
  const scratch = mkdtempSync(join(tmpdir(), prefix));
  try {
    return await fn({ extracted: extractPackedPackage(tarball, scratch, packageRoot), tarball, scratch });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * Deletes `directory` from a detached process that outlives this one, so the deletion also
 * finishes when the caller exits through `fail`. For npm-installed consumers only: each holds
 * about 28k files, and the React pairs finish together, so awaiting three such removals put
 * about 12.6s of disk time on the critical path of a result that no longer depends on them.
 */
export function removeDetached(directory: string): void {
  spawn(
    process.execPath,
    ["-e", "require('node:fs').rmSync(process.argv[1], { recursive: true, force: true })", directory],
    { detached: true, stdio: "ignore" }
  ).unref();
}
