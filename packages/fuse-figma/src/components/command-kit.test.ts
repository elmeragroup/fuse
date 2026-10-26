/**
 * Unit under test: the `Command item` set as the build produces it. Oracle: the Figma field each cell
 * must carry, read by hand from `command-variants.ts`, `menu-row-classes.ts`, `kbd-variants.ts` and
 * `inner-corner/command.ts`, and the 320px row the compare page renders.
 *
 * - A row is the shared menu row: at least `row-h` tall, inset by `row-py` and `row-px`, `gap-2`, and
 *   rounded with the list's inner corner, `radius-xl` less `surface-gap-sm`. Its text is its own, in
 *   14px type on a 20px line, in the surface's `popover-foreground`.
 * - `trailing` is `ms-auto text-muted-foreground in-data-highlighted:text-accent-foreground`: the
 *   shortcut, a Kbd group that is `shrink-0` and sets no width, and the caret, a 16px icon through the
 *   row's `[&_svg:not([class*='size-'])]:size-4`, end the row, the text filling the room before them.
 * - `data-highlighted:bg-accent data-highlighted:text-accent-foreground` paints a highlighted row;
 *   the Kbd caps set their own `text-muted-foreground`, so the shortcut draws its variant as it is.
 *   `data-disabled:opacity-50` dims a disabled row.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit, density, FILL, fixed, HUG, literal, paint, variantRoot } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

let spec: BuiltSets["spec"];

beforeAll(async () => {
  ({ spec } = await builtKit());
});

describe("the Command item component set", () => {
  it("holds 3 trailing forms in 3 states on the Command page, its text a property", () => {
    const items = spec.componentSets.find((candidate) => candidate.key === "command-item");
    expect([items?.name, items?.page, items?.axes, items?.columnAxis, items?.textProperties]).toEqual([
      "Command item",
      "page/command",
      [
        { name: "trailing", values: ["none", "shortcut", "caret"] },
        { name: "state", values: ["rest", "highlighted", "disabled"] },
      ],
      "state",
      [{ name: "Label", defaultValue: "New customer" }],
    ]);
  });

  it("insets a row with the menu row metrics and fills it with its text", () => {
    const root = variantRoot(spec, "command-item/trailing=none,state=rest");
    expect(root).toMatchObject({
      direction: "HORIZONTAL",
      sizing: { horizontal: fixed(literal(320)), vertical: HUG },
      limits: { minHeight: density("row-h") },
      paddingTop: density("row-py"),
      paddingRight: density("row-px"),
      paddingBottom: density("row-py"),
      paddingLeft: density("row-px"),
      itemSpacing: literal(8),
      cornerRadius: density("radius-inner/xl-gap-sm"),
      fill: undefined,
      opacity: 1,
    });
    expect(root.children.map((layer) => layer.key)).toEqual(["label"]);
    expect(root.children[0]).toMatchObject({
      characters: "New customer",
      textProperty: "Label",
      fontSize: literal(14),
      lineHeight: literal(20),
      color: paint("popover-foreground"),
      sizing: { horizontal: FILL },
    });
  });

  it("ends the row with the Kbd group after its text, which fills the room before it", () => {
    const root = variantRoot(spec, "command-item/trailing=shortcut,state=rest");
    expect([root.primaryAlign, root.itemSpacing]).toEqual(["MIN", literal(8)]);
    const [label, shortcut] = root.children;
    expect(label).toMatchObject({ kind: "text", sizing: { horizontal: FILL } });
    expect(shortcut).toEqual({
      kind: "instance",
      key: "shortcut",
      name: "kbd-group",
      componentSet: "kbd-group",
      variant: "kbd-group/keys=2",
      sizing: { horizontal: HUG, vertical: HUG },
      exposed: true,
    });
  });

  it("ends the row with a 16px muted CaretRight after its text", () => {
    const root = variantRoot(spec, "command-item/trailing=caret,state=rest");
    expect(root.primaryAlign).toBe("MIN");
    expect(root.children[0]).toMatchObject({ kind: "text", sizing: { horizontal: FILL, vertical: HUG } });
    expect(root.children[1]).toMatchObject({
      kind: "icon",
      icon: "icon/CaretRight",
      size: literal(16),
      color: paint("muted-foreground"),
    });
  });

  it("paints a highlighted row accent, its text and caret accent-foreground, its shortcut as it is", () => {
    const caret = variantRoot(spec, "command-item/trailing=caret,state=highlighted");
    expect([caret.fill, caret.children[0], caret.children[1]]).toEqual([
      paint("accent"),
      expect.objectContaining({ color: paint("accent-foreground") }),
      expect.objectContaining({ color: paint("accent-foreground") }),
    ]);
    const shortcut = variantRoot(spec, "command-item/trailing=shortcut,state=highlighted").children[1];
    expect(shortcut).toMatchObject({ kind: "instance", name: "kbd-group", variant: "kbd-group/keys=2" });
    expect(shortcut).not.toHaveProperty("overrides");
  });

  it.each(["none", "shortcut", "caret"])("dims a disabled row to half, trailing %s", (trailing) => {
    const root = variantRoot(spec, `command-item/trailing=${trailing},state=disabled`);
    expect([root.opacity, root.fill]).toEqual([0.5, undefined]);
  });
});

// The docs Groups demo (`command-groups.tsx`): two groups, Create and Go to, each of three rows whose
// shortcut is Alt and a letter. The list is `max-h-80`, 320px, scrolling past it, and pads its rows by
// `surface-gap-sm`.
describe("the Command list component set", () => {
  const list = () => variantRoot(spec, "command-list/content=grouped");

  it("is the list alone, 576px wide, padded surface-gap-sm, clipping past 320px", () => {
    expect(list()).toMatchObject({
      direction: "VERTICAL",
      sizing: { horizontal: fixed(literal(576)), vertical: HUG },
      limits: { maxHeight: literal(320) },
      clips: true,
      paddingTop: density("surface-gap-sm"),
      paddingLeft: density("surface-gap-sm"),
    });
  });

  it("holds each group's shared label and its rows, each row's shortcut Alt and its letter", () => {
    const rows = list().children.map((group) =>
      group.kind === "frame"
        ? group.children.map((layer) =>
            layer.kind === "instance"
              ? [
                  layer.variant,
                  layer.properties?.text?.Label,
                  layer.properties?.nested?.map(({ text }) => text.Label),
                ]
              : layer.kind
          )
        : group.kind
    );
    const row = (label: string | undefined, letter: string) => [
      "command-item/trailing=shortcut,state=rest",
      label,
      ["Alt", letter],
    ];
    expect(rows).toEqual([
      [
        ["menu-group-label/kind=plain", "Create", undefined],
        row(undefined, "N"),
        row("New contract", "C"),
        row("Register meter reading", "R"),
      ],
      [
        ["menu-group-label/kind=plain", "Go to", undefined],
        row("Customers", "U"),
        row("Invoices", "I"),
        row("Meter points", "M"),
      ],
    ]);
  });

  it("gives each row's caps their values at the path of the shortcut and the cap", () => {
    const [first] = list().children;
    const customer = first?.kind === "frame" ? first.children[1] : undefined;
    expect(customer?.kind === "instance" ? customer.properties?.nested : undefined).toEqual([
      { path: ["shortcut", "modifier"], text: { Label: "Alt" } },
      { path: ["shortcut", "key"], text: { Label: "N" } },
    ]);
  });
});
