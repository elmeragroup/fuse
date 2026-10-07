import { describe, expect, it } from "vitest";

import { shotOptions as options } from "../test/parse-argv.ts";
import { planCoordinates, planShots } from "./shot-plan.ts";
import {
  attachedFiles,
  formatChange,
  ghEditArgs,
  plannedAttachmentCount,
  renderTable,
  shellCommand,
} from "./shot-table.ts";
import type { DiffCell, TableRows } from "./shot-table.ts";

const dial = options([
  "dial",
  "--route",
  "/components/phone-number-field",
  "--target",
  "textbox:Mobile",
  "--fill",
  "123123",
  "--densities",
  "dense,comfortable",
]);

describe("renderTable", () => {
  it("pairs each before shot with its after shot", () => {
    expect(
      renderTable(
        dial,
        { _tag: "without-diff", rows: planShots(dial, "stage") },
        { _tag: "captured" },
        "prod",
        "local checkout"
      )
    ).toBe(
      [
        'Screenshots of textbox "Mobile" in its demo stage on `/components/phone-number-field`. Before: prod. After: local checkout.',
        "",
        "| Shot | Before | After |",
        "| --- | --- | --- |",
        `| default-theme · dense-override · light · chromium · 1280x900 | ![Before: textbox "Mobile" in its demo stage on /components/phone-number-field, filled with "123123", the page's default theme, dense density (override), light mode, Chromium, 1280 × 900 window](./before-default-theme-dense-override-light-chromium-1280x900-stage.png) | ![After: textbox "Mobile" in its demo stage on /components/phone-number-field, filled with "123123", the page's default theme, dense density (override), light mode, Chromium, 1280 × 900 window](./after-default-theme-dense-override-light-chromium-1280x900-stage.png) |`,
        `| default-theme · comfortable-override · light · chromium · 1280x900 | ![Before: textbox "Mobile" in its demo stage on /components/phone-number-field, filled with "123123", the page's default theme, comfortable density (override), light mode, Chromium, 1280 × 900 window](./before-default-theme-comfortable-override-light-chromium-1280x900-stage.png) | ![After: textbox "Mobile" in its demo stage on /components/phone-number-field, filled with "123123", the page's default theme, comfortable density (override), light mode, Chromium, 1280 × 900 window](./after-default-theme-comfortable-override-light-chromium-1280x900-stage.png) |`,
        "",
      ].join("\n")
    );
  });

  it("marks the before column when the route is not deployed", () => {
    const run = options(["new", "--route", "/components/meter", "--target", "meter:Usage"]);
    expect(
      renderTable(
        run,
        { _tag: "without-diff", rows: planShots(run, "stage") },
        { _tag: "not-deployed" },
        "prod",
        "local checkout"
      )
    ).toBe(
      [
        'Screenshots of meter "Usage" in its demo stage on `/components/meter`. Before: prod. After: local checkout. The route answered 404 on prod, so there are no before shots.',
        "",
        "| Shot | Before | After |",
        "| --- | --- | --- |",
        `| default-theme · stage-density · light · chromium · 1280x900 | Not deployed on prod | ![After: meter "Usage" in its demo stage on /components/meter, the page's default theme, the theme's default density, light mode, Chromium, 1280 × 900 window](./after-default-theme-stage-density-light-chromium-1280x900-stage.png) |`,
        "",
      ].join("\n")
    );
  });

  it("says which elements the run clicked before the shots", () => {
    const run = options([
      "page-size",
      "--route",
      "/",
      "--click",
      "button:Internal",
      "--click",
      "combobox:Rows | page",
      "--target",
      "combobox:Rows | page",
    ]);
    const table = renderTable(
      run,
      { _tag: "without-diff", rows: planShots(run, "target") },
      { _tag: "captured" },
      "prod",
      "local checkout"
    );
    expect(table.split("\n")[0]).toBe(
      'Screenshots of combobox "Rows \\| page" on `/`, after clicking button "Internal", then combobox "Rows \\| page". Before: prod. After: local checkout.'
    );
  });

  it("escapes text that would close the alt text or split the cell", () => {
    const run = options(["odd", "--route", "/x", "--target", "button:A | [b]"]);
    const table = renderTable(
      run,
      { _tag: "without-diff", rows: planShots(run, "stage") },
      { _tag: "not-deployed" },
      "prod",
      "local checkout"
    );
    expect(table).toContain(String.raw`![After: button "A \| \[b\]" in its demo stage`);
    expect(table.split("\n")[4]?.split(" | ")).toHaveLength(3);
  });
});

/** The dial run's two rows, each with the given Diff cell. */
function compared(dense: DiffCell, comfortable: DiffCell): TableRows {
  const [denseRow, comfortableRow] = planShots(dial, "stage");
  if (denseRow === undefined || comfortableRow === undefined) {
    throw new Error("The dial run plans two rows");
  }
  return {
    _tag: "with-diff",
    rows: [
      { row: denseRow, diff: dense },
      { row: comfortableRow, diff: comfortable },
    ],
  };
}

