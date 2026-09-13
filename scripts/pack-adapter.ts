import { Schema } from "effect";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { PackAndVerify, ReleaseIntent } from "@elmeragroup/internal/release";

import { findTarball } from "../packages/ui/scripts/tarball.ts";
import { releasePackage } from "./release.ts";

const packageManifestPath = join(releasePackage.packageDirectory, "dist/package.json");

const PackedManifest = Schema.Record(Schema.String, Schema.Unknown);

/** Mirrors the release engine's own JSON boundary: decode external text, never assert it. */
function decodePackedManifest(text: string) {
  try {
    return Schema.decodeUnknownSync(PackedManifest)(JSON.parse(text));
  } catch (error) {
    const problem = error instanceof SyntaxError ? "is not valid JSON" : "is invalid";
    throw new Error(`${packageManifestPath} ${problem}`, { cause: error });
  }
}

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
  return new Uint8Array(readFileSync(findTarball(releasePackage.packageDirectory)));
}

/** Serializes the packed manifest with the release version and identity stamped in. */
export function stampManifest(original: string, intent: ReleaseIntent): string {
  // Decoded records are readonly; spread into a mutable copy before stamping.
  const manifest = { ...decodePackedManifest(original) };
  manifest.version = intent.version;
  manifest.elmeraRelease = { commit: intent.commit, channel: intent.channel };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** Stamps packed identity and the release version into the publish manifest; returns the bytes to restore. */
function stampRelease(intent: ReleaseIntent): string {
  const original = readFileSync(packageManifestPath, "utf8");
  writeFileSync(packageManifestPath, stampManifest(original, intent));
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
