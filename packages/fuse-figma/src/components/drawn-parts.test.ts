/**
 * Unit under test: the build's record of the layer each part draws, as `buildSetsInOrder` leaves it
 * in each cell's accounting (`drawn-parts.ts`), on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`). Oracle: each fixture's markup, whose element places follow the
 * capture's naming (the root's index, `root`, and each child index down), and the layer keys the
 * build's own rules give, read by hand: a part keeps its key below its box's layer, a part with a
 * margin draws its border box in the `box` its margin frame holds, a part of an element that
 * generates no box lifts into its parent as `wrapper/part` (CSS Display 3 §2.5), and an empty part
 * CSS draws 0 tall draws no layer. Parts that share a `data-slot` each keep their own place and
 * path, which a pairing by slot cannot tell apart.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, ICON, part, rest } from "../../test/capture-fixtures";
import type { BuiltFixture, FixtureElement } from "../../test/capture-fixtures";
import type { InstanceManifest, SetManifest } from "../capture/manifest";
import { makeVariableIndex } from "./css-values";

/** A recorded part as the cases write it: its place, its `data-slot` and its path's keys. */
type Recorded = {
  readonly place: string;
  readonly slot: string | undefined;
  readonly path: readonly string[] | undefined;
};

/** Each recorded part of the fixture's one cell, by place. */
function recordOf(built: BuiltFixture): readonly Recorded[] {
  const key = built.variant?.key ?? "";
  return (built.accounting.get(key)?.parts ?? [])
    .map(({ place, slot, path }) => ({ place, slot, path }))
    .toSorted((a, b) => a.place.localeCompare(b.place));
}

/** A recorded part at a place, with its `data-slot` and its path's keys, or no path. */
const at = (place: string, slot: string | undefined, path: readonly string[] | undefined): Recorded => ({
  place,
  slot,
  path,
});

/** The fixture's root, as every case records it. */
const ROOT = at("0/root", "chip", []);

/** An instance part of an inner set, shown in every cell. */
function instance(key: string, of: SetManifest): InstanceManifest {
  return { kind: "instance", key, of, cell: () => ({ state: "rest" }), shownIn: () => true };
}

/** A 20px square with a `data-slot`. */
const square = (slot: string, classes = "size-[20px]"): FixtureElement => ({ slot, classes });

