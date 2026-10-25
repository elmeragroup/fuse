/**
 * `reconcileKit` with the one-variant kit of `button-kit-fixture.ts` on the in-memory file in
 * `fake-figma.ts`, for a part that hides behind a BOOLEAN property and for layers that turn. The
 * oracles are the fake's rules 25, 26 and 42, which follow what a real file did on 2026-10-22 and
 * 2026-10-24 (PB, PR, PQ, NH), the change lines Plan lists, and the writes the file took.
 */
import { describe, expect, it } from "vitest";

import type {
  BooleanPropertySpec,
  FrameLayerSpec,
  IconLayerSpec,
  KitSpec,
} from "../../src/components/kit-spec.ts";
import {
  buttonSet,
  buttonVariant,
  CHECK,
  fixture,
  frame,
  KIT,
  kitWithRoot,
  literal,
  nestedKit,
  RELAYOUT,
} from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { reconcileKit } from "./reconcile.ts";

/** A BOOLEAN property that shows a detail part, as a description hides behind one. */
const DETAIL: BooleanPropertySpec = { name: "Detail", defaultValue: true };

/** `kit` with its Button set holding the given BOOLEAN properties. */
function withBooleans(kit: KitSpec, booleanProperties: readonly BooleanPropertySpec[]): KitSpec {
  return { ...kit, componentSets: kit.componentSets.map((set) => ({ ...set, booleanProperties })) };
}

describe("the kit check of BOOLEAN properties and turns", () => {
  it.each([
    [
      "a frame that links a BOOLEAN property the set lacks",
      nestedKit([{ ...frame("button/control", "Control", []), visibleProperty: "Detail" }]),
      "Button: the variant button/size=md links Detail, which the set does not define.",
    ],
    [
      "an icon that links a BOOLEAN property the set lacks",
      nestedKit([{ ...CHECK, visibleProperty: "Detail" }]),
      "Button: the variant button/size=md links Detail, which the set does not define.",
    ],
    [
      "a BOOLEAN property named as a TEXT property",
      withBooleans(
        {
          ...KIT,
          componentSets: KIT.componentSets.map((set) => ({
            ...set,
            textProperties: [{ name: "Detail", defaultValue: "More" }],
          })),
        },
        [DETAIL]
      ),
      "Button names two properties Detail, and the plugin finds each property by its name.",
    ],
    [
      "an icon that turns less than a quarter turn",
      nestedKit([{ ...CHECK, rotation: 45 }]),
      "Button: Check in the variant button/size=md has a rotation of 45, and the kit draws only half and quarter turns.",
    ],
    [
      "a 20 × 10 frame that turns a quarter turn, which PQ laid out by its turned box",
      nestedKit([
        {
          ...frame("button/control", "Control", []),
          sizing: {
            horizontal: { kind: "fixed", length: literal(20) },
            vertical: { kind: "fixed", length: literal(10) },
          },
          rotation: 90,
        },
      ]),
      "Button: Control in the variant button/size=md turns a quarter turn without two equal fixed sides, and Figma lays a turned layer out by its turned box, where CSS leaves the layout as it was.",
    ],
    [
      "an absolute frame that turns",
      nestedKit([
        {
          ...frame("button/fill", "Fill", []),
          absolute: { x: 0, y: 0, constraints: { horizontal: "SCALE", vertical: "STRETCH" } },
          rotation: 180,
        },
      ]),
      "Button: Fill in the variant button/size=md is absolute and turns, and the plugin places an absolute layer by an x and y that a turn moves.",
    ],
  ])("stops Plan before any write for %s", async (_, kit, message) => {
    const { file, setup } = fixture("Roboto");
    await expect(reconcileKit(file.figma, kit, false)).rejects.toThrow(message);
    expect(file.writes.slice(setup)).toEqual([]);
  });
});

