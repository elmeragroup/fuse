/**
 * `reconcileKit` on a file the kit was applied to, as a designer's edits or an earlier run left it:
 * scaled icons, stale focus rings and boxes a real file held. Each test changes its own fork of the applied file, then expects one Apply to repair it
 * and the next Plan to list nothing. The fork cross-check runs last, after the tests here changed their forks. `reconcile.fake.test.ts` names the oracles.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { KitSpec } from "../../src/components/kit-spec.ts";
import type { CollectionSpec } from "../../src/variable-set.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { stateOf } from "./fake/state.ts";
import type { NodeState } from "./fake/state.ts";
import {
  appliedFile,
  componentSet,
  iconLibrary,
  kitFixture,
  kitPage,
  setOn,
  syncedFile,
} from "./kit-fixture.ts";
import {
  DEFAULT_BUTTON,
  LAY_OUT_BUTTONS,
  PLACE,
  AFTER_BUTTON,
  PLACE_AFTER_BUTTON,
  RING_GRAY,
  changes,
  applies,
  variantNamed,
  onlyShadow,
} from "./reconcile-fake-support.ts";
import { reconcileKit } from "./reconcile.ts";

let kit: KitSpec;
let collections: readonly CollectionSpec[];

beforeAll(async () => {
  ({ kit, collections } = await kitFixture());
}, 60_000);

describe("a later run on an applied file", () => {
  it("brings an icon a designer scaled back to 16px with its glyph, in one Apply", async () => {
    const file = await appliedFile();
    const plus = childNamed(await iconLibrary(file), "COMPONENT", "Plus");
    const glyph = childNamed(plus, "VECTOR", "glyph");
    plus.resize(32, 32);
    expect([glyph.width, glyph.height]).toEqual([32, 32]);

    await reconcileKit(file.figma, kit, true);
    expect([plus.width, plus.height, glyph.width, glyph.height]).toEqual([16, 16, 16, 16]);
    expect(await changes(file)).toEqual([]);
  });

  it.each([
    ["moved", (glyph: VectorNode) => (glyph.x += 2)],
    ["scaled", (glyph: VectorNode) => glyph.resize(glyph.width * 2, glyph.height * 2)],
  ])("redraws an icon whose glyph a designer %s inside it, in one Apply", async (_, edit) => {
    const file = await appliedFile();
    const plus = childNamed(await iconLibrary(file), "COMPONENT", "Plus");
    const drawn = childNamed(plus, "VECTOR", "glyph");
    const box = [drawn.x, drawn.y, drawn.width, drawn.height];
    edit(drawn);

    expect(await applies(file)).toContain("Icons / Plus: draw the icon from its Fuse markup");
    const glyph = childNamed(plus, "VECTOR", "glyph");
    expect([glyph.x, glyph.y, glyph.width, glyph.height]).toEqual(box);
    expect(await changes(file)).toEqual([]);
  });

  it("repairs a focus ring that keeps a stale black under its ring binding in one Apply", async () => {
    const file = await appliedFile();
    const button = await componentSet(file, "Button");
    const focus = variantNamed(button, "variant=default, size=default, state=focus, icon=none");
    focus.effects = [{ ...onlyShadow(focus), color: { r: 0, g: 0, b: 0, a: 1 } }];
    expect(onlyShadow(focus).color).toEqual({ r: 0, g: 0, b: 0, a: 1 });

    expect(await applies(file)).toEqual([
      "Button / variant=default, size=default, state=focus, icon=none: shadows → ring 0 0 0 2 (holds variable, stored #000000 at 100%, 0 0 0 2)",
      LAY_OUT_BUTTONS,
      ...AFTER_BUTTON,
      PLACE,
      ...PLACE_AFTER_BUTTON,
    ]);
    expect(await changes(file)).toEqual([]);
    expect(onlyShadow(focus).color.r).toBeCloseTo(RING_GRAY, 2);
  });

  it("plans nothing for the Button, Separator and Switch boxes as a real file held them on 2026-10-22", async () => {
    const file = await appliedFile();
    const button = variantNamed(await componentSet(file, "Button"), DEFAULT_BUTTON);
    const label = childNamed(button, "TEXT", "label");
    const separators = setOn(await kitPage(file, "page/separator"), "Separator");
    const across = variantNamed(separators, "orientation=horizontal");
    const down = variantNamed(separators, "orientation=vertical");
    const track = variantNamed(
      setOn(await kitPage(file, "page/switch"), "Switch"),
      "size=default, checked=off, state=rest"
    );
    const thumb = childNamed(track, "FRAME", "switch-thumb");
    const dot = childNamed(thumb, "FRAME", "dot");

    // Write each box's layout through the members the plugin wrote before sizing became a
    // projection, into the state the real file held: a resize, then both sizing modes.
    const writeAsBefore = (box: FrameNode | ComponentNode, primary: "AUTO" | "FIXED"): void => {
      box.layoutMode = "HORIZONTAL";
      box.resize(box.width, box.height);
      box.primaryAxisSizingMode = primary;
      box.counterAxisSizingMode = "FIXED";
      box.minWidth = null;
      box.maxWidth = null;
      box.minHeight = null;
      box.maxHeight = null;
    };
    writeAsBefore(button, "AUTO");
    for (const box of [across, down, track, thumb, dot]) {
      writeAsBefore(box, "FIXED");
    }
    const font = label.fontName;
    if (font !== file.figma.mixed) {
      await file.figma.loadFontAsync(font);
    }
    label.textAutoResize = "WIDTH_AND_HEIGHT";

    // What the real file read on each, probe P0 of the batch run.
    const layout = (box: FrameNode | ComponentNode) => [
      box.layoutMode,
      box.layoutSizingHorizontal,
      box.layoutSizingVertical,
      box.primaryAxisSizingMode,
      box.counterAxisSizingMode,
      box.clipsContent,
    ];
    expect(layout(button)).toEqual(["HORIZONTAL", "HUG", "FIXED", "AUTO", "FIXED", true]);
    expect([button.minWidth, button.maxWidth, button.minHeight, button.maxHeight]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect([label.layoutSizingHorizontal, label.layoutSizingVertical]).toEqual(["HUG", "HUG"]);
    expect([...layout(across), across.width, across.height]).toEqual([
      "HORIZONTAL",
      "FIXED",
      "FIXED",
      "FIXED",
      "FIXED",
      true,
      256,
      1,
    ]);
    expect([down.width, down.height]).toEqual([1, 16]);
    expect([...layout(track), track.primaryAxisAlignItems, track.counterAxisAlignItems]).toEqual([
      "HORIZONTAL",
      "FIXED",
      "FIXED",
      "FIXED",
      "FIXED",
      true,
      "MIN",
      "CENTER",
    ]);
    for (const box of [thumb, dot]) {
      expect(layout(box)).toEqual(["HORIZONTAL", "FIXED", "FIXED", "FIXED", "FIXED", false]);
    }
    expect(await changes(file)).toEqual([]);
  });
});

/**
 * Every node record a fake file reaches from its node table, in walk order, with its label: its id
 * for a record the table holds, and its id and place in the walk for one only another record
 * reaches, such as a sublayer a swap replaced.
 */
