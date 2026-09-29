import { describe, expect, it } from "vitest";

import {
  parseWorkspaceCatalog,
  peerFloorRelease,
  publishedDependencies,
} from "../scripts/published-dependencies";

describe("published dependency ranges", () => {
  const catalog = new Map([
    ["@base-ui/react", "1.8.0"],
    ["@phosphor-icons/react", "2.1.10"],
    ["react-aria", "3.52.1"],
    ["react-aria-components", "1.21.1"],
    ["tailwindcss-react-aria-components", "2.2.0"],
    ["tailwind-merge", "3.7.0"],
    ["tw-animate-css", "1.4.0"],
    ["sugar-high", "2.4.1"],
  ]);

  it("carets ordinary dependencies, pins exact ones and keeps named floors", () => {
    const declared = Object.fromEntries([...catalog.keys()].map((name) => [name, "catalog:"]));
    expect(publishedDependencies(declared, catalog)).toEqual({
      "@base-ui/react": "1.8.0",
      "@phosphor-icons/react": "2.1.10",
      "react-aria": "3.52.1",
      "react-aria-components": "1.21.1",
      "tailwindcss-react-aria-components": "2.2.0",
      "tailwind-merge": "^3.7.0",
      "tw-animate-css": "^1.4.0",
      "sugar-high": "^2.4.0",
    });
    // A floor override stays while the catalog version still clears it.
    expect(publishedDependencies({ "sugar-high": "catalog:" }, new Map([["sugar-high", "2.9.0"]]))).toEqual({
      "sugar-high": "^2.4.0",
    });
  });

  it("publishes only the dependencies the workspace declares", () => {
    expect(publishedDependencies({ "tailwind-merge": "catalog:" }, catalog)).toEqual({
      "tailwind-merge": "^3.7.0",
    });
  });

  it.each<[Record<string, string>, ReadonlyMap<string, string>, string]>([
    // A specifier the catalog cannot range.
    [
      { "tailwind-merge": "^3.0.0" },
      catalog,
      "Workspace dependency tailwind-merge must use catalog:, got ^3.0.0",
    ],
    [{ clsx: "catalog:" }, catalog, "Workspace dependency clsx has no pnpm-workspace.yaml catalog entry"],
    // A catalog version that is not a plain release.
    [
      { "tailwind-merge": "catalog:" },
      new Map([["tailwind-merge", "4.0.0-beta.1"]]),
      "Catalog version 4.0.0-beta.1 of tailwind-merge is not a plain release version",
    ],
    // A floor override the catalog version has left behind, above or below it.
    ...["3.0.0", "2.3.9"].map((version): [Record<string, string>, ReadonlyMap<string, string>, string] => [
      { "sugar-high": "catalog:" },
      new Map([["sugar-high", version]]),
      `Floor override ^2.4.0 of sugar-high does not admit catalog version ${version}`,
    ]),
  ])("refuses %j against its catalog", (declared, versions, message) => {
    expect(() => publishedDependencies(declared, versions)).toThrow(message);
  });
});

describe("peer floor release", () => {
  it("names the first release a caret peer range admits", () => {
    expect(peerFloorRelease("^4.1")).toBe("4.1.0");
    expect(peerFloorRelease("^19")).toBe("19.0.0");
    expect(peerFloorRelease("^10.12.3")).toBe("10.12.3");
  });

  it("refuses a range that is not a plain caret range", () => {
    for (const range of ["4.1", ">=4.1", "^4.1.0-beta.1", "~4.1", "^4.x"]) {
      expect(() => peerFloorRelease(range)).toThrow(`Peer range ${range} is not a caret range`);
    }
  });
});

describe("workspace catalog", () => {
  it("reads quoted and bare catalog entries as version strings", () => {
    const catalog = parseWorkspaceCatalog(
      'packages:\n  - packages/*\n\ncatalog:\n  "@base-ui/react": 1.8.0\n  clsx: 2.1.1\n\nminimumReleaseAge: 4320\n'
    );
    expect([...catalog]).toEqual([
      ["@base-ui/react", "1.8.0"],
      ["clsx", "2.1.1"],
    ]);
  });

  it.each([
    ["packages:\n  - packages/*\n", "pnpm-workspace.yaml has no catalog mapping"],
    ["catalog:\n  - clsx\n", "pnpm-workspace.yaml has no catalog mapping"],
    // YAML reads `2.1` as a number.
    ["catalog:\n  clsx: 2.1\n", "pnpm-workspace.yaml catalog entry clsx must be a version string"],
  ])("rejects the workspace file %j", (workspace, message) => {
    expect(() => parseWorkspaceCatalog(workspace)).toThrow(message);
  });
});
