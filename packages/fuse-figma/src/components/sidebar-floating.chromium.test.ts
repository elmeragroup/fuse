/**
 * Unit under test: the Sidebar header, group and footer sets' `floating=true` variants, as the kit
 * builds them: each root's padding and the corner each row instance inside it draws, its corner
 * override or else its inner variant's corner, resolved in an in-memory Figma file the token sync
 * wrote.
 * Oracle: Chromium's computed padding and `border-*-radius` of the same sections in the real Fuse
 * floating Sidebar: the docs floating demo's `Sidebar.Provider bounds="container"` and
 * `Sidebar.Root variant="floating"`, with `collapsible="icon"`, open and collapsed to the icon rail.
 * The demo holds a group alone, so the sample adds the kit's header, with its `Sidebar.Input`, and
 * its footer, with one large menu button. Fuse's built CSS draws the page, stamped as `test:compare`
 * stamps each combination of the file's modes.
 *
 * The sets' own captures render each section in a host that stands for the floating Root and its
 * surface. This test renders the real Provider, Root and surface, so it goes red where that host
 * misses an ancestor the floating classes read, where the build pads a floating section with
 * `row-px`, and where a row draws its `rounded-md` in place of the surface's inner corner.
 */
import { createElement } from "react";
import type { ReactElement } from "react";

import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { House, Package, User, Users } from "../../../fuse/dist/icons.js";
import { Sidebar } from "../../../fuse/dist/sidebar.js";
import { LocaleProvider } from "../../../fuse/dist/theme.js";
import { builtKit, variantRoot } from "../../test/built-kit.ts";
import type { BuiltSets } from "../../test/built-kit.ts";
import type { InMemoryFigma } from "../../test/in-memory-figma.ts";
import { locateFuseBuild, readPageAssets } from "../compare/page-assets.ts";
import { STYLES_LAYERS } from "../compare/preview-page.ts";
import type { ThemeStamps } from "../compare/preview-theme.ts";
import { cornerLengths } from "./corner-spec.ts";
import type { CornerRadiusSpec } from "./corner-spec.ts";
import { walkLayers } from "./kit-spec.ts";
import type { BoxSpec, ComponentRootSpec, NumberSpec } from "./kit-spec.ts";
import { pinName, pixels, syncedPins } from "./synced-pins.ts";
import type { Pin } from "./synced-pins.ts";

/** The sections the floating surface pads, by the `data-slot` each root carries. */
const SECTIONS = ["header", "group", "footer"] as const;

/** The row sets whose instances round inside the surface's corner. */
const ROW_SETS = ["sidebar-menu-button", "sidebar-group-label"] as const;

/** The panel's two states: open, and collapsed to the icon rail. */
const COLLAPSED = ["false", "true"] as const;

/** A menu row as the docs demos write it. */
function menuRow(
  label: string,
  icon: ReactElement,
  props: { readonly isActive?: boolean; readonly size?: "lg" } = {}
) {
  return createElement(
    Sidebar.MenuItem,
    { key: label },
    createElement(Sidebar.MenuButton, props, icon, createElement("span", null, label))
  );
}

/** The real floating Sidebar, open or collapsed, in a frame as tall as the app frame demo's. */
function floatingSidebar(collapsed: (typeof COLLAPSED)[number]): string {
  const panel = createElement(LocaleProvider, {
    locale: "en-US",
    children: createElement(
      Sidebar.Provider,
      { bounds: "container", defaultOpen: collapsed === "false" },
      createElement(
        Sidebar.Root,
        { variant: "floating", collapsible: "icon" },
        createElement(
          Sidebar.Header,
          null,
          createElement(Sidebar.Input, { placeholder: "Search orders", "aria-label": "Search orders" })
        ),
        createElement(
          Sidebar.Content,
          null,
          createElement(
            Sidebar.Group,
            null,
            createElement(Sidebar.GroupLabel, null, "Sales"),
            createElement(
              Sidebar.GroupContent,
              null,
              createElement(
                Sidebar.Menu,
                null,
                menuRow("Dashboard", createElement(House)),
                menuRow("Orders", createElement(Package), { isActive: true }),
                menuRow("Customers", createElement(Users))
              )
            )
          )
        ),
        createElement(
          Sidebar.Footer,
          null,
          createElement(Sidebar.Menu, null, menuRow("Reodor Felgen", createElement(User), { size: "lg" }))
        )
      )
    ),
  });
  return `<div data-collapsed="${collapsed}" style="position:relative;height:448px;overflow:hidden">${renderToStaticMarkup(panel)}</div>`;
}

/** Four lengths in Figma's corner order, or a box's padding from the top round. */
type Four = readonly [number, number, number, number];

/** What Chromium computes for one section of one panel under one pin, in CSS pixels. */
type MeasuredSection = {
  readonly padding: Four;
  /** The corners of the first row of each row set the section holds. */
  readonly rows: Readonly<Record<string, Four>>;
};

/** Each panel's sections under one pin, by collapsed state and then section. */
type Measured = Readonly<Record<string, Readonly<Record<string, MeasuredSection>>>>;

