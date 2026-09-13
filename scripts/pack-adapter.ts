import { Schema } from "effect";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { PackAndVerify, ReleaseIntent } from "@elmeragroup/internal/release";

import { decodeJson } from "./lib/json.ts";
import { releasePackage } from "./release.ts";

const packageManifestPath = join(releasePackage.packageDirectory, "dist/package.json");
const artifactsDirectory = join(releasePackage.packageDirectory, ".artifacts");

const PackedManifest = Schema.Record(Schema.String, Schema.Unknown);

function runPackageScript(script: string): void {
  const result = spawnSync("pnpm", ["--filter", releasePackage.packageName, "run", script], {
    cwd: releasePackage.checkoutRoot,
    stdio: "inherit",
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    throw new Error(`pnpm ${script} failed with status ${String(result.status ?? "null")}`);
  }
}

function tarballBytes(): Uint8Array {
  const tarballs = readdirSync(artifactsDirectory).filter((name) => name.endsWith(".tgz"));
  const tarball = tarballs[0];
  if (tarballs.length !== 1 || tarball === undefined) {
    throw new Error(
      `Expected exactly one tarball in ${artifactsDirectory}, found ${tarballs.join(", ") || "none"}`
    );
  }
  return new Uint8Array(readFileSync(join(artifactsDirectory, tarball)));
}

/** Stamps packed identity and the release version into the publish manifest; returns the bytes to restore. */
function stampRelease(intent: ReleaseIntent): string {
  const original = readFileSync(packageManifestPath, "utf8");
  // Decoded records are readonly; spread into a mutable copy before stamping.
  const manifest = { ...decodeJson(original, PackedManifest, packageManifestPath) };
  manifest.version = intent.version;
  manifest.elmeraRelease = { commit: intent.commit, channel: intent.channel };
  writeFileSync(packageManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return original;
}

/**
 * Builds, packs, and runs the publish gates against the packed tarball, then returns its bytes.
 * The restore in `finally` covers an ordinary failure; the publish checkout is disposable.
 */
function pack(intent: ReleaseIntent): Uint8Array {
  runPackageScript("build");
  const originalManifest = stampRelease(intent);
  try {
    runPackageScript("pack");
    runPackageScript("package:check");
    runPackageScript("size-limit");
    runPackageScript("test:packed-consumer");
    return tarballBytes();
  } finally {
    writeFileSync(packageManifestPath, originalManifest);
  }
}

export function createPackAndVerify(): PackAndVerify {
  return { pack };
}
