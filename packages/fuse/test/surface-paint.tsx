// The shared harness for the paint of a container fill: the fill each part paints in each state,
// the text that travels with it, the `--surface` and `--surface-muted-foreground` it states, and a
// consumer's text class winning over its default text. Each component suite owns its own cases and
// runs them through `describePartPaint`; the chart surface suite reads a host's surface through
// `surfaceAt` and the same theme matrix.
//
// Oracle: the theme's role tokens, read at the element: the fill role each state paints,
// composited over the fills beneath a translucent one, and the text role the contrast gates pair
// with that fill (`TEXT_GRADE_PAIRS`, and `--selection-disabled-foreground` on the disabled
// selection fill). For a consumer's `text-error` it is the theme's `--error`, and for real
// contrast WCAG 1.4.3's 4.5:1 between the painted text and the composited fill.
import type { CSSProperties, ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";

import * as CssColor from "@elmeragroup/color/css-color";
import { getOrThrow } from "@elmeragroup/color/result";
import * as Srgb from "@elmeragroup/color/srgb";
import * as Wcag from "@elmeragroup/color/wcag";

import { LocaleProvider } from "../src/intl/locale-context";
import type { ResolvedColorScheme } from "../src/theme/color-scheme-types";
import { DENSITIES } from "../src/theme/density";
import type { Density } from "../src/theme/density";
import type { ThemeInput } from "../src/theme/theme-input";
import { ThemeScope } from "../src/theme/theme-scope";
import { render } from "./browser-render";
import { fkasBranded, fkasPrivate } from "./theme-fixtures";
import { cssVarColor, roleNamed, snapshotDocumentTheme, stampDensity } from "./themed-browser-render";

const THEMES: readonly ThemeInput[] = [fkasPrivate, fkasBranded];
const SCHEMES: readonly ResolvedColorScheme[] = ["light", "dark"];

/** Neutral and branded, each light and dark: the four palettes a fill is held to. */
export const THEMED = THEMES.flatMap((theme) =>
  SCHEMES.map((scheme) => ({ theme, scheme, name: `${theme.identity} ${scheme}` }))
);

/** Restore the document's theme stamp after each test of the calling suite. */
export function restoreDocumentThemeAroundEach(): void {
  let restore: () => void = () => undefined;
  beforeEach(() => {
    restore = snapshotDocumentTheme();
  });
  afterEach(() => {
    restore();
  });
}

/** Mount a tree in a theme and scheme, with the document's `data-theme` set to the scheme. */
export function renderIn(theme: ThemeInput, scheme: ResolvedColorScheme, node: ReactNode): void {
  document.documentElement.setAttribute("data-theme", scheme);
  render(
    <LocaleProvider locale="en-US" timeZone="Europe/Oslo">
      <ThemeScope theme={theme}>{node}</ThemeScope>
    </LocaleProvider>
  );
}

/** The roles a host or part is found by. */
export type ShownRole = "region" | "dialog" | "alert" | "group" | "cell";

/** An element by role and name, once it is in the document. */
export async function shown(role: ShownRole, name: string): Promise<HTMLElement> {
  // Base UI mounts a popup a frame or more after the first render.
  await expect.element(page.getByRole(role, { name })).toBeInTheDocument();
  return roleNamed(role, name);
}

/** A computed colour in sRGB. */
export function toSrgb(serialized: string): Srgb.Srgb {
  return CssColor.toSrgb(getOrThrow(CssColor.parse(serialized)));
}

/** A colour in sRGB, rounded so two serializations of one colour compare equal. */
function rounded({ r, g, b, alpha }: Srgb.Srgb): readonly number[] {
  return [r, g, b, alpha].map((component) => Math.round(component * 1000) / 1000);
}

/** A computed colour in sRGB, rounded so two serializations of one colour compare equal. */
export function srgb(serialized: string): readonly number[] {
  return rounded(toSrgb(serialized));
}

/** The colour a custom-property expression resolves to at an element, as a computed colour. */
function colorAt(element: Element, value: string): string {
  const probe = document.createElement("span");
  probe.style.color = value;
  element.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** The surface a chart's cut-outs paint at an element: `var(--surface, var(--background))`. */
export function surfaceAt(element: Element): string {
  return colorAt(element, "var(--surface, var(--background))");
}

/** The surface's muted text at an element: `var(--surface-muted-foreground, var(--muted-foreground))`. */
function surfaceMutedForegroundAt(element: Element): string {
  return colorAt(element, "var(--surface-muted-foreground, var(--muted-foreground))");
}

/** No paint at all, the start of a composite. */
const NOTHING = toSrgb("rgba(0, 0, 0, 0)");

/** The colour the fills behind an element paint, composited from the element down to the first opaque one. */
function paintedFill(element: Element): Srgb.Srgb {
  let painted = NOTHING;
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    painted = Srgb.compositeOver(painted, toSrgb(getComputedStyle(current).backgroundColor));
    if (painted.alpha === 1) return painted;
  }
  throw new Error("expected an opaque fill behind the part");
}

/** One fill a state paints: a role, and its alpha for a translucent fill. */
export type Layer = { readonly role: `--${string}`; readonly alpha?: number };

/** The colour the expected fill roles paint, read at the element and composited top first. */
function roleFill(element: HTMLElement, layers: readonly Layer[]): Srgb.Srgb {
  return layers.reduceRight<Srgb.Srgb>((beneath, { role, alpha = 1 }) => {
    const { r, g, b, alpha: opacity } = toSrgb(cssVarColor(element, role));
    return Srgb.compositeOver(getOrThrow(Srgb.make({ r, g, b, alpha: opacity * alpha })), beneath);
  }, NOTHING);
}

/** Whether two colours match to within one 8-bit step per channel. */
function expectSameColor(actual: Srgb.Srgb, expected: Srgb.Srgb): void {
  const [painted, promised] = [rounded(actual), rounded(expected)];
  const message = `${painted.join(", ")} against ${promised.join(", ")}`;
  for (const [index, component] of painted.entries()) {
    expect(Math.abs(component - (promised[index] ?? Number.NaN)), message).toBeLessThanOrEqual(1 / 255);
  }
}

/** The WCAG contrast ratio between two sRGB colours. */
function contrast(foreground: Srgb.Srgb, background: Srgb.Srgb): number {
  return getOrThrow(Wcag.contrastRatio(foreground, background));
}

/** The opaque `panel` fill. */
export const PANEL: readonly Layer[] = [{ role: "--panel" }];
/** The opaque `muted` fill. */
export const MUTED: readonly Layer[] = [{ role: "--muted" }];

/** One part in one state: what it renders, the text it colours, and the fill and role it pairs. */
export type PartCase = {
  readonly label: string;
  /** The part under test, with `className` on it. */
  readonly node: (className?: string) => ReactNode;
  /** The text whose colour the part sets. */
  readonly text: () => Element;
  /** The role its text pairs with, or `inherit` for the text around the part. */
  readonly role: `--${string}` | "inherit";
  /** The fills behind the text, top first, down to the first opaque one. */
  readonly fill: readonly Layer[];
  /** The element to hover, for a part whose state is its hover. */
  readonly hover?: () => HTMLElement;
  /** False for a part that takes no `className`, such as the Alert's own action button. */
  readonly takesClassName?: false;
};

/**
 * The wrapper paints the page and gives each text role its own colour, so a part that takes the
 * wrong role, or the text around it, reads apart.
 */
const DISTINCT_TEXT: CSSProperties = {
  background: "var(--background)",
  color: "rgb(0, 128, 0)",
  "--foreground": "rgb(0, 0, 255)",
  "--card-foreground": "rgb(255, 0, 255)",
  "--panel-foreground": "rgb(255, 255, 255)",
  "--selection-disabled-foreground": "rgb(0, 128, 128)",
};

/** The page itself, with the theme's own text roles. */
const PAGE: CSSProperties = { background: "var(--background)", color: "var(--foreground)" };

/** The HTML element a role is read at: the part, or the element around an SVG part. */
function htmlAt(part: Element): HTMLElement {
  const at = part instanceof HTMLElement ? part : part.parentElement;
  if (at === null) throw new Error("expected an element around the part");
  return at;
}

/** Mount a part in its state, run a check on it, and leave the pointer nowhere. */
async function inState(
  density: Density,
  theme: ThemeInput,
  scheme: ResolvedColorScheme,
  { node, hover }: PartCase,
  wrapper: CSSProperties,
  className: string | undefined,
  check: (region: HTMLElement) => void
): Promise<void> {
  stampDensity(density);
  renderIn(
    theme,
    scheme,
    <div role="region" aria-label="Parts" style={wrapper}>
      {node(className)}
    </div>
  );
  const region = await shown("region", "Parts");
  const hovered = hover?.();
  if (hovered !== undefined) await userEvent.hover(hovered);
  try {
    // Rows and selection rows transition their colours. Finishing the transitions reads the
    // colour each part settles on, not a first frame that still shows the colour before the state.
    for (const animation of region.getAnimations({ subtree: true })) animation.finish();
    check(region);
  } finally {
    // The pointer rests nowhere for the next case.
    if (hovered !== undefined) await userEvent.unhover(hovered);
  }
}

/**
 * Register a suite's part cases at both densities in the four palettes: each paints its fill and
 * the paired text, states an opaque fill as `--surface` with muted text that holds 4.5:1 on it,
 * gives way to a consumer's `text-error`, and holds its real text to 4.5:1 on the fill it shows.
 *
 * @param cases - The suite's parts, one per state that changes the fill or the text.
 */
export function describePartPaint(cases: readonly PartCase[]): void {
  describe("fill and text", () => {
    restoreDocumentThemeAroundEach();
    for (const density of DENSITIES) {
      describe(`at ${density} density`, () => {
        for (const { theme, scheme, name } of THEMED) {
          it.each(cases)(`paints its fill and the paired text on $label in ${name}`, async (part) => {
            await inState(density, theme, scheme, part, DISTINCT_TEXT, undefined, (region) => {
              const shownText = part.text();
              const at = htmlAt(shownText);
              const expected =
                part.role === "inherit" ? getComputedStyle(region).color : cssVarColor(at, part.role);
              expect(getComputedStyle(shownText).color).toBe(expected);
              const painted = paintedFill(shownText);
              expectSameColor(painted, roleFill(at, part.fill));
              // An opaque fill is the surface a chart in the part cuts out of, and its muted text
              // is the text of the chart's chips. A translucent state keeps the surface beneath it.
              if (part.fill.length !== 1) return;
              expectSameColor(toSrgb(surfaceAt(at)), painted);
              expect(contrast(toSrgb(surfaceMutedForegroundAt(at)), painted)).toBeGreaterThanOrEqual(4.5);
            });
          });

          it.each(cases.filter(({ takesClassName }) => takesClassName !== false))(
            `gives way to a text-error class on $label in ${name}`,
            async (part) => {
              await inState(density, theme, scheme, part, DISTINCT_TEXT, "text-error", () => {
                const shownText = part.text();
                expect(getComputedStyle(shownText).color).toBe(cssVarColor(htmlAt(shownText), "--error"));
              });
            }
          );

          // The case above swaps the text roles apart, so it cannot measure real contrast: this
          // one reads the theme's own roles, over composited translucent states too.
          it.each(cases)(`holds its text to 4.5:1 on $label in ${name}`, async (part) => {
            await inState(density, theme, scheme, part, PAGE, undefined, () => {
              const shownText = part.text();
              const ratio = contrast(toSrgb(getComputedStyle(shownText).color), paintedFill(shownText));
              expect(ratio).toBeGreaterThanOrEqual(4.5);
            });
          });
        }
      });
    }
  });
}