/** Stamp each pin's theme in turn and read every section's padding and its rows' corners. */
function measurePins(page: Page, stamps: readonly ThemeStamps[]): Promise<readonly Measured[]> {
  return page.evaluate(
    ({ pins, sections, rowSets }) =>
      pins.map((pin) => {
        for (const [name, value] of Object.entries(pin.root)) {
          document.documentElement.setAttribute(name, value);
        }
        for (const [name, value] of Object.entries(pin.body)) {
          document.body.setAttribute(name, value);
        }
        const panels: Record<string, Record<string, MeasuredSection>> = {};
        for (const frame of document.querySelectorAll("[data-collapsed]")) {
          const found: Record<string, MeasuredSection> = {};
          for (const section of sections) {
            const box = frame.querySelector(`[data-slot="sidebar-${section}"]`);
            if (box === null) {
              throw new Error(`a panel holds no ${section}`);
            }
            const style = getComputedStyle(box);
            const rows: Record<string, Four> = {};
            for (const rowSet of rowSets) {
              const row = box.querySelector(`[data-slot="${rowSet}"]`);
              if (row !== null) {
                const corners = getComputedStyle(row);
                rows[rowSet] = [
                  Number.parseFloat(corners.borderTopLeftRadius),
                  Number.parseFloat(corners.borderTopRightRadius),
                  Number.parseFloat(corners.borderBottomRightRadius),
                  Number.parseFloat(corners.borderBottomLeftRadius),
                ];
              }
            }
            found[section] = {
              padding: [
                Number.parseFloat(style.paddingTop),
                Number.parseFloat(style.paddingRight),
                Number.parseFloat(style.paddingBottom),
                Number.parseFloat(style.paddingLeft),
              ],
              rows,
            };
          }
          panels[frame.getAttribute("data-collapsed") ?? ""] = found;
        }
        return panels;
      }),
    { pins: stamps, sections: SECTIONS, rowSets: ROW_SETS }
  );
}

let browser: Browser | undefined;
let kit: BuiltSets;
let figma: InMemoryFigma;
let pins: readonly Pin[];
let measured: readonly Measured[];

beforeAll(async () => {
  kit = await builtKit();
  const synced = await syncedPins();
  ({ figma, pins } = synced);
  if (pins.length === 0) {
    throw new Error("the synced file holds no mode, so no case would compare a length");
  }
  const assets = await Effect.runPromise(
    Effect.gen(function* () {
      return yield* readPageAssets(yield* locateFuseBuild(), new Map());
    }).pipe(Effect.provide(NodeServices.layer))
  );
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.setContent(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
@layer ${STYLES_LAYERS.join(", ")};
${assets.styles}
${assets.themes}
</style></head><body>${COLLAPSED.map(floatingSidebar).join("\n")}</body></html>`);
  measured = await measurePins(page, synced.stamps);
}, 300_000);

afterAll(async () => {
  await browser?.close();
});

/** A corner's four lengths in Figma's order, one length repeated where it holds one. */
function fourCorners(corner: CornerRadiusSpec): readonly NumberSpec[] {
  const lengths = cornerLengths(corner);
  const [only] = lengths;
  return lengths.length === 1 && only !== undefined ? [only, only, only, only] : lengths;
}

/** A box's padding from the top round. */
function paddingOf(box: BoxSpec): readonly NumberSpec[] {
  return [box.paddingTop, box.paddingRight, box.paddingBottom, box.paddingLeft];
}

/** The lengths the file renders under a pin. */
function resolved(lengths: readonly NumberSpec[], pin: Pin) {
  return lengths.map((length) => pixels(figma, length, pin));
}

/** A mismatch line where the file's lengths and Chromium's differ, and none where they agree. */
function apartLine(
  pin: Pin,
  what: string,
  built: readonly ReturnType<typeof pixels>[],
  chromium: readonly (number | undefined)[] | undefined
): readonly string[] {
  return JSON.stringify(built) === JSON.stringify(chromium)
    ? []
    : [`${pinName(pin)}: ${what} ${JSON.stringify(built)}, Chromium ${JSON.stringify(chromium)}`];
}

/** The corner each row instance in a section variant draws: its own override, else its inner variant's. */
function drawnCorners(section: ComponentRootSpec) {
  return walkLayers(section).flatMap((layer) => {
    if (layer.kind !== "instance" || !ROW_SETS.some((rowSet) => rowSet === layer.componentSet)) {
      return [];
    }
    const override = layer.overrides?.find((each) => each.field === "cornerRadius" && each.path.length === 0);
    const corner =
      override?.field === "cornerRadius" ? override.value : variantRoot(kit.spec, layer.variant).cornerRadius;
    return [{ rowSet: layer.componentSet, key: layer.key, lengths: fourCorners(corner) }];
  });
}

/** The mismatch lines for one section's padding and its rows' corners under one pin. */
function sectionApart(
  pin: Pin,
  section: string,
  root: ComponentRootSpec,
  rows: ReturnType<typeof drawnCorners>,
  computed: MeasuredSection | undefined
): readonly string[] {
  return [
    ...apartLine(pin, `${section} padding`, resolved(paddingOf(root), pin), computed?.padding),
    ...rows.flatMap(({ rowSet, key, lengths }) =>
      apartLine(pin, `${section} ${key} corner`, resolved(lengths, pin), computed?.rows[rowSet])
    ),
  ];
}

const CASES = SECTIONS.flatMap((section) =>
  COLLAPSED.map((collapsed) => ({
    section,
    collapsed,
    key: `sidebar-${section}/collapsed=${collapsed},floating=true`,
  }))
);

describe("the Sidebar sections' floating variants", () => {
  it.each(CASES)(
    "pads $key and rounds its rows as Chromium draws the real floating Sidebar under every pin",
    ({ section, collapsed, key }) => {
      const root = variantRoot(kit.spec, key);
      const rows = drawnCorners(root);
      expect(rows.length > 0).toBe(section !== "header");
      const apart = pins.flatMap((pin, index) =>
        sectionApart(pin, section, root, rows, measured[index]?.[collapsed]?.[section])
      );
      expect(apart).toEqual([]);
    }
  );
});
