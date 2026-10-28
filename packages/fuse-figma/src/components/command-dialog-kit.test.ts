/**
 * Unit under test: the Command dialog sets `Command palette` and `Command dialog (open)` as the build
 * produces them. Oracle: the Figma field each cell must carry, read by hand from `command-variants.ts`,
 * `overlay-classes.ts`, the `command` inner-corner shells and `command.tsx`, the docs Dialog demo, and
 * the open palette Chromium measured with preflight on 2026-10-27:
 *
 * - The palette is 576px wide (`max-w-xl`), 289px tall dense and 341px comfortable, under its
 *   `max-h-[calc(100dvh-2*max(--spacing(4),12dvh))]` cap, which the kit's 640 × 500 viewport makes
 *   380px.
 * - The input sits `surface-gap-sm` in from the palette's top and sides, the list below it holds the
 *   demo's six commands at rest, and the footer's hints start `surface-gap-sm + row-px`
 *   in, 16px apart: ↑ ↓ Navigate, ↵ Run, Esc Close.
 * - The open example is the scrim over the viewport, the palette 60px below its top
 *   (`max(1rem, 12dvh)` of 500px) and centred across.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  builtKit,
  density,
  fixed,
  FILL,
  HUG,
  literal,
  paint,
  token,
  variantRoot,
} from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";
import { layerAt } from "./kit-spec";
import type { BoxSpec, ChildLayerSpec } from "./kit-spec";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

const palette = () => variantRoot(spec, "command-palette/content=commands");

/** The layers of a box or a frame, or none. */
const childrenOf = (frame: BoxSpec | ChildLayerSpec | undefined) =>
  frame !== undefined && "children" in frame ? frame.children : [];

describe("the Command palette component set", () => {
  it("sits on the Command page, one cell", () => {
    const set = spec.componentSets.find((candidate) => candidate.key === "command-palette");
    expect([set?.name, set?.page, set?.axes]).toEqual([
      "Command palette",
      "page/command",
      [{ name: "content", values: ["commands"] }],
    ]);
  });

  it("draws the palette 576px wide, hugging under its 380px cap, on the popover surface", () => {
    expect(palette()).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(576)), vertical: HUG },
      limits: { maxHeight: literal(380) },
      cornerRadius: token("radius-xl"),
      fill: paint("popover"),
      clips: true,
    });
  });

  it("insets the search Input group by surface-gap-sm above and across", () => {
    const input = layerAt(palette(), ["input"]);
    expect(input).toMatchObject({
      sizing: { horizontal: FILL, vertical: HUG },
      paddingTop: density("surface-gap-sm"),
      paddingLeft: density("surface-gap-sm"),
      paddingRight: density("surface-gap-sm"),
      paddingBottom: literal(0),
    });
    expect(childrenOf(input)).toMatchObject([
      { kind: "instance", variant: "input-group/form=search,state=rest", sizing: { horizontal: FILL } },
    ]);
  });

  // The Command item set's own label is the first command, `New customer`, so its row sets none.
  it("lists the demo's six commands at rest", () => {
    const rows = childrenOf(layerAt(palette(), ["list"])).map((row) =>
      row.kind === "instance" ? [row.variant, row.properties] : []
    );
    expect(rows).toEqual([
      ["command-item/trailing=none,state=rest", undefined],
      ["command-item/trailing=none,state=rest", { text: { Label: "Register meter reading" } }],
      ["command-item/trailing=none,state=rest", { text: { Label: "Create credit note" } }],
      ["command-item/trailing=none,state=rest", { text: { Label: "Open invoices" } }],
      ["command-item/trailing=none,state=rest", { text: { Label: "Open contracts" } }],
      ["command-item/trailing=none,state=rest", { text: { Label: "Open settings" } }],
    ]);
  });

  it("sets the footer's hints on one line, 16px apart, their keys as Kbd instances", () => {
    const footer = layerAt(palette(), ["footer"]);
    expect(footer).toMatchObject({
      direction: "HORIZONTAL",
      itemSpacing: literal(16),
      paddingLeft: density("command-text-px"),
      paddingRight: density("command-text-px"),
      paddingTop: density("surface-gap-sm"),
    });
    const hints = childrenOf(footer).map((hint) =>
      childrenOf(hint).map((part) =>
        part.kind === "instance" ? part.properties?.text?.Label : part.kind === "text" ? part.characters : ""
      )
    );
    expect(hints).toEqual([
      ["↑", "↓", "Navigate"],
      ["↵", "Run"],
      ["Esc", "Close"],
    ]);
  });
});

describe("the Command dialog (open) component set", () => {
  it("draws the scrim over the viewport and the palette 60px below its top, centred across", () => {
    const root = variantRoot(spec, "command-dialog-open/placement=top");
    expect(root).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(640)), vertical: fixed(literal(500)) },
      paddingTop: literal(60),
      primaryAlign: "MIN",
      counterAlign: "CENTER",
      backgroundBlur: literal(8),
    });
    expect(root.children).toMatchObject([
      {
        kind: "instance",
        variant: "command-palette/content=commands",
        sizing: { horizontal: fixed(literal(576)), vertical: HUG },
      },
    ]);
  });
});
