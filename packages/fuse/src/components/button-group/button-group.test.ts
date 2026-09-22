import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { buttonGroupVariants } from "./button-group-variants";

const BASE_CLASSES = [
  "group/button-group",
  "flex",
  "w-fit",
  "items-stretch",
  "*:focus-visible:relative",
  "*:focus-visible:z-10",
  "has-[>[data-slot=button-group]]:gap-2",
  "has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md",
  "[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit",
  "[&>input]:flex-1",
] as const;

const HORIZONTAL_CLASSES = [
  "*:data-slot:rounded-r-none",
  "[&>[data-slot]:not(:has(~[data-slot]))]:rounded-r-md!",
  "[&>[data-slot]~[data-slot]]:rounded-l-none",
  "[&>[data-slot]~[data-slot]]:border-l-0",
] as const;

const VERTICAL_CLASSES = [
  "flex-col",
  "*:data-slot:rounded-b-none",
  "[&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-md!",
  "[&>[data-slot]~[data-slot]]:rounded-t-none",
  "[&>[data-slot]~[data-slot]]:border-t-0",
] as const;

describe("buttonGroupVariants", () => {
  it("defaults to horizontal orientation and the group chrome base", () => {
    const resolved = buttonGroupVariants();
    for (const token of BASE_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    for (const token of HORIZONTAL_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    expect(resolved).not.toContain("flex-col");
  });

  it("flips to a column and block-axis collapsing when orientation is vertical", () => {
    const resolved = buttonGroupVariants({ orientation: "vertical" });
    for (const token of BASE_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    for (const token of VERTICAL_CLASSES) {
      expect(resolved, token).toContain(token);
    }
    expect(resolved).not.toContain("*:data-slot:rounded-r-none");
  });

  it("is layout-only: no control-box size axis, density stamp, or dark variant", () => {
    const resolved = `${buttonGroupVariants()} ${buttonGroupVariants({ orientation: "vertical" })}`;
    expect(resolved).not.toContain("--control-");
    expect(resolved).not.toContain("data-density");
    expect(resolved).not.toContain("dense:");
    expect(resolved).not.toContain("comfortable:");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
  });

  it("lets a className merge win over a conflicting recipe class through cn", () => {
    const merged = cn(buttonGroupVariants({ orientation: "vertical" }), "flex-row").split(/\s+/);
    expect(merged).toContain("flex-row");
    expect(merged).not.toContain("flex-col");
    expect(merged).toContain("group/button-group");
  });
});
