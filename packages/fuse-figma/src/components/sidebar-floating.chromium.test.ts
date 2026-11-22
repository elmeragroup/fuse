/**
 * Unit under test: two parts of the kit build, with each length resolved in an in-memory Figma
 * file the token sync wrote. The first is the Sidebar header, group and footer sets' `floating=true`
 * variants, with each root's padding and the corner each row instance inside it draws, its corner
 * override or else its inner variant's corner. The second is the Sidebar set's `variant=floating`
 * variants, with the container's padding and width, the surface's corner, and, for each section
 * instance, the padding of the variant it shows and the corners that variant's rows draw there.
 * The test does not check the surface's 1px `sidebar-border` ring or its `shadow-sm`. The built spec
 * draws them as the surface frame's shadows, the ring as a 1px spread. `test:compare` compares
 * browser cells with a browser snapshot, so it cannot show that Figma draws them as Chromium does.
 * The owner's Apply to a real file shows that.
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
 * `row-px`, where a row draws its `rounded-md` in place of the surface's inner corner, where the
 * panel draws no floating variant or rounds no surface, and where a floating panel shows a section
 * variant that pads or rounds its rows as the `sidebar` variant's sections do.
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

/** What Chromium computes for one panel under one pin, in CSS pixels. */
type MeasuredPanel = {
  /** The `sidebar-container`'s padding and border-box width. */
  readonly container: { readonly padding: Four; readonly width: number };
  /** The `sidebar-inner` surface's corners. */
  readonly surface: Four;
  /** Each section, by the name in {@link SECTIONS}. */
  readonly sections: Readonly<Record<string, MeasuredSection>>;
};

/** Each panel under one pin, by collapsed state. */
type Measured = Readonly<Record<string, MeasuredPanel>>;

/**
 * Stamp each pin's theme in turn and read each panel's container and surface, and every section's
 * padding and its rows' corners.
 */
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
        const corners = (element: Element): Four => {
          const style = getComputedStyle(element);
          return [
            Number.parseFloat(style.borderTopLeftRadius),
            Number.parseFloat(style.borderTopRightRadius),
            Number.parseFloat(style.borderBottomRightRadius),
            Number.parseFloat(style.borderBottomLeftRadius),
          ];
        };
        const padding = (element: Element): Four => {
          const style = getComputedStyle(element);
          return [
            Number.parseFloat(style.paddingTop),
            Number.parseFloat(style.paddingRight),
            Number.parseFloat(style.paddingBottom),
            Number.parseFloat(style.paddingLeft),
          ];
        };
        const panels: Record<string, MeasuredPanel> = {};
        for (const frame of document.querySelectorAll("[data-collapsed]")) {
          const container = frame.querySelector('[data-slot="sidebar-container"]');
          const surface = frame.querySelector('[data-slot="sidebar-inner"]');
          if (container === null || surface === null) {
            throw new Error("a panel holds no container or surface");
          }
          const found: Record<string, MeasuredSection> = {};
          for (const section of sections) {
            const box = frame.querySelector(`[data-slot="sidebar-${section}"]`);
            if (box === null) {
              throw new Error(`a panel holds no ${section}`);
            }
            const rows: Record<string, Four> = {};
            for (const rowSet of rowSets) {
              const row = box.querySelector(`[data-slot="${rowSet}"]`);
              if (row !== null) {
                rows[rowSet] = corners(row);
              }
            }
            found[section] = { padding: padding(box), rows };
          }
          panels[frame.getAttribute("data-collapsed") ?? ""] = {
            container: { padding: padding(container), width: container.getBoundingClientRect().width },
            surface: corners(surface),
            sections: found,
          };
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
        sectionApart(pin, section, root, rows, measured[index]?.[collapsed]?.sections[section])
      );
      expect(apart).toEqual([]);
    }
  );
});

describe("the Sidebar set's floating variants", () => {
  it.each(
    COLLAPSED.map((collapsed) => ({ collapsed, key: `sidebar/variant=floating,collapsed=${collapsed}` }))
  )(
    "draws $key's container, surface and sections as Chromium draws the real floating Sidebar under every pin",
    ({ collapsed, key }) => {
      const root = variantRoot(kit.spec, key);
      const surface = walkLayers(root).find((layer) => layer.kind === "frame" && layer.key === "inner");
      const sections = SECTIONS.map((section) => {
        const layer = walkLayers(root).find((each) => each.kind === "instance" && each.key === section);
        if (layer?.kind !== "instance") {
          return expect.fail(`${key} shows no ${section} instance`);
        }
        const shown = variantRoot(kit.spec, layer.variant);
        return { section, shown, rows: drawnCorners(shown) };
      });
      expect(sections.map(({ section, rows }) => [section, rows.length > 0])).toEqual(
        SECTIONS.map((section) => [section, section !== "header"])
      );
      const width = root.sizing.horizontal.kind === "fixed" ? [root.sizing.horizontal.length] : [];
      const apart = pins.flatMap((pin, index) => {
        const computed = measured[index]?.[collapsed];
        return [
          ...apartLine(pin, "container padding", resolved(paddingOf(root), pin), computed?.container.padding),
          ...apartLine(pin, "container width", resolved(width, pin), [computed?.container.width]),
          ...apartLine(
            pin,
            "surface corner",
            surface?.kind === "frame" ? resolved(fourCorners(surface.cornerRadius), pin) : [],
            computed?.surface
          ),
          ...sections.flatMap(({ section, shown, rows }) =>
            sectionApart(pin, section, shown, rows, computed?.sections[section])
          ),
        ];
      });
      expect(apart).toEqual([]);
    }
  );
});
