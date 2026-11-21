/**
 * Unit under test: the compare page's check and paint clip around each cell's slot, through
 * `CompareBrowser.renderPreview` in Chromium.
 * Oracle: the geometry the test markup writes, which also places the strip a static cell's crop
 * reaches past its slot, and for Action bar the docs demo's `max-w-xl` column,
 * 36rem or 576px, which its renderer's host takes. A one-slot cell's slot is 528×464 with its
 * element 8px in from the corner, and its crop keeps 8px around the measured box.
 */
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { variantKey } from "../components/component-spec.ts";
import { KIT } from "../components/kit-registry.ts";
import { CompareBrowser } from "./browser-render.ts";
import type { CellRequest } from "./browser-render.ts";
import { loadRenderers } from "./cell-renderers.ts";
import type { AnyCellRenderer } from "./cell-renderers.ts";
import { locateFuseBuild, readPageAssets } from "./page-assets.ts";
import type { PageAssets } from "./page-assets.ts";
import { PAGE_LAYOUT } from "./preview-page.ts";
import type { Raster } from "./raster.ts";
import { planCells, renderables } from "./run-compare.ts";

/**
 * The page's own sheet. Each rule matches only under the real hover the page falls back on, since
 * it needs the slot hovered and the page forces `:hover` on the probe alone.
 */
const ASSETS = {
  styles: [
    ".grows-host{width:20px}[data-compare-cell]:hover>.grows-host{width:600px}",
    ".grows-root{width:20px}[data-compare-cell]:hover>.grows-root{width:100px}",
  ].join("\n"),
  themes: "",
  preflight: "",
  fontCss: "",
  fontDirectories: new Map<string, string>(),
  fontPackages: [],
  hostCss: "",
  client: "",
};

const THEME = {
  scheme: "light",
  identity: "neutral",
  brand: "fkas",
  segment: "private",
  density: "dense",
} as const;

/**
 * A one-slot static cell named by its id that measures `measured`, `.probe` unless named, hovered
 * under `fallback hover`.
 */
function request(
  id: string,
  html: string,
  {
    shown = "rest",
    measured = ".probe",
  }: { readonly shown?: "rest" | "fallback hover"; readonly measured?: string } = {}
): CellRequest {
  const content = { _tag: "Static", html } as const;
  const hover = shown === "fallback hover";
  return {
    id,
    name: id,
    content,
    measured: [measured],
    span: 1,
    height: undefined,
    forcedOn: ".probe",
    forced: hover ? ["hover"] : [],
    writesHighlightAttribute: false,
    resting: hover ? content : undefined,
    fallback: hover ? "hover" : "none",
    restsByDesign: false,
  };
}

/**
 * A blue 20px probe moved 1px left, as Fuse's `Sidebar.MenuSubButton` moves itself with
 * `-translate-x-px`.
 */
const SHIFTED =
  '<div class="probe" style="width:20px;height:20px;background:blue;transform:translateX(-1px)"></div>';

/** Render cells on one page, as `figma:compare` does. */
function render(assets: PageAssets, requests: readonly CellRequest[]) {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const browser = yield* CompareBrowser.launch(assets);
        return yield* browser.renderPreview(THEME, requests, PAGE_LAYOUT);
      })
    )
  );
}

/** Render a source cell and an empty neighbor in the next slot. */
function renderBeside(source: CellRequest) {
  return render(ASSETS, [
    source,
    request("neighbor", '<div class="probe" style="width:20px;height:20px"></div>'),
  ]);
}

/** How many pixels of a crop are opaque red. */
function redPixels({ data }: Raster): number {
  let red = 0;
  for (let at = 0; at < data.length; at += 4) {
    if (data[at] === 255 && data[at + 1] === 0 && data[at + 2] === 0 && data[at + 3] === 255) {
      red++;
    }
  }
  return red;
}

/** The leftmost column of a crop that holds a painted pixel, or undefined for none. */
function firstPaintedColumn({ width, data }: Raster): number | undefined {
  const columns = Array.from({ length: data.length / 4 }, (_, pixel) =>
    (data[pixel * 4 + 3] ?? 0) > 0 ? pixel % width : width
  );
  const first = Math.min(...columns);
  return first < width ? first : undefined;
}

/** The renderer without the `hostWidth` it declares. */
function withoutHostWidth({ hostWidth: _declared, ...renderer }: AnyCellRenderer): AnyCellRenderer {
  return renderer;
}