// Unit under test: `reconcileKit` on a variant whose part hides behind a BOOLEAN property, as an
// optional description does. Oracle: the fake's rule 25, which follows what a real file did on
// 2026-10-22 (PB): the set lists the property once by its name and an id, the part's frame links its
// `visible` to it, and an instance set to false reads the part as hidden. The plugin leaves
// `skipInvisibleInstanceChildren` false, so the instance still lists the part. The second Plan lists
// nothing.
describe("a variant whose part hides behind a BOOLEAN property", () => {
  const SHOWN = frame("button/detail", "Detail", []);
  const kitWith = (detail: FrameLayerSpec, booleans: readonly BooleanPropertySpec[]) =>
    withBooleans(nestedKit([CHECK, detail]), booleans);
  const OPTIONAL = kitWith({ ...SHOWN, visibleProperty: "Detail" }, [DETAIL]);

  /** The Button set's BOOLEAN properties, each by its name and default, with its id. */
  async function booleansOf(file: FakeFigma) {
    const definitions = (await buttonSet(file)).componentPropertyDefinitions;
    return Object.entries(definitions).flatMap(([id, definition]) =>
      definition.type === "BOOLEAN"
        ? [{ id, name: id.split("#")[0], defaultValue: definition.defaultValue }]
        : []
    );
  }

  it("lists the property once and links the part in one Apply, and an instance set to false hides the part", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, OPTIONAL, true);
    file.reopen();
    expect(await reconcileKit(file.figma, OPTIONAL, false)).toEqual({ changes: [], warnings: [] });
    const variant = await buttonVariant(file);
    const booleans = await booleansOf(file);
    expect(booleans.map(({ name, defaultValue }) => [name, defaultValue])).toEqual([["Detail", true]]);
    const [{ id } = { id: "" }] = booleans;
    expect(childNamed(variant, "FRAME", "Detail").componentPropertyReferences).toEqual({ visible: id });
    const instance = variant.createInstance();
    const shown = () => instance.children.map((layer) => [layer.name, layer.visible]);
    expect(shown()).toEqual([
      ["Check", true],
      ["Detail", true],
    ]);
    instance.setProperties({ [id]: false });
    expect(shown()).toEqual([
      ["Check", true],
      ["Detail", false],
    ]);
  });

  it("adds the property and links the part on a set that lacks both, and converges", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, kitWith(SHOWN, []), true);
    file.reopen();
    expect((await reconcileKit(file.figma, OPTIONAL, false)).changes).toEqual([
      "Button: add the boolean property Detail",
      "Button / size=md / Detail: visible → the Detail property",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, OPTIONAL, true);
    file.reopen();
    expect(await reconcileKit(file.figma, OPTIONAL, false)).toEqual({ changes: [], warnings: [] });
  });

  it("unlinks a part the spec no longer hides, and converges", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, OPTIONAL, true);
    file.reopen();
    const shown = kitWith(SHOWN, [DETAIL]);
    expect((await reconcileKit(file.figma, shown, false)).changes).toEqual([
      "Button / size=md / Detail: visible → no property",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, shown, true);
    file.reopen();
    expect(await reconcileKit(file.figma, shown, false)).toEqual({ changes: [], warnings: [] });
  });

  it("changes the property's default on a set that starts it otherwise, and converges", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, OPTIONAL, true);
    file.reopen();
    const hidden = withBooleans(OPTIONAL, [{ ...DETAIL, defaultValue: false }]);
    expect((await reconcileKit(file.figma, hidden, false)).changes).toEqual([
      "Button: Detail default → false",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, hidden, true);
    file.reopen();
    expect(await reconcileKit(file.figma, hidden, false)).toEqual({ changes: [], warnings: [] });
  });
});

