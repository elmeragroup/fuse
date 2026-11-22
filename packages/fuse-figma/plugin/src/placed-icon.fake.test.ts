/**
 * An icon placed outside its row's auto layout by its distances to the row's edges, on the in-memory
 * file in `fake-figma.ts`. Unit under test: `planIcon` and `planPlace` through Apply and Plan. Oracle,
 * written by hand from CSS: an icon at `absolute right-[5px]` with both vertical offsets `auto`, in a
 * row that centres its items, sits 5px inside the row's right edge and centred in the row's content
 * box (CSS 2.1 §10.3.7, CSS Flexbox 1 §4.1), here 4px below the row's centre, whatever the row's
 * size. A turn about the icon's centre leaves its box there (CSS Transforms 2 §6). So the 12px Check
 * in a 200 × 24 row has its box at 183, 10, and at 223, 13 once the row is 240 × 30: MAX keeps the
 * end distance and CENTER the centre's offset (fake rules 9, 24, 47, 59). The resize grows each axis
 * by an even length, since the fake refuses a CENTER shift of half a pixel (rule 59). On the file the
 * plugin applied the whole kit to, Accordion item's `infodropdown` caret, `absolute right-0` in a
 * trigger with no padding or border, sits once in each `infodropdown` variant and preview instance the
 * kit lists, at the trigger's right edge with its centre on the trigger's centre, turned a half turn
 * where the item is open and unturned where it is closed, and as the trigger's last child, which
 * Figma paints over the label as CSS paints the positioned caret over the trigger's flow.
 */
import { describe, expect, it } from "vitest";

import { previewInstanceKey } from "../../src/components/kit-spec.ts";
import type { ChildLayerSpec, IconLayerSpec } from "../../src/components/kit-spec.ts";
import { buttonVariant, CHECK, frame, LABEL, literal, nestedKit } from "./button-kit-fixture.ts";
import { aliasOf, childNamed, color, fixtureFile, string } from "./fake-fixtures.ts";
import { keyOf } from "./identity.ts";
import { appliedFile, kitFixture, kitPage } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

/** The Check at 5px from the row's right edge, its centre 4px below the row's centre. */
const PLACED: IconLayerSpec = {
  ...CHECK,
  placement: {
    kind: "edges",
    within: "parent",
    horizontal: { kind: "end", end: 5 },
    vertical: { kind: "centre", offset: 4 },
  },
};

/** A 200 × 24 row holding the label in its flow and the icon outside it. */
function row(icon: IconLayerSpec): readonly ChildLayerSpec[] {
  return [
    {
      ...frame("button/row", "Row", [LABEL, icon]),
      sizing: {
        horizontal: { kind: "fixed", length: literal(200) },
        vertical: { kind: "fixed", length: literal(24) },
      },
    },
  ];
}

/** A synced file the Button fixture's label binds. */
function syncedFile() {
  return fixtureFile([
    color("Fuse tokens", "background", { r: 1, g: 1, b: 1, a: 1 }),
    aliasOf("Fuse tokens", "font-sans", "STRING", { collection: "Fuse brand", variable: "font-sans" }),
    string("Fuse brand", "font-sans", "Roboto"),
  ]);
}

/** The row and its icon, after the file reopens. */
async function rowOf(file: ReturnType<typeof syncedFile>) {
  file.reopen();
  const frameNode = childNamed(await buttonVariant(file), "FRAME", "Row");
  return { frame: frameNode, icon: childNamed(frameNode, "INSTANCE", "Check") };
}

/** The icon's box against the row's: its left and top edges and its size, as the turned box bounds it. */
function boxIn(frameNode: SceneNode, icon: SceneNode) {
  const outer = frameNode.absoluteBoundingBox;
  const inner = icon.absoluteBoundingBox;
  if (outer === null || inner === null) {
    throw new Error("the row or its icon has no box");
  }
  return [inner.x - outer.x, inner.y - outer.y, inner.width, inner.height];
}

