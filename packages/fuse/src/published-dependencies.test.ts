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
  });

  it("publishes only the dependencies the workspace declares", () => {
    expect(publishedDependencies({ "tailwind-merge": "catalog:" }, catalog)).toEqual({
      "tailwind-merge": "^3.7.0",
    });
  });

  it("refuses a specifier the catalog cannot range", () => {
    expect(() => publishedDependencies({ "tailwind-merge": "^3.0.0" }, catalog)).toThrow(
      "Workspace dependency tailwind-merge must use catalog:, got ^3.0.0"
    );
    expect(() => publishedDependencies({ clsx: "catalog:" }, catalog)).toThrow(
      "Workspace dependency clsx has no pnpm-workspace.yaml catalog entry"
    );
  });

  it("refuses a catalog version that is not a plain release", () => {
    expect(() =>
      publishedDependencies({ "tailwind-merge": "catalog:" }, new Map([["tailwind-merge", "4.0.0-beta.1"]]))
    ).toThrow("Catalog version 4.0.0-beta.1 of tailwind-merge is not a plain release version");
  });

  it("refuses a floor override the catalog version has left behind", () => {
    for (const version of ["3.0.0", "2.3.9"]) {
      expect(() =>
        publishedDependencies({ "sugar-high": "catalog:" }, new Map([["sugar-high", version]]))
      ).toThrow(`Floor override ^2.4.0 of sugar-high does not admit catalog version ${version}`);
    }
    expect(publishedDependencies({ "sugar-high": "catalog:" }, new Map([["sugar-high", "2.9.0"]]))).toEqual({
      "sugar-high": "^2.4.0",
    });
  });
});

describe("caret floor overrides below 1.0", () => {
  const declared = { pre: "catalog:" };
  const withFloor = (floor: string) => ({
    exactPins: new Set<string>(),
    floorOverrides: new Map([["pre", floor]]),
  });

  it("keeps the minor fixed for a ^0.y.z floor", () => {
    expect(publishedDependencies(declared, new Map([["pre", "0.2.7"]]), withFloor("^0.2.0"))).toEqual({
      pre: "^0.2.0",
    });
    for (const version of ["0.3.0", "1.2.0", "0.1.9"]) {
      expect(() => publishedDependencies(declared, new Map([["pre", version]]), withFloor("^0.2.0"))).toThrow(
        `Floor override ^0.2.0 of pre does not admit catalog version ${version}`
      );
    }
  });

  it("admits only the floor itself for a ^0.0.z floor", () => {
    expect(publishedDependencies(declared, new Map([["pre", "0.0.3"]]), withFloor("^0.0.3"))).toEqual({
      pre: "^0.0.3",
    });
    expect(() => publishedDependencies(declared, new Map([["pre", "0.0.4"]]), withFloor("^0.0.3"))).toThrow(
      "Floor override ^0.0.3 of pre does not admit catalog version 0.0.4"
    );
  });

  it("keeps every written part fixed for an all-zero floor", () => {
    expect(publishedDependencies(declared, new Map([["pre", "0.9.1"]]), withFloor("^0"))).toEqual({
      pre: "^0",
    });
    expect(publishedDependencies(declared, new Map([["pre", "0.0.9"]]), withFloor("^0.0"))).toEqual({
      pre: "^0.0",
    });
    expect(() => publishedDependencies(declared, new Map([["pre", "0.1.0"]]), withFloor("^0.0"))).toThrow(
      "Floor override ^0.0 of pre does not admit catalog version 0.1.0"
    );
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

  it("rejects a workspace file without a catalog mapping", () => {
    expect(() => parseWorkspaceCatalog("packages:\n  - packages/*\n")).toThrow(
      "pnpm-workspace.yaml has no catalog mapping"
    );
    expect(() => parseWorkspaceCatalog("catalog:\n  - clsx\n")).toThrow(
      "pnpm-workspace.yaml has no catalog mapping"
    );
  });

  it("rejects a catalog entry YAML reads as a number", () => {
    expect(() => parseWorkspaceCatalog("catalog:\n  clsx: 2.1\n")).toThrow(
      "pnpm-workspace.yaml catalog entry clsx must be a version string"
    );
  });
});
