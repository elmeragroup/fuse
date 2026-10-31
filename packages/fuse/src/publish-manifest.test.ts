import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { writePublishManifest, writeSourceExports } from "../scripts/generate-exports";
import { packTarball } from "../scripts/pack";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const commit = "53d7c332e91b6755b2b3f546ed3a39320acf914f";
const channel = "canary";

const scratchDirs: string[] = [];

afterAll(() => {
  for (const dir of scratchDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * A scratch package root linked to the real package files, so the real manifest generator
 * runs its discovery and writes only scratch output.
 */
function scratchPackageRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "fuse-publish-manifest-"));
  scratchDirs.push(root);
  mkdirSync(join(root, "dist"));
  for (const entry of [
    "src",
    "licenses",
    "package.json",
    "LICENSE",
    "LICENSE-evilcharts",
    "README.md",
    "THIRD_PARTY_NOTICES.md",
  ]) {
    symlinkSync(join(packageRoot, entry), join(root, entry));
  }
  return root;
}

/**
 * A scratch package root whose `src` entries link to the real ones, except for the generated root
 * barrel, which is copied so the source-exports generator writes it only into scratch.
 */
function scratchSourceRoot(manifest: ManifestFields): string {
  const root = mkdtempSync(join(tmpdir(), "fuse-source-exports-"));
  scratchDirs.push(root);
  mkdirSync(join(root, "src"));
  for (const entry of readdirSync(join(packageRoot, "src"))) {
    if (entry === "index.ts") {
      copyFileSync(join(packageRoot, "src", entry), join(root, "src", entry));
    } else {
      symlinkSync(join(packageRoot, "src", entry), join(root, "src", entry));
    }
  }
  writeFileSync(join(root, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return root;
}

type ManifestFields = {
  name: string;
  version: string;
  bugs?: { url: string };
  sideEffects?: string[];
  funding?: string;
  dependencies?: Record<string, string>;
  exports?: Record<string, string | { types: string; import: string }>;
  publishConfig?: { access: string; directory?: string; linkDirectory?: boolean };
  elmeraRelease?: { commit: string; channel: string };
};

function readManifestFields(path: string): ManifestFields {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (parsed === null || Array.isArray(parsed)) {
    throw new Error(`${path} is not a JSON object`);
  }
  // SAFETY: the file is a package manifest; this test reads only the fields ManifestFields names.
  return parsed as ManifestFields;
}

describe("publish manifest and packed tarball", () => {
  // One scratch root, written stamped and then unstamped; every test below only reads it.
  let root = "";
  let stamped: ManifestFields;
  let unstamped: ManifestFields;

  beforeAll(() => {
    root = scratchPackageRoot();
    for (const file of ["themes.css", "demo-stage-density.css"]) {
      writeFileSync(join(root, "dist", file), ":root {}\n");
    }
    writePublishManifest(root, { version: "0.2.0-canary.1", commit, channel });
    stamped = readManifestFields(join(root, "dist/package.json"));
    writePublishManifest(root);
    unstamped = readManifestFields(join(root, "dist/package.json"));
  }, 30_000);

  it("stamps the release version and elmeraRelease identity into the publish manifest", () => {
    expect(stamped.name).toBe("@elmeragroup/fuse");
    expect(stamped.version).toBe("0.2.0-canary.1");
    expect(stamped.elmeraRelease).toEqual({ commit, channel });
    expect(stamped.publishConfig).toEqual({ access: "public" });
  });

  it("carries the bug tracker, the CSS side effects and exactly the workspace dependencies", () => {
    expect(unstamped.bugs).toEqual({ url: "https://github.com/elmeragroup/fuse/issues" });
    expect(unstamped.sideEffects).toEqual(["**/*.css"]);

    const published = Object.keys(unstamped.dependencies ?? {});
    const workspace = Object.keys(readManifestFields(join(packageRoot, "package.json")).dependencies ?? {});
    expect(workspace).not.toEqual([]);
    expect(published.toSorted()).toEqual(workspace.toSorted());
  });

  it("an unstamped write never carries a stale release identity", () => {
    const workspace = readManifestFields(join(packageRoot, "package.json"));
    expect(unstamped.version).toBe(workspace.version);
    expect(unstamped.elmeraRelease).toBeUndefined();
  });

  it("leaves the docs-only demo-stage stylesheet out of the tarball", () => {
    const listing = spawnSync("tar", ["-tzf", packTarball(root)], { encoding: "utf8" });
    expect(listing.status).toBe(0);
    const files = listing.stdout.split("\n");
    expect(files).toContain("package/themes.css");
    expect(files).not.toContain("package/demo-stage-density.css");
  }, 30_000);
});

describe("source exports", () => {
  it("regenerates exports and publishConfig without dropping any other manifest field", () => {
    const root = scratchSourceRoot({
      name: "@elmeragroup/fuse",
      version: "0.0.0",
      bugs: { url: "https://github.com/elmeragroup/fuse/issues" },
      funding: "https://example.com/fund",
      exports: { "./stale": "./src/stale.ts" },
      publishConfig: { access: "restricted", directory: "stale" },
    });
    writeSourceExports(root);

    const manifest = readManifestFields(join(root, "package.json"));
    expect(Object.keys(manifest)).toEqual(["name", "version", "bugs", "funding", "exports", "publishConfig"]);
    expect(manifest.bugs).toEqual({ url: "https://github.com/elmeragroup/fuse/issues" });
    expect(manifest.funding).toBe("https://example.com/fund");
    expect(manifest.exports?.["./stale"]).toBeUndefined();
    expect(manifest.exports?.["."]).toEqual({ types: "./src/index.ts", import: "./src/index.ts" });
    expect(manifest.publishConfig).toEqual({ directory: "dist", access: "public", linkDirectory: false });
  }, 20_000);

  it("refuses to rewrite a manifest whose root is not a JSON object", () => {
    const root = scratchSourceRoot({ name: "@elmeragroup/fuse", version: "0.0.0" });
    writeFileSync(join(root, "package.json"), "42\n");

    expect(() => writeSourceExports(root)).toThrow(/must be a JSON object/);
    expect(readFileSync(join(root, "package.json"), "utf8")).toBe("42\n");
  }, 20_000);
});
