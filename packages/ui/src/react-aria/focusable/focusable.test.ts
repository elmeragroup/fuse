import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { useFocusable as useRacFocusable } from "react-aria";
import { Focusable as RacFocusable } from "react-aria-components";
import { describe, expect, it } from "vitest";

import { discoverEntries } from "../../../scripts/entries";
import { Focusable, useFocusable } from "./focusable";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "../../..");

describe("focusable re-export identity", () => {
  it("is the same function as react-aria-components Focusable and react-aria useFocusable", () => {
    expect(Focusable).toBe(RacFocusable);
    expect(useFocusable).toBe(useRacFocusable);
  });
});

describe("focusable package surface", () => {
  it("is a subpath-only react-aria entry whose value exports are Focusable and useFocusable", () => {
    const discovered = discoverEntries(packageRoot);
    const entry = discovered.jsEntries.find((item) => item.subpath === "react-aria/focusable");
    const root = discovered.jsEntries.find((item) => item.subpath === ".");
    expect(entry?.inRootBarrel).toBe(false);
    expect(entry?.runtimeExports).toEqual(["Focusable", "useFocusable"]);
    expect(entry?.sourceFile).toBe("src/react-aria/focusable.ts");
    expect(root?.runtimeExports).not.toContain("Focusable");
    expect(root?.runtimeExports).not.toContain("useFocusable");
    expect(discovered.jsEntries.map((item) => item.subpath)).toContain("react-aria/focusable");
    expect(discovered.jsEntries.map((item) => item.subpath)).not.toContain("focusable");
  }, 30_000);
});
