import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { writePublishManifest } from "../scripts/generate-exports";
import { releaseStampFromEnv } from "../scripts/release-stamp";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const commit = "53d7c332e91b6755b2b3f546ed3a39320acf914f";
const channel = "canary";

const scratchDirs: string[] = [];

afterEach(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A scratch package root linked to the real package files, so the real manifest generator
 * runs its discovery and writes only scratch output.
 */
function scratchPackageRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "elmera-ui-publish-manifest-"));
  scratchDirs.push(root);
  mkdirSync(join(root, "dist"));
  for (const entry of ["src", "licenses", "package.json", "LICENSE", "README.md", "THIRD_PARTY_NOTICES.md"]) {
    symlinkSync(join(packageRoot, entry), join(root, entry));
  }
  return root;
}

type ManifestFields = {
  name: string;
  version: string;
  publishConfig?: { access: string };
  elmeraRelease?: { commit: string; channel: string };
};

function readManifestFields(path: string): ManifestFields {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} is not a JSON object`);
  }
  // SAFETY: the file is a package manifest; this test reads its name, version, and release stamp.
  return parsed as ManifestFields;
}

describe("publish manifest", () => {
  it("stamps the release version and elmeraRelease identity into the build output", () => {
    const root = scratchPackageRoot();
    writePublishManifest(root, { version: "0.2.0-canary.1", commit, channel });

    const manifest = readManifestFields(join(root, "dist/package.json"));
    expect(manifest.name).toBe("@elmeragroup/ui");
    expect(manifest.version).toBe("0.2.0-canary.1");
    expect(manifest.elmeraRelease).toEqual({ commit, channel });
    expect(manifest.publishConfig).toEqual({ access: "public" });
  });

  it("keeps the workspace version and no release identity for an ordinary build", () => {
    const root = scratchPackageRoot();
    writePublishManifest(root);

    const manifest = readManifestFields(join(root, "dist/package.json"));
    const workspace = readManifestFields(join(packageRoot, "package.json"));
    expect(manifest.version).toBe(workspace.version);
    expect(manifest.elmeraRelease).toBeUndefined();
  });
});

describe("releaseStampFromEnv", () => {
  it("reads the stamp the pack adapter passes through the build", () => {
    expect(
      releaseStampFromEnv({
        ELMERA_RELEASE_VERSION: "0.2.0-canary.1",
        ELMERA_RELEASE_COMMIT: commit,
        ELMERA_RELEASE_CHANNEL: channel,
      })
    ).toEqual({ version: "0.2.0-canary.1", commit, channel });
  });

  it("treats a missing stamp as an ordinary build", () => {
    expect(releaseStampFromEnv({})).toBeUndefined();
  });

  it("rejects a partial or unknown stamp instead of guessing", () => {
    expect(() => releaseStampFromEnv({ ELMERA_RELEASE_VERSION: "0.2.0-canary.1" })).toThrow(
      "ELMERA_RELEASE_VERSION and ELMERA_RELEASE_COMMIT must both be set"
    );
    expect(() =>
      releaseStampFromEnv({
        ELMERA_RELEASE_VERSION: "0.2.0-canary.1",
        ELMERA_RELEASE_COMMIT: commit,
        ELMERA_RELEASE_CHANNEL: "beta",
      })
    ).toThrow('ELMERA_RELEASE_CHANNEL must be "canary" or "stable"');
  });
});
