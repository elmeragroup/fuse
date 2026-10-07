import { describe, expect, it } from "vitest";

import { shotOptions } from "../test/parse-argv.ts";
import { placeShots } from "./pr-body.ts";
import { planShots } from "./shot-plan.ts";
import { renderTable } from "./shot-table.ts";

const TABLE = "| Shot | Before | After |\n| --- | --- | --- |\n| a | ![b](./b.png) | ![c](./c.png) |\n";

describe("placeShots", () => {
  it("adds the block at the end of ## Verification, before the next section", () => {
    const body = [
      "## Change",
      "",
      "Aligns the dial code.",
      "",
      "## Verification",
      "",
      "- `vitest related` passes.",
      "",
      "",
      "## Notes",
      "",
      "None.",
    ].join("\n");
    expect(placeShots(body, "phone-dial", TABLE)).toBe(
      [
        "## Change",
        "",
        "Aligns the dial code.",
        "",
        "## Verification",
        "",
        "- `vitest related` passes.",
        "",
        "<!-- pr-shots:phone-dial -->",
        "",
        "| Shot | Before | After |",
        "| --- | --- | --- |",
        "| a | ![b](./b.png) | ![c](./c.png) |",
        "",
        "<!-- /pr-shots:phone-dial -->",
        "",
        "## Notes",
        "",
        "None.",
      ].join("\n")
    );
  });

  it("keeps a ### subsection inside Verification and appends after it when Verification is last", () => {
    const body = "## Verification\n\n### Screens\n\nSee below.\n";
    expect(placeShots(body, "x", "T")).toBe(
      "## Verification\n\n### Screens\n\nSee below.\n\n<!-- pr-shots:x -->\n\nT\n\n<!-- /pr-shots:x -->\n"
    );
  });

  it("replaces an existing block in place, so a re-run is idempotent", () => {
    const body = [
      "## Verification",
      "",
      "<!-- pr-shots:phone-dial -->",
      "",
      "old table",
      "",
      "<!-- /pr-shots:phone-dial -->",
      "",
      "Checked by hand in Safari.",
      "",
      "## Notes",
    ].join("\n");
    const once = placeShots(body, "phone-dial", "new table\n");
    expect(once).toBe(
      [
        "## Verification",
        "",
        "<!-- pr-shots:phone-dial -->",
        "",
        "new table",
        "",
        "<!-- /pr-shots:phone-dial -->",
        "",
        "Checked by hand in Safari.",
        "",
        "## Notes",
      ].join("\n")
    );
    expect(placeShots(once, "phone-dial", "new table\n")).toBe(once);
  });

  it("matches the markers only as whole lines, so a marker typed into --fill stays in the table", () => {
    const run = shotOptions([
      "sample",
      "--route",
      "/components/phone-number-field",
      "--target",
      "textbox:Mobile",
      "--fill",
      "<!-- /pr-shots:sample -->",
    ]);
    const table = renderTable(
      run,
      { _tag: "without-diff", rows: planShots(run, "stage") },
      { _tag: "captured" },
      "prod",
      "local checkout"
    );
    expect(table).toContain('filled with "<!-- /pr-shots:sample -->"');
    const body = "## Verification\n\n- Checks pass.\n";
    const placed = placeShots(body, "sample", table);
    expect(placed).toBe(
      `## Verification\n\n- Checks pass.\n\n<!-- pr-shots:sample -->\n\n${table.trim()}\n\n<!-- /pr-shots:sample -->\n`
    );
    expect(placeShots(placed, "sample", table)).toBe(placed);
  });

  it("leaves another run's block alone", () => {
    const body = "## Verification\n\n<!-- pr-shots:other -->\n\nkeep\n\n<!-- /pr-shots:other -->\n";
    expect(placeShots(body, "mine", "T")).toBe(
      "## Verification\n\n<!-- pr-shots:other -->\n\nkeep\n\n<!-- /pr-shots:other -->\n\n<!-- pr-shots:mine -->\n\nT\n\n<!-- /pr-shots:mine -->\n"
    );
  });

  it("appends a Verification section to a body without one", () => {
    expect(placeShots("## Problem\r\n\r\nIt jumps.\r\n\r\n", "x", "T")).toBe(
      "## Problem\n\nIt jumps.\n\n## Verification\n\n<!-- pr-shots:x -->\n\nT\n\n<!-- /pr-shots:x -->\n"
    );
  });
});
