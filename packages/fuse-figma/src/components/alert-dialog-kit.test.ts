/**
 * Unit under test: the Alert dialog sets `Alert dialog content` and `Alert dialog (open)` as the build
 * produces them. Oracle: the Figma field each cell must carry, read by hand from `dialog-variants.ts`,
 * `alert-dialog-variants.ts`, `overlay-classes.ts` and `alert-dialog.tsx`, the docs Destructive,
 * Neutral and Pending demos, and the open AlertDialog Chromium measured with preflight in a 640 × 480
 * host on 2026-10-27, its window 1280px wide so `sm:` holds:
 *
 * The kit's viewport is 640 × 448, as `ALERT_DIALOG_VIEWPORT` says, which gives the popup the same
 * width and size; only its height cap, 100% less 32px, becomes 416px.
 *
 * - The popup is 448 × 160 dense and 448 × 180 comfortable: `surface-pad-lg` padding, its header
 *   (28px), description (20px) and footer (32px or 36px) 24px apart, centred in the viewport.
 * - The header holds the title and, at its end, the title line, 20 × 28, around the 20px icon.
 * - The footer ends its row: Cancel, then the action, 8px apart.
 * - The scrim fills the viewport, `black/10`, blurring what lies behind it by `backdrop-blur-xs`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, fixed, HUG, literal, paint, token, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import type { ChildLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

const popup = (variant: string) => variantRoot(spec, `alert-dialog-content/variant=${variant}`);

/** The layer at a path of keys below a root. */
function at(layers: readonly ChildLayerSpec[], ...keys: readonly string[]): ChildLayerSpec | undefined {
  const [key, ...rest] = keys;
  const layer = layers.find((candidate) => candidate.key === key);
  return rest.length === 0 || layer?.kind !== "frame" ? layer : at(layer.children, ...rest);
}

describe("the Alert dialog content component set", () => {
  it("sits on its own page, destructive, neutral and pending", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "alert-dialog-content");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Alert dialog content",
      "page/alert-dialog",
      [{ name: "variant", values: ["destructive", "neutral", "pending"] }],
    ]);
  });

  it("draws the popup 448px wide in its viewport, padded, its rows 24px apart", () => {
    expect(popup("destructive")).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(448)), vertical: HUG },
      limits: { maxHeight: literal(416) },
      paddingTop: density("surface-pad-lg"),
      paddingLeft: density("surface-pad-lg"),
      itemSpacing: literal(24),
      cornerRadius: token("radius-xl"),
      fill: paint("dialog"),
    });
  });

  it("holds the title and the title line's icon, WarningOctagon in error or Info", () => {
    const header = (variant: string) => at(popup(variant).children, "header");
    expect(header("destructive")).toMatchObject({ primaryAlign: "SPACE_BETWEEN", itemSpacing: literal(16) });
    expect(at(popup("destructive").children, "header", "title-line")).toMatchObject({
      sizing: { horizontal: HUG, vertical: fixed(literal(28)) },
      children: [{ kind: "icon", icon: "icon/WarningOctagon", size: literal(20), color: paint("error") }],
    });
    expect(at(popup("neutral").children, "header", "title-line")).toMatchObject({
      children: [{ kind: "icon", icon: "icon/Info" }],
    });
    expect(at(popup("neutral").children, "header", "title", "text")).toMatchObject({
      characters: "Archive this meter?",
      fontSize: literal(20),
      lineHeight: literal(28),
    });
  });

  it("ends the footer with the ghost Cancel and the action, pending in the pending cell", () => {
    const buttons = (variant: string) => {
      const footer = at(popup(variant).children, "footer");
      return footer?.kind === "frame"
        ? footer.children.map((child) => (child.kind === "instance" ? [child.variant, child.properties] : []))
        : [];
    };
    expect(at(popup("destructive").children, "footer")).toMatchObject({
      primaryAlign: "MAX",
      itemSpacing: literal(8),
    });
    expect([buttons("destructive"), buttons("neutral"), buttons("pending")]).toEqual([
      [
        ["button/variant=ghost,size=sm,state=rest,icon=none", { text: { Label: "Cancel" } }],
        ["button/variant=destructive,size=sm,state=rest,icon=none", { text: { Label: "Delete" } }],
      ],
      [
        ["button/variant=ghost,size=sm,state=rest,icon=none", { text: { Label: "Cancel" } }],
        ["button/variant=default,size=sm,state=rest,icon=none", { text: { Label: "Archive" } }],
      ],
      [
        ["button/variant=ghost,size=sm,state=rest,icon=none", { text: { Label: "Cancel" } }],
        ["button/variant=destructive,size=sm,state=pending,icon=none", { text: { Label: "Delete" } }],
      ],
    ]);
  });
});

describe("the Alert dialog (open) component set", () => {
  it("draws the scrim over the viewport, blurring behind it, and centres the destructive popup", () => {
    const root = variantRoot(spec, "alert-dialog-open/placement=centered");
    expect(root).toMatchObject({
      sizing: { horizontal: fixed(literal(640)), vertical: fixed(literal(448)) },
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      fill: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } },
      backgroundBlur: literal(8),
    });
    expect(root.children).toMatchObject([
      {
        kind: "instance",
        variant: "alert-dialog-content/variant=destructive",
        sizing: { horizontal: fixed(literal(448)), vertical: HUG },
      },
    ]);
  });
});
