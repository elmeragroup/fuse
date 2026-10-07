import { describe, expect, it } from "vitest";

import { shotOptions as options } from "../test/parse-argv.ts";
import { firstCoordinate, planCoordinates, planShots } from "./shot-plan.ts";

describe("planShots", () => {
  it("names one file per state, theme, density, engine and window size, themes outermost", () => {
    const rows = planShots(
      options([
        "matrix",
        "--route",
        "/components/button",
        "--target",
        "button:Save",
        "--themes",
        "internal-fkas-private,external-tkas-company",
        "--densities",
        "dense",
        "--engines",
        "chromium,webkit",
        "--viewports",
        "1280x800,390x844",
      ]),
      "stage"
    );
    expect(rows.map((row) => [row.before.file, row.after.file])).toEqual([
      [
        "before-internal-fkas-private-dense-override-light-chromium-1280x800-stage.png",
        "after-internal-fkas-private-dense-override-light-chromium-1280x800-stage.png",
      ],
      [
        "before-internal-fkas-private-dense-override-light-chromium-390x844-stage.png",
        "after-internal-fkas-private-dense-override-light-chromium-390x844-stage.png",
      ],
      [
        "before-internal-fkas-private-dense-override-light-webkit-1280x800-stage.png",
        "after-internal-fkas-private-dense-override-light-webkit-1280x800-stage.png",
      ],
      [
        "before-internal-fkas-private-dense-override-light-webkit-390x844-stage.png",
        "after-internal-fkas-private-dense-override-light-webkit-390x844-stage.png",
      ],
      [
        "before-external-tkas-company-dense-override-light-chromium-1280x800-stage.png",
        "after-external-tkas-company-dense-override-light-chromium-1280x800-stage.png",
      ],
      [
        "before-external-tkas-company-dense-override-light-chromium-390x844-stage.png",
        "after-external-tkas-company-dense-override-light-chromium-390x844-stage.png",
      ],
      [
        "before-external-tkas-company-dense-override-light-webkit-1280x800-stage.png",
        "after-external-tkas-company-dense-override-light-webkit-1280x800-stage.png",
      ],
      [
        "before-external-tkas-company-dense-override-light-webkit-390x844-stage.png",
        "after-external-tkas-company-dense-override-light-webkit-390x844-stage.png",
      ],
    ]);
  });

  it("says when the theme and density are the page's own", () => {
    const [row, ...rest] = planShots(
      options([
        "dial",
        "--route",
        "/components/phone-number-field",
        "--target",
        "textbox:Mobile",
        "--color-scheme",
        "dark",
      ]),
      "stage"
    );
    expect(rest).toEqual([]);
    expect(row?.before.file).toBe("before-default-theme-stage-density-dark-chromium-1280x900-stage.png");
    expect(row?.diffFile).toBe("default-theme-stage-density-dark-chromium-1280x900-stage-diff.png");
    expect(row?.after.alt).toBe(
      `After: textbox "Mobile" in its demo stage on /components/phone-number-field, the page's default theme, the theme's default density, dark mode, Chromium, 1280 × 900 window`
    );
  });

  it("describes a filled target framed alone under an override", () => {
    const [row] = planShots(
      options([
        "dial",
        "--route",
        "/components/phone-number-field",
        "--target",
        "textbox:Mobile",
        "--fill",
        "123123",
        "--frame",
        "target",
        "--themes",
        "external-elma-company",
        "--densities",
        "comfortable",
        "--engines",
        "firefox",
      ]),
      "target"
    );
    expect(row?.before.file).toBe(
      "before-external-elma-company-comfortable-override-light-firefox-1280x900-target.png"
    );
    expect(row?.before.alt).toBe(
      `Before: textbox "Mobile" on /components/phone-number-field, filled with "123123", external-elma-company theme, comfortable density (override), light mode, Firefox, 1280 × 900 window`
    );
  });

  it("names and describes the window and the whole page for a page without a target", () => {
    const landing = options(["landing", "--route", "/", "--viewports", "390x844"]);
    const [inWindow] = planShots(landing, "viewport");
    const [whole] = planShots(landing, "page");
    expect(inWindow?.after.file).toBe("after-default-theme-page-density-light-chromium-390x844-viewport.png");
    expect(inWindow?.after.alt).toBe(
      "After: the visible part of /, the page's default theme, the theme's default density, light mode, Chromium, 390 × 844 window"
    );
    expect(whole?.before.file).toBe("before-default-theme-page-density-light-chromium-390x844-page.png");
    expect(whole?.before.alt).toBe(
      "Before: the whole of /, the page's default theme, the theme's default density, light mode, Chromium, 390 × 844 window"
    );
  });

  it("says which target was filled when the shot covers the page", () => {
    const [row] = planShots(
      options([
        "search",
        "--route",
        "/",
        "--target",
        "searchbox:Search",
        "--fill",
        "button",
        "--frame",
        "page",
      ]),
      "page"
    );
    expect(row?.after.alt).toBe(
      `After: the whole of /, with searchbox "Search" filled with "button", the page's default theme, the theme's default density, light mode, Chromium, 1280 × 900 window`
    );
  });
});

describe("firstCoordinate", () => {
  it("is the coordinate planCoordinates lists first", () => {
    const run = options([
      "matrix",
      "--route",
      "/",
      "--themes",
      "internal-fkas-private,external-tkas-company",
      "--densities",
      "comfortable,dense",
      "--engines",
      "webkit,chromium",
      "--viewports",
      "390x844,1280x800",
    ]);
    expect(firstCoordinate(run)).toEqual({
      theme: {
        _tag: "picked",
        slug: "internal-fkas-private",
        variant: "internal",
        brand: "fkas",
        segment: "private",
      },
      density: { _tag: "override", density: "comfortable" },
      engine: "webkit",
      viewport: { width: 390, height: 844 },
    });
    expect(planCoordinates(run)[0]).toEqual(firstCoordinate(run));
  });
});

describe("planCoordinates", () => {
  it("takes every window size as an axis, like engines", () => {
    // 2 themes × 1 density × 2 engines × 3 window sizes.
    const coordinates = planCoordinates(
      options([
        "matrix",
        "--route",
        "/",
        "--themes",
        "internal-fkas-private,external-tkas-company",
        "--engines",
        "chromium,webkit",
        "--viewports",
        "1280x800,768x1024,390x844",
      ])
    );
    expect(coordinates).toHaveLength(12);
  });
});