describe.each([
  ["unturned", PLACED],
  ["turned a half turn", { ...PLACED, rotation: 180 }],
])("an icon at its row's end, centred down, %s", (_case, icon) => {
  const kit = nestedKit(row(icon));

  it("sits absolute at its distances, MAX across and CENTER down, the next Plan lists nothing, and it keeps them as the row resizes", async () => {
    const file = syncedFile();
    await reconcileKit(file.figma, kit, true);
    const { frame: frameNode, icon: node } = await rowOf(file);
    expect([node.layoutPositioning, node.constraints, boxIn(frameNode, node)]).toEqual([
      "ABSOLUTE",
      { horizontal: "MAX", vertical: "CENTER" },
      [183, 10, 12, 12],
    ]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
    frameNode.resize(240, 30);
    expect(boxIn(frameNode, node)).toEqual([223, 13, 12, 12]);
  });

  it("goes back to its place when a designer moves it", async () => {
    const file = syncedFile();
    await reconcileKit(file.figma, kit, true);
    const { icon: node } = await rowOf(file);
    node.x = 0;
    node.y = 0;
    file.reopen();
    expect((await reconcileKit(file.figma, kit, false)).changes).toContain(
      "Button / size=md / Row / Check: place → 5px from the right, its centre 4px from the centre"
    );
    await reconcileKit(file.figma, kit, true);
    const after = await rowOf(file);
    expect(boxIn(after.frame, after.icon)).toEqual([183, 10, 12, 12]);
    expect((await reconcileKit(file.figma, kit, false)).changes).toEqual([]);
  });
});

/** Every layer at or below a node, depth first. */
function layersOf(node: BaseNode): readonly BaseNode[] {
  return [node, ...("children" in node ? node.children.flatMap(layersOf) : [])];
}

/** Whether a variant key names an open `infodropdown` item, or undefined for another variant. */
function dropdownOpen(variant: string): boolean | undefined {
  const match = /variant=infodropdown,radius=\w+,open=(true|false),/.exec(variant);
  return match === null ? undefined : match[1] === "true";
}

/** Each variant and preview instance of an `infodropdown` item the kit draws, by key, and whether it is open. */
async function expectedItems(): Promise<ReadonlyMap<string, boolean>> {
  const { kit } = await kitFixture();
  const set = kit.componentSets.find((each) => each.key === "accordion-item");
  const variants = (set?.variants ?? []).flatMap(({ key }) => {
    const open = dropdownOpen(key);
    return open === undefined ? [] : [[key, open] as const];
  });
  const previews = kit.previews.flatMap((preview) =>
    preview.groups.flatMap((group) =>
      group.componentSet !== "accordion-item"
        ? []
        : group.instances.flatMap((instance) => {
            const open = dropdownOpen(instance.variant);
            return open === undefined ? [] : [[previewInstanceKey(preview.key, instance), open] as const];
          })
    )
  );
  return new Map([...variants, ...previews]);
}

describe("Accordion item's infodropdown caret", () => {
  it("sits once in its item's trigger, last, at the trigger's right edge, centred down, turned as the item is open, in every variant and preview", async () => {
    const expected = await expectedItems();
    const file = await appliedFile();
    const page = await kitPage(file, "page/accordion");
    const byKey = new Map(page.children.flatMap(layersOf).map((node) => [keyOf(node), node]));
    const drawn = [...expected.keys()].map((key) => {
      const item = byKey.get(key);
      const within = item === undefined ? [] : layersOf(item);
      const carets = within.filter((node) => keyOf(node) === "caret");
      // The item's own trigger, by its key, must hold the caret as its child.
      const trigger = within.find((node) => keyOf(node) === "trigger");
      const owned =
        trigger !== undefined && "children" in trigger
          ? trigger.children.filter((node) => keyOf(node) === "caret")
          : [];
      const [caret] = owned;
      const lastChild = trigger !== undefined && "children" in trigger ? trigger.children.at(-1) : undefined;
      if (caret?.type !== "INSTANCE" || trigger === undefined || !("width" in trigger)) {
        return { key, carets: carets.length, owned: owned.length };
      }
      const [x = 0, y = 0, width = 0, height = 0] = boxIn(trigger, caret);
      return {
        key,
        carets: carets.length,
        owned: owned.length,
        last: lastChild === caret,
        rotation: caret.rotation,
        right: trigger.width - x - width,
        centre: y + height / 2 - trigger.height / 2,
        placed: caret.layoutPositioning,
      };
    });
    // 24 variants, and each preview instance of one.
    expect(expected.size).toBeGreaterThan(24);
    expect(drawn).toEqual(
      [...expected].map(([key, open]) => ({
        key,
        carets: 1,
        owned: 1,
        last: true,
        rotation: open ? 180 : 0,
        right: 0,
        centre: 0,
        placed: "ABSOLUTE",
      }))
    );
  });
});
