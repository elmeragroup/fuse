/**
 * `reconcileKit` end to end on a file the plugin laid out before Select trigger gained its `width`
 * axis, against the in-memory file in `fake-figma.ts`. The oracle is W5-P2, a real-file probe: a
 * variant renamed in place to name an added axis keeps its id, a designer's instance of it keeps it as
 * its main and reads the new axis at its first value, and `setProperties` on the new axis swaps the
 * instance to the added variant.
 */
import { beforeAll, describe, expect, it } from "vitest";

import type { ChildLayerSpec, ComponentSetSpec, KitSpec } from "../../src/components/kit-spec.ts";
import type { CollectionSpec } from "../../src/variable-set.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { keyOf } from "./identity.ts";
import { kitFixture, kitPage, setOn, syncedFile } from "./kit-fixture.ts";
import { reconcileKit } from "./reconcile.ts";

let kit: KitSpec;
const current = () => kit;
let collections: readonly CollectionSpec[];

beforeAll(async () => {
  ({ kit, collections } = await kitFixture());
}, 60_000);

/** The Select trigger's key, and the set that shows its filling variants. */
const TRIGGER = "select-trigger";
const FIELD = "select-field";

/**
 * The kit as the plugin wrote it before the width axis: Select trigger's 32 hugging cells without
 * the axis, under the keys they held then, such as `select-trigger/size=sm,…`, wherever the kit
 * names them, and no Select field, which shows the filling trigger.
 */
function beforeWidthKit(): KitSpec {
  const kit = oldKeys(current());
  const before = (set: ComponentSetSpec): ComponentSetSpec => ({
    ...set,
    axes: set.axes.filter((axis) => axis.name !== "width"),
    variants: set.variants
      .filter((variant) => variant.properties.width === "hug")
      .map((variant) => {
        const { width: _width, ...properties } = variant.properties;
        return { ...variant, properties };
      }),
  });
  const kept = new Set(before(setIn(kit, TRIGGER)).variants.map((variant) => variant.key));
  return {
    ...kit,
    componentSets: kit.componentSets
      .filter((set) => set.key !== FIELD)
      .map((set) => (set.key === TRIGGER ? before(set) : set)),
    previews: kit.previews.map((preview) => ({
      ...preview,
      groups: preview.groups
        .filter((group) => group.componentSet !== FIELD)
        .map((group) =>
          group.componentSet === TRIGGER
            ? { ...group, variants: group.variants.filter((key) => kept.has(key)) }
            : group
        ),
    })),
  };
}

/** A key as the old set held it: `select-trigger/width=hug,…` without the hugging width. */
function oldKey(key: string): string {
  return key.replace(`${TRIGGER}/width=hug,`, `${TRIGGER}/`);
}

/** A layer, and each layer below it, with each instance of a hugging trigger under its old key. */
function oldLayer(layer: ChildLayerSpec): ChildLayerSpec {
  if (layer.kind === "instance") {
    return { ...layer, variant: oldKey(layer.variant) };
  }
  return layer.kind === "frame" ? { ...layer, children: layer.children.map(oldLayer) } : layer;
}

/** The kit with each hugging trigger's key written as the key it replaced, wherever the kit names it. */
function oldKeys(spec: KitSpec): KitSpec {
  return {
    ...spec,
    componentSets: spec.componentSets.map((set) => ({
      ...set,
      variants: set.variants.map((variant) => ({
        ...variant,
        key: oldKey(variant.key),
        root: { ...variant.root, children: variant.root.children.map(oldLayer) },
      })),
    })),
    previews: spec.previews.map((preview) => ({
      ...preview,
      groups: preview.groups.map((group) => ({ ...group, variants: group.variants.map(oldKey) })),
    })),
  };
}

function setIn(spec: KitSpec, key: string): ComponentSetSpec {
  const set = spec.componentSets.find((candidate) => candidate.key === key);
  if (set === undefined) {
    throw new Error(`the kit has no set ${key}`);
  }
  return set;
}

/** Each variant's id, by its key. */
function idsByKey(set: ComponentSetNode): ReadonlyMap<string, string> {
  return new Map(set.children.map((variant) => [keyOf(variant), variant.id]));
}

async function changes(file: FakeFigma): Promise<readonly string[]> {
  return (await reconcileKit(file.figma, kit, false)).changes;
}

describe("a file with Select trigger from before its width axis", () => {
  it("renames the 32 variants in place, keeps a designer's instance linked and creates the 32 filling ones", async () => {
    const file = syncedFile(collections);
    await reconcileKit(file.figma, beforeWidthKit(), true);
    file.reopen();
    const old = setOn(await kitPage(file, "page/select"), "Select trigger");
    const before = idsByKey(old);
    const shown = "select-trigger/size=default,state=rest,content=value,open=off";
    const main = old.children.find((variant) => keyOf(variant) === shown);
    if (main?.type !== "COMPONENT") {
      throw new Error(`the old set has no variant ${shown}`);
    }
    const [designerPage] = file.figma.root.children;
    await designerPage?.loadAsync();
    const instance = main.createInstance();
    designerPage?.appendChild(instance);

    const planned = await changes(file);
    const renames = planned.filter(
      (line) => line.startsWith("Select trigger / ") && line.includes(": name → ")
    );
    const created = planned.filter((line) => line.startsWith("Select trigger: create the variant "));
    expect([renames.length, created.length]).toEqual([32, 32]);
    expect(renames).toContain(
      // A change line names a variant by the name the kit gives it, as for any renamed variant.
      "Select trigger / width=hug, size=default, state=rest, content=value, open=off: name → width=hug, size=default, state=rest, content=value, open=off"
    );
    expect(created.every((line) => line.includes("width=fill"))).toBe(true);

    await reconcileKit(file.figma, kit, true);
    file.reopen();
    const after = setOn(await kitPage(file, "page/select"), "Select trigger");
    const ids = idsByKey(after);
    expect([...before].filter(([key, id]) => ids.get(key) !== id)).toEqual([]);
    expect(after.children).toHaveLength(64);
    const values = () =>
      Object.fromEntries(
        Object.entries(instance.componentProperties).flatMap(([name, property]) =>
          property.type === "VARIANT" ? [[name, property.value]] : []
        )
      );
    expect([(await instance.getMainComponentAsync())?.id, values()]).toEqual([
      main.id,
      { width: "hug", size: "default", state: "rest", content: "value", open: "off" },
    ]);
    expect(await changes(file)).toEqual([]);

    // The designer picks the filling width on the instance, which swaps it to the added variant.
    instance.setProperties({ width: "fill" });
    expect(keyOf((await instance.getMainComponentAsync()) ?? instance)).toBe(
      "select-trigger/width=fill,size=default,state=rest,content=value,open=off"
    );
  });
});
