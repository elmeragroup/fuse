import { describe, expect, it } from "vitest";

import { NO_OVERRIDES } from "../../src/studio/lib/edits";
import type { StudioDocument, StudioOverrides } from "../../src/studio/lib/edits";
import { exportCss } from "../../src/studio/lib/export-css";

const THEME = { variant: "external", brand: "elma", segment: "private" } as const;

function exported(overrides: Partial<StudioOverrides>): string {
  const document: StudioDocument = { theme: THEME, overrides: { ...NO_OVERRIDES, ...overrides } };
  // No base aliases: the density section reads no theme declaration.
  return exportCss(document, { light: {}, dark: {} });
}

const DENSITY_HEADER = `/* Density. These belong on the host's document root, not the theme scope: Fuse reads
   density metrics from :root, where the host sets data-density. */`;

describe("exportCss density section", () => {
  it("writes each density's metric edits on the document root for that density", () => {
    expect(exported({ density: { dense: { "control-h-xs": 16 }, comfortable: { "control-h-md": 56 } } }))
      .toBe(`${DENSITY_HEADER}

:root[data-density="dense"] {
  --control-h-xs: 16px;
}

:root[data-density="comfortable"] {
  --control-h-md: 56px;
}
`);
  });

  it("lists metrics in fuse.css order, whatever order they were edited in", () => {
    expect(exported({ density: { comfortable: { "surface-gap-xl": 40, "row-h": 40, "control-h-sm": 40 } } }))
      .toBe(`${DENSITY_HEADER}

:root[data-density="comfortable"] {
  --control-h-sm: 40px;
  --row-h: 40px;
  --surface-gap-xl: 40px;
}
`);
  });

  it("lists label metrics before surface metrics, as fuse.css declares them", () => {
    expect(
      exported({
        density: { dense: { "surface-pad-md": 20, "label-text": 15, "row-h": 30, "control-h-sm": 30 } },
      })
    ).toBe(`${DENSITY_HEADER}

:root[data-density="dense"] {
  --control-h-sm: 30px;
  --row-h: 30px;
  --label-text: 15px;
  --surface-pad-md: 20px;
}
`);
  });

  it("follows the theme rules when both are edited", () => {
    expect(exported({ shared: { radius: "1rem" }, density: { dense: { "row-px": 6 } } }))
      .toBe(`/* After the Fuse stylesheet, on the element that carries the theme attributes. */

/* Both schemes: a dark palette keeps these from light. */
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"][data-theme="dark"] {
  --radius: 1rem;
}

${DENSITY_HEADER}

:root[data-density="dense"] {
  --row-px: 6px;
}
`);
  });

  it("writes no density section for an empty density group", () => {
    expect(exported({ density: { dense: {} } })).toBe(
      "/* No edits: every token keeps the base theme's value. */\n"
    );
  });
});
