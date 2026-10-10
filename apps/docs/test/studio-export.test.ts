import { describe, expect, it } from "vitest";

import type { StudioDocument, StudioOverrides } from "../src/lib/studio/edits";
import { exportCss } from "../src/lib/studio/export-css";

const THEME = { variant: "external", brand: "elma", segment: "private" } as const;

/**
 * The base theme's declarations the exporter restates, written out by hand in the forms the
 * theme rules use: literals, and aliases that read other tokens.
 */
const BASE = {
  light: {
    primary: "oklch(0.5 0.2 30)",
    border: "oklch(0.9 0 0)",
    error: "oklch(0.6 0.2 25)",
    destructive: "var(--error)",
    radius: "0.5rem",
    "radius-button": "var(--radius)",
  },
  dark: {
    primary: "oklch(0.8 0.1 30)",
    border: "oklch(0.4 0 0)",
    error: "oklch(0.7 0.2 25)",
    destructive: "var(--error)",
    radius: "0.5rem",
    "radius-button": "var(--radius)",
  },
} as const;

function exported(overrides: Partial<StudioOverrides>): string {
  const document: StudioDocument = {
    theme: THEME,
    overrides: { light: {}, dark: {}, shared: {}, ...overrides },
  };
  return exportCss(document, BASE);
}

const HEADER = "/* After the Fuse stylesheet, on the element that carries the theme attributes. */";

describe("exportCss", () => {
  it("says so when nothing is edited", () => {
    expect(exported({})).toBe("/* No edits: every token keeps the base theme's value. */\n");
  });

  it("writes light-only edits once, for both schemes, with the light-only aliases that read them", () => {
    expect(exported({ shared: { radius: "1rem", "font-heading": "Georgia, serif" } })).toBe(`${HEADER}

/* Both schemes: a dark palette keeps these from light. */
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"][data-theme="dark"] {
  --radius: 1rem;
  --radius-button: var(--radius);
  --font-heading: Georgia, serif;
}
`);
  });

  it("writes a light edit on the theme selector and keeps the base dark value in the dark pair", () => {
    expect(exported({ light: { primary: "#ff0000" } })).toBe(`${HEADER}

/* Light. */
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"] {
  --primary: #ff0000;
}

/* Dark. The first selector matches under a dark ancestor, the second an element that is
   dark itself, such as a themed <html>. */
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"][data-theme="dark"] {
  --primary: oklch(0.8 0.1 30);
}
`);
  });

  it("writes a dark edit in the dark pair only", () => {
    expect(exported({ dark: { primary: "#00ff00" } })).toBe(`${HEADER}

/* Dark. The first selector matches under a dark ancestor, the second an element that is
   dark itself, such as a themed <html>. */
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"][data-theme="dark"] {
  --primary: #00ff00;
}
`);
  });

  it("writes mixed edits in contract order, each in its rule", () => {
    expect(
      exported({
        light: { border: "#222222", primary: "#ff0000" },
        dark: { border: "#dddddd", secondary: "var(--primary)" },
        shared: { radius: "1rem" },
      })
    ).toBe(`${HEADER}

/* Light. */
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"] {
  --primary: #ff0000;
  --border: #222222;
}

/* Dark. The first selector matches under a dark ancestor, the second an element that is
   dark itself, such as a themed <html>. */
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"][data-theme="dark"] {
  --primary: oklch(0.8 0.1 30);
  --secondary: var(--primary);
  --border: #dddddd;
}

/* Both schemes: a dark palette keeps these from light. */
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"][data-theme="dark"] {
  --radius: 1rem;
  --radius-button: var(--radius);
}
`);
  });

  it("restates the aliases of an edited token, so the CSS also works on a nested theme scope", () => {
    expect(exported({ light: { error: "#ff0000" } })).toBe(`${HEADER}

/* Light. */
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"] {
  --error: #ff0000;
  --destructive: var(--error);
}

/* Dark. The first selector matches under a dark ancestor, the second an element that is
   dark itself, such as a themed <html>. */
[data-theme="dark"] [data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"],
[data-theme-variant="external"][data-theme-brand="elma"][data-theme-segment="private"][data-theme="dark"] {
  --error: oklch(0.7 0.2 25);
  --destructive: var(--error);
}
`);
  });
});
