/**
 * The first row's Button of List detail's `content=empty` variant, which the suites that override an
 * instance's fields on an applied file change: the kit with that one instance edited, and the
 * instance on a freshly applied file. Each row holds a Button, so an edit reaches the first row's
 * alone, and the other rows keep the kit's.
 */
import type { ChildLayerSpec, InstanceLayerSpec, KitSpec } from "../../src/components/kit-spec.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { childNamed } from "./fake-fixtures.ts";
import { appliedFile, kitPage, setOn } from "./kit-fixture.ts";

/** `layers` with the layer at `key` changed by `edit`. */
function onKey(
  layers: readonly ChildLayerSpec[],
  key: string,
  edit: (layer: ChildLayerSpec) => ChildLayerSpec
): readonly ChildLayerSpec[] {
  return layers.map((layer) => (layer.key === key ? edit(layer) : layer));
}

/**
 * The kit with the first row's Button of `List detail`'s `content=empty` variant changed by `edit`.
 *
 * @param kit - The kit.
 * @param edit - The change to the Button instance.
 * @returns The kit, every other layer as it was.
 */
export function onFirstRowButton(
  kit: KitSpec,
  edit: (button: InstanceLayerSpec) => InstanceLayerSpec
): KitSpec {
  const onButton = (row: ChildLayerSpec): ChildLayerSpec =>
    row.kind !== "frame"
      ? row
      : {
          ...row,
          children: onKey(row.children, "button", (layer) =>
            layer.kind === "instance" ? edit(layer) : layer
          ),
        };
  const onList = (list: ChildLayerSpec): ChildLayerSpec =>
    list.kind !== "frame" ? list : { ...list, children: onKey(list.children, "row-1", onButton) };
  return {
    ...kit,
    componentSets: kit.componentSets.map((set) =>
      set.name !== "List detail"
        ? set
        : {
            ...set,
            variants: set.variants.map((variant) =>
              variant.properties.content !== "empty"
                ? variant
                : {
                    ...variant,
                    root: { ...variant.root, children: onKey(variant.root.children, "list", onList) },
                  }
            ),
          }
    ),
  };
}

/**
 * The first row's Button in the `List detail` set's `content=empty` variant of a freshly applied file.
 *
 * @returns The file and the instance.
 */
export async function firstRow(): Promise<{ readonly file: FakeFigma; readonly button: InstanceNode }> {
  const file = await appliedFile();
  const set = setOn(await kitPage(file, "page/list-detail"), "List detail");
  const list = childNamed(childNamed(set, "COMPONENT", "content=empty"), "FRAME", "list-detail-list");
  return { file, button: childNamed(childNamed(list, "FRAME", "row-1"), "INSTANCE", "button") };
}