// Unit under test: `reconcileKit` on a variant whose hidden parts fill, as Alert's actions stretch
// down a described row and Empty's content fills across. Oracle: the fake's rule 42, which follows
// what a real file did on 2026-10-24 (NH): a hidden child reads FIXED on an axis it fills and keeps
// the fill in `layoutGrow` along its parent and `layoutAlign` STRETCH across it. The second Plan lists
// nothing, and the parts show filling once the property is on.
describe("a variant whose hidden parts fill their row", () => {
  const FILL_SIZE = { kind: "fill" } as const;
  const HUG_SIZE = { kind: "hug" } as const;
  const OFF: BooleanPropertySpec = { name: "Detail", defaultValue: false };
  const part = (key: string, name: string, sizing: FrameLayerSpec["sizing"]): FrameLayerSpec => ({
    ...frame(key, name, []),
    sizing,
    visibleProperty: "Detail",
  });
  const HIDDEN = withBooleans(
    kitWithRoot((root) => ({
      ...root,
      sizing: { horizontal: { kind: "fixed", length: literal(300) }, vertical: root.sizing.vertical },
      children: [
        part("button/across", "Across", { horizontal: HUG_SIZE, vertical: FILL_SIZE }),
        part("button/along", "Along", { horizontal: FILL_SIZE, vertical: HUG_SIZE }),
      ],
    })),
    [OFF]
  );

  it("fills across and along while hidden in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, HIDDEN, true);
    file.reopen();
    expect(await reconcileKit(file.figma, HIDDEN, false)).toEqual({ changes: [], warnings: [] });
    const variant = await buttonVariant(file);
    const across = childNamed(variant, "FRAME", "Across");
    const along = childNamed(variant, "FRAME", "Along");
    expect([across.visible, across.layoutAlign, along.layoutGrow]).toEqual([false, "STRETCH", 1]);
    const instance = variant.createInstance();
    const [id = ""] = Object.keys(instance.componentProperties).filter((name) => name.startsWith("Detail#"));
    instance.setProperties({ [id]: true });
    expect([
      childNamed(instance, "FRAME", "Across").layoutSizingVertical,
      childNamed(instance, "FRAME", "Along").layoutSizingHorizontal,
    ]).toEqual(["FILL", "FILL"]);
  });
});

// Unit under test: `reconcileKit` on a variant whose icon turns half a turn, as an open caret does,
// beside a frame that turns too. Oracle: the fake's rule 26, which follows what a real file did on
// 2026-10-22 (PR): auto layout keeps a half-turned layer's box in its slot and moves its `x` and
// `y`, so the plan matches the rotation alone. The second Plan lists nothing.
describe("a variant whose icon turns half a turn", () => {
  const CARET: IconLayerSpec = { ...CHECK, rotation: 180 };
  const TURNED = nestedKit([{ ...frame("button/control", "Control", []), rotation: 180 }, CARET]);

  it("turns the icon and the frame in one Apply, and the next Plan lists nothing", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, TURNED, true);
    file.reopen();
    expect(await reconcileKit(file.figma, TURNED, false)).toEqual({ changes: [], warnings: [] });
    const variant = await buttonVariant(file);
    expect([
      childNamed(variant, "FRAME", "Control").rotation,
      childNamed(variant, "INSTANCE", "Check").rotation,
    ]).toEqual([180, 180]);
  });

  it("plans the one turn on an icon that does not turn, and converges", async () => {
    const { file } = fixture("Roboto");
    await reconcileKit(file.figma, nestedKit([CHECK]), true);
    file.reopen();
    expect((await reconcileKit(file.figma, nestedKit([CARET]), false)).changes).toEqual([
      "Button / size=md / Check: rotation → 180",
      ...RELAYOUT,
    ]);
    await reconcileKit(file.figma, nestedKit([CARET]), true);
    file.reopen();
    expect(await reconcileKit(file.figma, nestedKit([CARET]), false)).toEqual({ changes: [], warnings: [] });
  });

  // A square keeps its box through a quarter turn, which PQ showed auto layout lays out by.
  it("turns a square icon a quarter turn, and converges", async () => {
    const { file } = fixture("Roboto");
    const quarter = nestedKit([{ ...CHECK, rotation: -90 }]);
    await reconcileKit(file.figma, quarter, true);
    file.reopen();
    expect(await reconcileKit(file.figma, quarter, false)).toEqual({ changes: [], warnings: [] });
    expect(childNamed(await buttonVariant(file), "INSTANCE", "Check").rotation).toBe(-90);
  });
});
