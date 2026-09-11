import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  consumerManifest,
  installArgs,
  installedVersion,
  reactPairs,
  RELEASE_AGE_MINUTES,
  releaseAgeCutoff,
} from "../scripts/package-check-react";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const tarball = "/nonexistent/elmera-ui.tgz";

function workspaceReleaseAgeMinutes(): number {
  const workspace = readFileSync(join(packageRoot, "../../pnpm-workspace.yaml"), "utf8");
  const match = /^minimumReleaseAge: (\d+)$/m.exec(workspace);
  if (match?.[1] === undefined) {
    throw new Error("pnpm-workspace.yaml has no minimumReleaseAge line");
  }
  return Number(match[1]);
}

describe("packed consumer install policy", () => {
  it("mirrors minimumReleaseAge from pnpm-workspace.yaml", () => {
    expect(RELEASE_AGE_MINUTES).toBe(workspaceReleaseAgeMinutes());
  });

  it("computes an absolute UTC cutoff 72 hours before now", () => {
    expect(releaseAgeCutoff(new Date("2026-09-08T12:00:00.000Z"))).toBe("2026-09-05T12:00:00.000Z");
  });

  it("crosses a non-leap-year month boundary", () => {
    expect(releaseAgeCutoff(new Date("2026-03-02T01:30:00.000Z"))).toBe("2026-02-27T01:30:00.000Z");
  });

  it("installs behind the release-age cutoff without scripts, audit, or a lockfile", () => {
    expect(installArgs("2026-09-05T12:00:00.000Z")).toEqual([
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--before=2026-09-05T12:00:00.000Z",
    ]);
  });
});

describe("packed React consumers", () => {
  it("covers the oldest supported React, an interim release, and the workspace version", () => {
    expect(reactPairs()).toEqual([
      { react: "19.0.0", reactDom: "19.0.0" },
      { react: "19.1.1", reactDom: "19.1.1" },
      { react: installedVersion("react"), reactDom: installedVersion("react-dom") },
    ]);
  });

  it("writes a file: tarball spec beside one real React pair", () => {
    expect(consumerManifest(tarball, { react: "19.0.0", reactDom: "19.0.0" })).toEqual({
      private: true,
      type: "module",
      dependencies: {
        "@elmeragroup/ui": `file:${tarball}`,
        react: "19.0.0",
        "react-dom": "19.0.0",
      },
    });
  });
});