describe("the Diff column", () => {
  it("shows each compared pair's diff image and count, and the sizes of a pair that changed size", () => {
    const table = renderTable(
      dial,
      compared(
        // 312 of 78,000 pixels is exactly 0.4%.
        { _tag: "compared", changed: 312, total: 78_000 },
        { _tag: "size-changed", before: { width: 648, height: 288 }, after: { width: 648, height: 290 } }
      ),
      { _tag: "captured" },
      "prod",
      "local checkout"
    );
    const lines = table.split("\n");
    expect(lines.slice(2, 4)).toEqual(["| Shot | Before | After | Diff |", "| --- | --- | --- | --- |"]);
    expect(
      lines[4]?.endsWith(
        " | ![Pixel diff, default-theme · dense-override · light · chromium · 1280x900: changed pixels in red over the faded before shot](./default-theme-dense-override-light-chromium-1280x900-stage-diff.png)<br>312 px (0.4%) |"
      )
    ).toBe(true);
    expect(lines[5]?.endsWith(" | Size changed from 648 × 288 px to 648 × 290 px, so no diff |")).toBe(true);
  });

  it("has no diff for a row without a before shot", () => {
    const run = options(["new", "--route", "/components/meter", "--target", "meter:Usage"]);
    const rows = planShots(run, "stage").map((row) => ({ row, diff: { _tag: "no-before" } as const }));
    const table = renderTable(
      run,
      { _tag: "with-diff", rows },
      { _tag: "not-deployed" },
      "prod",
      "local checkout"
    );
    expect(table.split("\n")[4]?.endsWith(" | No before shot |")).toBe(true);
  });

  it("uploads a diff image only for the pairs that were compared", () => {
    expect(
      attachedFiles(
        compared(
          { _tag: "compared", changed: 0, total: 16 },
          { _tag: "size-changed", before: { width: 4, height: 4 }, after: { width: 4, height: 5 } }
        ),
        { _tag: "captured" }
      )
    ).toEqual([
      "before-default-theme-dense-override-light-chromium-1280x900-stage.png",
      "after-default-theme-dense-override-light-chromium-1280x900-stage.png",
      "default-theme-dense-override-light-chromium-1280x900-stage-diff.png",
      "before-default-theme-comfortable-override-light-chromium-1280x900-stage.png",
      "after-default-theme-comfortable-override-light-chromium-1280x900-stage.png",
    ]);
  });
});

describe("plannedAttachmentCount", () => {
  it("counts a before, an after and a diff per coordinate, or two images without diffs", () => {
    // 3 themes × 2 densities × 3 engines is 18 coordinates.
    const coordinates = planCoordinates(
      options([
        "matrix",
        "--route",
        "/components/button",
        "--target",
        "button:Save",
        "--themes",
        "internal-fkas-private,external-tkas-company,external-fkse-private",
        "--densities",
        "dense,comfortable",
        "--engines",
        "chromium,webkit,firefox",
      ])
    );
    expect(plannedAttachmentCount(coordinates, "on")).toBe(54);
    expect(plannedAttachmentCount(coordinates, "off")).toBe(36);
  });

  it("counts a window size given twice once", () => {
    // 1 theme × 1 density × 1 engine × 1 window size: 3 images with diffs.
    const coordinates = planCoordinates(
      options(["landing", "--route", "/", "--viewports", "390x844, 390x844"])
    );
    expect(plannedAttachmentCount(coordinates, "on")).toBe(3);
  });

  it("counts every window size as its own pair", () => {
    // 2 themes × 1 density × 1 engine × 3 window sizes is 6 coordinates: 18 images with diffs.
    const coordinates = planCoordinates(
      options([
        "landing",
        "--route",
        "/",
        "--themes",
        "internal-fkas-private,external-tkas-company",
        "--viewports",
        "1280x800,768x1024,390x844",
      ])
    );
    expect(plannedAttachmentCount(coordinates, "on")).toBe(18);
    expect(plannedAttachmentCount(coordinates, "off")).toBe(12);
  });
});

describe("formatChange", () => {
  it.each([
    [0, 16, "0 px (0%)"],
    // 3 of 16 is 18.75%, one decimal.
    [3, 16, "3 px (18.8%)"],
    [1_500, 10_000, "1,500 px (15%)"],
    // One pixel of a 648 × 288 shot is 0.0005%, which must not read as no change.
    [1, 648 * 288, "1 px (<0.1%)"],
    [16, 16, "16 px (100%)"],
  ])("formats %i of %i pixels as %s", (changed, total, text) => {
    expect(formatChange(changed, total)).toBe(text);
  });
});

describe("attachedFiles", () => {
  it("lists the images the table references, and only those", () => {
    const rows = planShots(dial, "stage");
    expect(attachedFiles({ _tag: "without-diff", rows }, { _tag: "captured" })).toEqual([
      "before-default-theme-dense-override-light-chromium-1280x900-stage.png",
      "after-default-theme-dense-override-light-chromium-1280x900-stage.png",
      "before-default-theme-comfortable-override-light-chromium-1280x900-stage.png",
      "after-default-theme-comfortable-override-light-chromium-1280x900-stage.png",
    ]);
    expect(attachedFiles({ _tag: "without-diff", rows }, { _tag: "not-deployed" })).toEqual([
      "after-default-theme-dense-override-light-chromium-1280x900-stage.png",
      "after-default-theme-comfortable-override-light-chromium-1280x900-stage.png",
    ]);
  });
});

describe("the gh command", () => {
  it("replaces the body and attaches each image by the path the body references", () => {
    expect(shellCommand("gh", ghEditArgs("182", "pr-body.md", ["before-a.png", "after-a.png"]))).toBe(
      "gh pr edit 182 --body-file pr-body.md --attach ./before-a.png --attach ./after-a.png"
    );
  });

  it("quotes a word the shell would split or expand", () => {
    expect(shellCommand("gh", ["pr", "edit", "<pr>", "--body", "it's $HOME"])).toBe(
      String.raw`gh pr edit '<pr>' --body 'it'\''s $HOME'`
    );
  });
});
