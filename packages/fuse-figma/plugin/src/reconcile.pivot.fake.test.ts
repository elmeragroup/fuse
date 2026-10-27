/**
 * `reconcileKit` with a kit whose popup holds an arrow placed by its centre, CENTER × MAX at -45, as a
 * Tooltip's arrow hangs from its popup, on the in-memory file in `fake-figma.ts`. The arrow's size
 * changes in the run, from a designer's resize or a kit update. Oracle: the arrow's centre is its
 * `relativeTransform` applied to its half width and height (W5-P11), which must sit at the declared
 * offset from the popup's horizontal centre and inset above its bottom after one Apply, so the next
 * Plan lists nothing. The sizes change by even amounts, which rule 59 keeps whole (W5-P11b).
 */
import { describe, expect, it } from "vitest";

import type { ComponentSetSpec, FrameLayerSpec, KitSpec, PivotSpec } from "../../src/components/kit-spec.ts";
import { bareRoot, fixture, frame, literal, oneVariant } from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed, GLYPH_FONT } from "./fake-fixtures.ts";
import { reconcileKit } from "./reconcile.ts";

const BLACK = { kind: "literal", color: { r: 0, g: 0, b: 0, a: 1 } } as const;
const fixed = (value: number) => ({ kind: "fixed", length: literal(value) }) as const;

/** The popup's size and the arrow's place: centred across, its centre 2px above the bottom. */
const POPUP = { width: 120, height: 32 } as const;
const PLACE = { centerOffset: 0, bottomInset: 2 } as const;

/** The arrow, `size` square, turned -45 and placed by its centre. */
function arrow(size: number): FrameLayerSpec {
  return {
    ...frame("popup/arrow", "arrow", []),
    sizing: { horizontal: fixed(size), vertical: fixed(size) },
    fill: BLACK,
    rotation: -45,
    pivot: { constraints: { horizontal: "CENTER", vertical: "MAX" }, ...PLACE },
  };
}

/** A kit of one popup, 120 × 32, holding the arrow at `size`. */
function kitWith(size: number): KitSpec {
  const popup: ComponentSetSpec = oneVariant("popup", "Popup", {
    ...bareRoot("popup", { horizontal: fixed(POPUP.width), vertical: fixed(POPUP.height) }),
    children: [arrow(size)],
  });
  return {
    pages: [{ key: "page", name: "Fuse components" }],
    fonts: [],
    glyphFont: GLYPH_FONT,
    icons: { key: "icons", page: "page", name: "Icons", size: 16, color: BLACK, icons: [] },
    componentSets: [popup],
    previews: [],
  };
}

/** The arrow frame in the file's one popup variant. */
function arrowIn(file: FakeFigma): FrameNode {
  const page = file.figma.root.children.find((node) => node.name === "Fuse components");
  const set = page?.children.find((node) => node.type === "COMPONENT_SET");
  const [variant] = set?.type === "COMPONENT_SET" ? set.children : [];
  if (variant?.type !== "COMPONENT") {
    throw new Error("the kit holds the popup variant");
  }
  return childNamed(variant, "FRAME", "arrow");
}

/** The linear part of a layer's `relativeTransform`: `[[a, b], [c, d]]`. */
type Turn = { readonly a: number; readonly b: number; readonly c: number; readonly d: number };

/**
 * The arrow's turn as a real file's `relativeTransform` holds it: at rotation -45 it read
 * `[[0.7071, -0.7071, x], [0.7071, 0.7071, y]]`, so a and d are the cosine, b the sine and c minus
 * the sine of the rotation (W5-P11). The fake does not model `relativeTransform`, so the test builds it.
 */
function turnOf(layer: FrameNode): Turn {
  const radians = (layer.rotation * Math.PI) / 180;
  return { a: Math.cos(radians), b: Math.sin(radians), c: -Math.sin(radians), d: Math.cos(radians) };
}

/** The arrow's centre as its transform maps its half size, against the popup's centre and bottom. */
function placeOf(layer: FrameNode): Pick<PivotSpec, "centerOffset" | "bottomInset"> {
  const { a, b, c, d } = turnOf(layer);
  const [tx, ty] = [layer.x, layer.y];
  const x = a * (layer.width / 2) + b * (layer.height / 2) + tx;
  const y = c * (layer.width / 2) + d * (layer.height / 2) + ty;
  return { centerOffset: x - POPUP.width / 2, bottomInset: POPUP.height - y };
}

/** Move the arrow so its centre sits at the declared place, as a designer resizing it about it would. */
function resizeAboutCentre(layer: FrameNode, size: number): void {
  layer.resize(size, size);
  const { a, b, c, d } = turnOf(layer);
  const centre = { x: POPUP.width / 2 + PLACE.centerOffset, y: POPUP.height - PLACE.bottomInset };
  layer.x = centre.x - (a * size) / 2 - (b * size) / 2;
  layer.y = centre.y - (c * size) / 2 - (d * size) / 2;
}

describe("an arrow placed by its centre whose size changes in the run", () => {
  it("places it again after a designer's 14px arrow returns to 10, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, kitWith(10), true);
    file.reopen();
    resizeAboutCentre(arrowIn(file), 14);
    expect(placeOf(arrowIn(file)).centerOffset).toBeCloseTo(0, 4);
    await reconcileKit(file.figma, kitWith(10), true);
    file.reopen();
    const placed = placeOf(arrowIn(file));
    expect(
      [arrowIn(file).width, placed.centerOffset, placed.bottomInset].map((n) => Number(n.toFixed(4)))
    ).toEqual([10, 0, 2]);
    expect(await reconcileKit(file.figma, kitWith(10), false)).toEqual({ changes: [], warnings: [] });
  });

  it("places it again when a kit update grows it from 10 to 14, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, kitWith(10), true);
    file.reopen();
    await reconcileKit(file.figma, kitWith(14), true);
    file.reopen();
    const placed = placeOf(arrowIn(file));
    expect(
      [arrowIn(file).width, placed.centerOffset, placed.bottomInset].map((n) => Number(n.toFixed(4)))
    ).toEqual([14, 0, 2]);
    expect(await reconcileKit(file.figma, kitWith(14), false)).toEqual({ changes: [], warnings: [] });
  });
});