describe("the layer the build records for each part", () => {
  it("keeps apart two instances that share a data-slot, as Dialog's footer Cancel and its corner close", async () => {
    const close = chip({ key: "chip-close", name: "Chip close", slot: "chip-close" });
    const built = await buildCaptured(
      chip({
        parts: [
          { ...part({ key: "footer", slot: "chip-footer" }), parts: [instance("cancel", close)] },
          instance("corner", close),
        ],
      }),
      rest({
        slot: "chip",
        classes: "relative flex flex-col",
        children: [
          { slot: "chip-footer", classes: "flex", children: [square("chip-close")] },
          square("chip-close", "absolute top-[8px] left-[8px] size-[20px]"),
        ],
      }),
      { inner: [{ manifest: close, cells: rest(square("chip-close")) }] }
    );
    expect(recordOf(built)).toEqual([
      ROOT,
      at("0/root/0", "chip-footer", ["footer"]),
      at("0/root/0/0", "chip-close", ["footer", "cancel"]),
      at("0/root/1", "chip-close", ["corner"]),
    ]);
  });

  it("keys the parts of an element that generates no box under it, where they share a data-slot", async () => {
    const built = await buildCaptured(
      chip({
        parts: [
          part({
            key: "wrap",
            slot: "chip-wrap",
            parts: [part({ key: "a", slot: "chip-item" }), part({ key: "b", slot: "chip-item" })],
          }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex",
        children: [
          {
            slot: "chip-wrap",
            classes: "contents",
            measured: { noBox: true },
            children: [square("chip-item"), square("chip-item")],
          },
        ],
      })
    );
    expect(recordOf(built)).toEqual([
      ROOT,
      at("0/root/0/0", "chip-item", ["wrap/a"]),
      at("0/root/0/1", "chip-item", ["wrap/b"]),
    ]);
  });

  it("records the data-slot an instance's element carries, where its set names another, beside a frame part with that slot", async () => {
    const rule = chip({
      key: "chip-separator",
      name: "Chip separator",
      slot: "menu-separator",
      elementSlot: () => "chip-rule",
    });
    const built = await buildCaptured(
      chip({ parts: [part({ key: "rule", slot: "chip-rule" }), instance("separator", rule)] }),
      rest({ slot: "chip", classes: "flex", children: [square("chip-rule"), square("chip-rule")] }),
      { inner: [{ manifest: rule, cells: rest(square("chip-rule")) }] }
    );
    expect(recordOf(built)).toEqual([
      ROOT,
      at("0/root/0", "chip-rule", ["rule"]),
      at("0/root/1", "chip-rule", ["separator"]),
    ]);
  });

  it("gives a key reused at two depths the path of each layer", async () => {
    const built = await buildCaptured(
      chip({
        parts: [
          part({ key: "group", slot: "chip-group", parts: [part({ key: "item", slot: "chip-inner" })] }),
          part({ key: "item", slot: "chip-outer" }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex",
        children: [
          { slot: "chip-group", classes: "flex", children: [square("chip-inner")] },
          square("chip-outer"),
        ],
      })
    );
    expect(recordOf(built)).toEqual([
      ROOT,
      at("0/root/0", "chip-group", ["group"]),
      at("0/root/0/0", "chip-inner", ["group", "item"]),
      at("0/root/1", "chip-outer", ["item"]),
    ]);
  });

  it("records the box a margin frame holds, which draws the part's border box", async () => {
    const built = await buildCaptured(
      chip({ parts: [part({ key: "pad", slot: "chip-pad" })] }),
      rest({ slot: "chip", classes: "flex", children: [square("chip-pad", "m-[8px] size-[40px]")] })
    );
    expect(recordOf(built)).toEqual([ROOT, at("0/root/0", "chip-pad", ["pad", "box"])]);
  });

  it("records no layer for an empty part CSS draws 0 tall, whose one part the cell does not show", async () => {
    const hidden = { ...part({ key: "message", slot: "chip-message" }), shownIn: () => false };
    const built = await buildCaptured(
      chip({
        parts: [
          part({ key: "empty", slot: "chip-empty", parts: [hidden] }),
          part({ key: "dot", slot: "chip-dot" }),
        ],
      }),
      rest({
        slot: "chip",
        classes: "flex flex-col",
        children: [{ slot: "chip-empty" }, square("chip-dot")],
      })
    );
    expect(recordOf(built)).toEqual([
      ROOT,
      at("0/root/0", "chip-empty", undefined),
      at("0/root/1", "chip-dot", ["dot"]),
    ]);
  });

  it("records the dot a part that scales draws, which is the box the browser measures after its scale", async () => {
    const built = await buildCaptured(
      chip({ parts: [part({ key: "thumb", slot: "chip-thumb" })] }),
      rest({ slot: "chip", classes: "flex", children: [square("chip-thumb", "size-[16px] scale-75")] })
    );
    expect(recordOf(built)).toEqual([ROOT, at("0/root/0", "chip-thumb", ["thumb", "dot"])]);
  });

  // A wrapper's box holds the `<svg>`'s margins, 24px around the 16px icon here, and no icon layer
  // draws it.
  it("records an icon at its svg, whose box the icon layer draws, also where a slotted wrapper holds it", async () => {
    const direct = await buildCaptured(
      chip({ iconsFor: () => [ICON] }),
      rest({
        slot: "chip",
        classes: "flex text-[#000000]",
        children: [{ tag: "svg", slot: "chip-icon", classes: "size-[16px]" }],
      })
    );
    const wrapped = await buildCaptured(
      chip({ iconsFor: () => [{ ...ICON, direct: false, dataIcon: "inline-start" }] }),
      rest({
        slot: "chip",
        classes: "flex text-[#000000]",
        children: [
          {
            slot: "chip-spinner",
            dataIcon: "inline-start",
            classes: "flex text-[#000000]",
            children: [{ tag: "svg", classes: "mx-[4px] size-[16px]" }],
          },
        ],
      })
    );
    expect([recordOf(direct), recordOf(wrapped)]).toEqual([
      [ROOT, at("0/root/0", "chip-icon", ["icon"])],
      [ROOT, at("0/root/0/0", undefined, ["icon", "box"])],
    ]);
  });

  it("fails the build where a part's path passes a key that a layer beside it shares", async () => {
    const built = buildCaptured(
      chip({
        label: {
          key: "label",
          name: "label",
          characters: "Profile",
          textProperty: "Label",
          shownIn: () => true,
        },
        parts: [{ ...part({ key: "label", slot: "chip-label" }), after: "label" }],
      }),
      rest({
        slot: "chip",
        classes: "flex font-sans text-[14px] leading-[20px] text-[#000000]",
        text: "Profile",
        textIndex: 0,
        children: [square("chip-label")],
      }),
      {
        variables: makeVariableIndex([
          { ref: { collection: "Fuse tokens", name: "font-sans" }, webSyntax: "var(--font-sans)" },
        ]),
      }
    );
    await expect(built).rejects.toThrow(
      "chip/state=rest: the layer of the part label at 0/root/0 has the path label, which another layer's key beside it shares"
    );
  });
});
