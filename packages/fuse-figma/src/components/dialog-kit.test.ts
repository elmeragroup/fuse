/**
 * Unit under test: the Dialog sets `Dialog content` and `Dialog (open)` as the build produces them.
 * Oracle: the Figma field each cell must carry, read by hand from `dialog-variants.ts`,
 * `overlay-classes.ts`, `overlay-corner-close-class.ts`, `overlay-close-button.tsx` and `dialog.tsx`,
 * the docs Basic and Footer close demos, and the open Dialog Chromium measured with preflight in a
 * 640 × 448 host on 2026-10-27, its window 1280px wide so `sm:` holds:
 *
 * - The popup is 448px wide, padded `surface-pad-lg`, its header and footer 24px apart; the header
 *   stacks the title over the description 8px apart; the footer ends its row, 8px apart.
 * - The corner close is the 32px (dense) or 36px (comfortable) ghost `icon-sm` Button, 16px from the
 *   popup's end and 16px below its top, at (400, 16) or (396, 16).
 * - The open example is the scrim over the viewport with the Basic popup centred.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, frameLayerAt, fixed, HUG, literal, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { layerAt } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

const popup = (content: string) => variantRoot(spec, `dialog-content/content=${content}`);

describe("the Dialog content component set", () => {
  it("sits on its own page, basic and with the footer close", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "dialog-content");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Dialog content",
      "page/dialog",
      [{ name: "content", values: ["basic", "footer-close"] }],
    ]);
  });

  it("draws the popup 448px wide, its header over its footer 24px apart", () => {
    expect(popup("basic")).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(448)), vertical: HUG },
      paddingTop: density("surface-pad-lg"),
      itemSpacing: literal(24),
    });
    expect(layerAt(popup("basic"), ["header"])).toMatchObject({
      direction: "VERTICAL",
      itemSpacing: literal(8),
    });
  });

  it("places the corner close 16px from the popup's end and 16px below its top, MAX × MIN", () => {
    expect([layerAt(popup("basic"), ["close"]), layerAt(popup("footer-close"), ["close"])]).toMatchObject([
      {
        kind: "instance",
        variant: "icon-button/variant=ghost,size=icon-sm,state=rest",
        properties: { swap: { Icon: "icon/X" } },
        absolute: { constraints: { horizontal: "MAX", vertical: "MIN" }, endInset: 16, topInset: 16 },
      },
      { absolute: { constraints: { horizontal: "MAX", vertical: "MIN" }, endInset: 16, topInset: 16 } },
    ]);
  });

  it("ends the footer with each demo's actions in order", () => {
    const actions = (content: string) => {
      const footer = frameLayerAt(popup(content), ["footer"]);
      return footer?.kind === "frame"
        ? footer.children.map((child) => (child.kind === "instance" ? [child.variant, child.properties] : []))
        : [];
    };
    expect([actions("basic"), actions("footer-close")]).toEqual([
      [
        ["button/variant=outline,size=default,state=rest,icon=none", { text: { Label: "Cancel" } }],
        ["button/variant=default,size=default,state=rest,icon=none", { text: { Label: "Move reading" } }],
      ],
      [
        ["button/variant=default,size=default,state=rest,icon=none", { text: { Label: "Cancel contract" } }],
        ["button/variant=outline,size=default,state=rest,icon=none", { text: { Label: "Close" } }],
      ],
    ]);
  });
});

describe("the Dialog (open) component set", () => {
  it("draws the scrim over the viewport and centres the Basic popup", () => {
    const root = variantRoot(spec, "dialog-open/placement=centered");
    expect(root).toMatchObject({
      sizing: { horizontal: fixed(literal(640)), vertical: fixed(literal(448)) },
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
      backgroundBlur: literal(8),
    });
    expect(root.children).toMatchObject([
      {
        kind: "instance",
        variant: "dialog-content/content=basic",
        sizing: { horizontal: fixed(literal(448)), vertical: HUG },
      },
    ]);
  });
});