function reached(fake: FakeFigma): Map<NodeState, string> {
  const file = stateOf(fake.figma.root).file;
  const labels = new Map<NodeState, string>();
  const walk: (NodeState | undefined)[] = [...file.nodes.values()];
  for (let index = 0; index < walk.length; index += 1) {
    const state = walk[index];
    if (state === undefined || labels.has(state)) {
      continue;
    }
    labels.set(
      state,
      file.nodes.get(state.id) === state ? state.id : `${state.id} off the table at ${index}`
    );
    walk.push(state.parent, ...state.children, state.main, state.mirrorOf);
  }
  return labels;
}

/**
 * The parts of a fake file a run changes in place: the file's write log, font, image and node
 * tables, and each record's own maps, sets and list of children. The paints, effects and styles a
 * record holds are read-only and replaced whole, so two files may share them.
 */
function changingParts(fake: FakeFigma): Set<unknown> {
  const file = stateOf(fake.figma.root).file;
  const parts = new Set<unknown>([file.writes, file.loadedFonts, file.images, file.nodes]);
  for (const state of reached(fake).keys()) {
    parts.add(state);
    parts.add(state.children);
    for (const value of Object.values(state)) {
      if (value instanceof Map || value instanceof Set) {
        parts.add(value);
      }
    }
  }
  return parts;
}

