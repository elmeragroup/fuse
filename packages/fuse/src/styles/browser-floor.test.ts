import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { browserFloorProblems, describeFloorProblem } from "../../test/browser-floor";
import { BROWSER_FLOOR_APPROVALS, BROWSER_FLOOR_EQUIVALENCES } from "../../test/browser-floor-approvals";

/** The stylesheets `dist/` ships as built: the standalone sheet and the chart sheet. */
const SHIPPED_SHEETS = ["styles.css", "chart.css"] as const;

describe("the built stylesheets at the browser floor", () => {
  it("rely on no feature above the floor without an approved fallback", () => {
    // Why a test: oxlint reads no CSS, and these are built artifacts. Unit under test: every
    // declaration, selector and at-rule in the shipped sheets. Oracle: MDN's browser-compat-data
    // first versions against Fuse's floor, the approvals that name each fallback, and the mapping tables, each of which must name an MDN row. This
    // package inherits the root `test` task and its `@elmeragroup/fuse#build` dependency.
    const sheets = SHIPPED_SHEETS.map((name) => {
      const path = new URL(`../../dist/${name}`, import.meta.url);
      expect(existsSync(path), path.pathname).toBe(true);
      return { name, css: readFileSync(path, "utf8") };
    });
    expect(
      browserFloorProblems(sheets, BROWSER_FLOOR_APPROVALS, BROWSER_FLOOR_EQUIVALENCES).map(
        describeFloorProblem
      )
    ).toEqual([]);
  });
});