describe("Action bar's cell", () => {
  const manifest = KIT.find((entry) => entry.manifest.key === "action-bar");
  const cell = manifest?.previewCells[0];
  if (manifest === undefined || cell === undefined) {
    throw new Error("the kit places no action-bar cell");
  }
  const variant = variantKey(manifest.manifest, cell);
  const loaded = Effect.runPromise(
    Effect.gen(function* () {
      const build = yield* locateFuseBuild();
      const renderers = yield* loadRenderers(new Set(["action-bar"]));
      return { renderers, assets: yield* readPageAssets(build, renderers) };
    }).pipe(Effect.provide(NodeServices.layer))
  );

  /** Plan the cell as `figma:compare` does, from the renderers given, and render it. */
  async function renderActionBar(adjust: (renderer: AnyCellRenderer) => AnyCellRenderer) {
    const { renderers, assets } = await loaded;
    const adjusted = new Map([...renderers].map(([set, renderer]) => [set, adjust(renderer)]));
    const instance = { key: variant, variant, box: { x: 0, y: 0, width: 0, height: 0 }, image: null };
    const { planned } = planCells([instance], renderables(adjusted), new Set(), PAGE_LAYOUT);
    return render(
      assets,
      planned.map((entry) => entry.request)
    );
  }

  it("renders in the slots its renderer's hostWidth spans", async () => {
    const rendered = await renderActionBar((renderer) => renderer);
    expect(rendered.cells.size).toBe(1);
  });

  it("stops the run, naming its 576px host, when its renderer declares no hostWidth", async () => {
    // Only the variant, the one slot's 528px width and the host's 576px width come from the oracle.
    const literal = variant.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    await expect(renderActionBar(withoutHostWidth)).rejects.toThrow(
      new RegExp(String.raw`^${literal} reaches past its 528×\d+ slot: \S+ 576×`, "m")
    );
  });
});

describe("a cell's slot", () => {
  /**
   * A 20px root `margin` px past the slot's 8px padding, whose 36px crop starts at `margin` and so
   * ends `margin - 492` px past the 528px slot.
   */
  function rootAt(margin: number): CellRequest {
    return request(
      "source",
      `<div class="probe" style="width:20px;height:20px;margin-left:${String(margin)}px;background:red"></div>`
    );
  }

  it.each([
    ["8px", 500],
    ["2px", 494],
  ])("stops the run when a static cell's crop reaches %s into the next slot", async (_, margin) => {
    await expect(renderBeside(rootAt(margin))).rejects.toThrow(
      `source reaches past its 528×464 slot: its crop 36×36 at ${String(margin)},0`
    );
  });

  it("renders a static cell whose crop reaches 1px past its slot, as a Sidebar sub button's does", async () => {
    const rendered = await renderBeside(rootAt(493));
    expect(rendered.cells.get("source")?.box).toEqual({ width: 20, height: 20 });
  });

  it("renders a static cell whose measured selector starts with a combinator", async () => {
    const source = request("source", '<div class="probe" style="width:20px;height:20px"></div>', {
      measured: "> .probe",
    });
    const rendered = await renderBeside(source);
    expect(rendered.cells.get("source")?.box).toEqual({ width: 20, height: 20 });
  });

  it("leaves out a neighbor's paint from the 1px a static cell's crop reaches past its slot", async () => {
    // The red child and its 4px shadow end at the first slot's right edge, at 528px. The second
    // cell's probe sits 1px left of its slot's padding, so its crop starts at 527px.
    const painted = request(
      "painted",
      '<div class="probe" style="position:relative;width:20px;height:20px"><i style="position:absolute;left:496px;width:20px;height:20px;background:red;box-shadow:4px 0 red"></i></div>'
    );
    const rendered = await render(ASSETS, [painted, request("shifted", SHIFTED)]);
    const shifted = rendered.cells.get("shifted");
    expect(shifted === undefined ? undefined : redPixels(shifted.raster)).toBe(0);
  });

  it("gives a crop that starts 1px left of the page the crop's size and origin", async () => {
    const shifted = (await render(ASSETS, [request("shifted", SHIFTED)])).cells.get("shifted");
    // The 20px probe with 8px on each side, at two device pixels per CSS pixel, so the probe's
    // first column is 16 device pixels in.
    expect(
      shifted === undefined
        ? undefined
        : [shifted.raster.width, shifted.raster.height, firstPaintedColumn(shifted.raster)]
    ).toEqual([72, 72, 16]);
  });

  it("stops the run when a host grows past the slot only under the real hover", async () => {
    const source = request(
      "source",
      '<div class="grows-host" style="height:20px"><div class="probe" style="width:20px;height:20px"></div></div>',
      { shown: "fallback hover" }
    );
    await expect(renderBeside(source)).rejects.toThrow(
      "source reaches past its 528×464 slot: div 600×20 at 8,8"
    );
  });

  it("crops the box the real hover gives a cell", async () => {
    const source = request(
      "source",
      '<div class="probe grows-root" style="height:20px;background:red"></div>',
      { shown: "fallback hover" }
    );
    const rendered = (await renderBeside(source)).cells.get("source");
    // The 100px root with 8px on each side, at two device pixels per CSS pixel.
    expect(rendered?.box).toEqual({ width: 100, height: 20 });
    expect(rendered === undefined ? undefined : [rendered.raster.width, rendered.raster.height]).toEqual([
      232, 72,
    ]);
  });

  it("keeps a shadow past the slot's edge out of the neighbor's crop", async () => {
    // The red child ends 4px inside the slot, and its 32px shadow reaches 28px past it.
    const source = request(
      "source",
      '<div class="probe" style="position:relative;width:20px;height:20px"><i style="position:absolute;left:496px;width:20px;height:20px;background:red;box-shadow:32px 0 red"></i></div>'
    );
    const neighbor = (await renderBeside(source)).cells.get("neighbor");
    expect(neighbor === undefined ? undefined : redPixels(neighbor.raster)).toBe(0);
  });
});