/**
 * Where two fake files first differ, or undefined where they hold the same records: the file's
 * counters, write log, loaded fonts, images, collections and variables, and each node record
 * `reached` finds, with every field, in the same walk order and under the same label. A node a field
 * names must be the record of the same label in the other file, and each record's public node must
 * lead back to it. Fields compare by name, whatever order made them.
 */
function fileDifference(left: FakeFigma, right: FakeFigma): string | undefined {
  const files = [stateOf(left.figma.root).file, stateOf(right.figma.root).file] as const;
  const walks = [reached(left), reached(right)] as const;
  // A field names a node by its record, and any other object a lookup is handed finds no label.
  const labels: readonly [ReadonlyMap<object, string>, ReadonlyMap<object, string>] = walks;
  const own = ([key]: readonly [string, unknown]) => key !== "file" && key !== "exposed";
  const differ = <Value>(one: Value, other: Value, path: string): string | undefined => {
    if (!(one instanceof Object) || !(other instanceof Object)) {
      return Object.is(one, other) ? undefined : `${path}: ${String(one)} against ${String(other)}`;
    }
    const [label, otherLabel] = [labels[0].get(one), labels[1].get(other)];
    if (label !== undefined || otherLabel !== undefined) {
      return label === otherLabel
        ? undefined
        : `${path}: node ${String(label)} against node ${String(otherLabel)}`;
    }
    if (one instanceof Map || one instanceof Set) {
      return (other instanceof Map || other instanceof Set) && one.constructor === other.constructor
        ? differ([...one], [...other], path)
        : `${path}: a ${one.constructor.name} against another kind`;
    }
    if (Array.isArray(one) !== Array.isArray(other)) {
      return `${path}: an array against another kind`;
    }
    const fields = Object.entries(one).filter(own);
    const otherFields = new Map(Object.entries(other).filter(own));
    if (fields.length !== otherFields.size || fields.some(([key]) => !otherFields.has(key))) {
      return `${path}: fields ${fields.map(([key]) => key).join(",")} against ${[...otherFields.keys()].join(",")}`;
    }
    for (const [key, value] of fields) {
      const found = differ(value, otherFields.get(key), `${path}.${key}`);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  };
  const [records, otherRecords] = walks.map((walk) => [...walk]);
  const order = differ(
    records?.map(([, label]) => label),
    otherRecords?.map(([, label]) => label),
    "walk"
  );
  const strays = files.map((file) =>
    [...file.variables.values()].filter((variable) => !file.collections.includes(variable.collection))
  );
  return (
    order ??
    (strays.some((stray) => stray.length > 0) ? "a variable outside the file's collections" : undefined) ??
    differ({ ...files[0], makeNode: undefined }, { ...files[1], makeNode: undefined }, "file") ??
    records?.reduce<string | undefined>((found, [state, label], index) => {
      const other = otherRecords?.[index]?.[0];
      return (
        found ??
        (stateOf(state.exposed) === state && stateOf(other?.exposed ?? state.exposed) === other
          ? differ({ ...state }, { ...other }, label)
          : `${label}: a public node that leads to another record`)
      );
    }, undefined)
  );
}

// Unit under test: the fork `appliedFile()` hands each test, of the file the kit fixture applied the
// kit to once. Oracle: a synced file the kit is applied to afresh and opened again, as `appliedFile()`
// built one for each test before it forked. The suite runs last in the file, after every test above
// changed its own fork, and two forks share no part a run changes in place.
describe("the applied file each test forks", () => {
  it("holds every record, field, write, font, image and variable a freshly applied file holds, and shares nothing a run changes", async () => {
    const fresh = syncedFile(collections);
    await reconcileKit(fresh.figma, kit, true);
    fresh.reopen();
    const fork = await appliedFile();
    expect(fileDifference(fork, fresh)).toBeUndefined();
    const other = changingParts(await appliedFile());
    expect([...changingParts(fork)].filter((part) => other.has(part))).toEqual([]);
  });
});
