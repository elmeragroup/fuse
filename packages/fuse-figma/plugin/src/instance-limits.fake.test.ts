/**
 * The writes Apply makes on an instance layer's height limits, with the Outer kit of
 * `button-kit-fixture.ts` on the in-memory file in `fake-figma.ts`. Unit under test: `reconcileKit`.
 * Oracles: Figma clamps a fixed length to the limits the layer holds when the length is written
 * (README, `limits`), so an order that keeps the written length inside the limits current at each
 * write never resizes against an old limit. On 2026-11-21 an equal null written on a fresh
 * instance's `minHeight` left no override, and the instance followed its main's next value, 30
 * (MH, `jA`).
 */
import { describe, expect, it } from "vitest";

import type { InstanceLayerSpec, KitSpec, LimitsSpec, NumberSpec } from "../../src/components/kit-spec.ts";
import { fixture, LABEL, literal, outerKit } from "./button-kit-fixture.ts";
import type { FakeFigma } from "./fake-figma.ts";
import { float } from "./fake-fixtures.ts";
import { reconcileKit } from "./reconcile.ts";

/** The height limits a test gives Button's root. */
type HeightLimits = Partial<Pick<LimitsSpec, "minHeight" | "maxHeight">>;

/** The width limits the instance carries, and the height it fixes. */
type CarriedInstance = Partial<Pick<InstanceLayerSpec, "minWidth" | "maxWidth">> & {
  readonly height?: number;
};

/**
 * The Outer kit with Button's root hugging its height within `limits`, and the instance carrying
 * the given width limits and fixing the given height.
 */
function heightKit(limits: HeightLimits, { height, ...carried }: CarriedInstance): KitSpec {
  const base = outerKit(LABEL);
  const [button, outer] = base.componentSets;
  if (button === undefined || outer === undefined) {
    throw new Error("the Outer kit holds no Button and Outer sets");
  }
  return {
    ...base,
    componentSets: [
      {
        ...button,
        variants: button.variants.map((variant) => ({
          ...variant,
          root: {
            ...variant.root,
            sizing: { ...variant.root.sizing, vertical: { kind: "hug" } },
            limits: { ...variant.root.limits, ...limits },
          },
        })),
      },
      {
        ...outer,
        variants: outer.variants.map((variant) => ({
          ...variant,
          root: {
            ...variant.root,
            children: variant.root.children.map((layer) =>
              layer.kind === "instance"
                ? {
                    ...layer,
                    ...carried,
                    sizing:
                      height === undefined
                        ? layer.sizing
                        : { ...layer.sizing, vertical: { kind: "fixed", length: literal(height) } },
                  }
                : layer
            ),
          },
        })),
      },
    ],
  };
}

/** The Outer instance on the kit page. */
async function outerInstance(file: FakeFigma): Promise<InstanceNode> {
  const page = file.figma.root.children.find((node) => node.name === "Fuse components");
  await page?.loadAsync();
  const find = (node: BaseNode): InstanceNode | undefined => {
    if (node.type === "INSTANCE" && node.name === "Inner") {
      return node;
    }
    return "children" in node ? node.children.map(find).find((found) => found !== undefined) : undefined;
  };
  const instance = page === undefined ? undefined : find(page);
  if (instance === undefined) {
    throw new Error("the kit page holds no Inner instance");
  }
  return instance;
}

/** Apply `from`, then `to`, and the writes the second Apply made on the instance. */
async function instanceWrites(file: FakeFigma, from: KitSpec, to: KitSpec): Promise<readonly string[]> {
  await reconcileKit(file.figma, from, true);
  file.reopen();
  const instance = await outerInstance(file);
  const start = file.writes.length;
  await reconcileKit(file.figma, to, true);
  return file.writes.slice(start).flatMap((line) => {
    const [id, ...what] = line.split(" ");
    return id === instance.id ? [what.join(" ")] : [];
  });
}

describe("a fixed instance height whose held limit changes with it", () => {
  // A literal width limit lists and holds the paired height limit (PH3, SW, MH), so the plan writes
  // the main's on the instance.
  const minimum = { minWidth: literal(120) };
  const maximum = { maxWidth: literal(224) };
  it.each<
    readonly [
      string,
      CarriedInstance,
      readonly [HeightLimits, number],
      readonly [HeightLimits, number],
      readonly string[],
    ]
  >([
    [
      "lowers the minimum before the resize where both decrease",
      minimum,
      [{ minHeight: literal(40) }, 48],
      [{ minHeight: literal(30) }, 32],
      ["minHeight", "resize"],
    ],
    [
      "resizes before it raises the minimum where both increase",
      minimum,
      [{ minHeight: literal(40) }, 48],
      [{ minHeight: literal(56) }, 64],
      ["resize", "minHeight"],
    ],
    [
      "raises the maximum before the resize where both increase",
      maximum,
      [{ maxHeight: literal(48) }, 40],
      [{ maxHeight: literal(64) }, 56],
      ["maxHeight", "resize"],
    ],
  ])("%s", async (_case, carried, [fromLimits, fromHeight], [toLimits, toHeight], expected) => {
    const { file } = fixture("Roboto");
    const writes = await instanceWrites(
      file,
      heightKit(fromLimits, { ...carried, height: fromHeight }),
      heightKit(toLimits, { ...carried, height: toHeight })
    );
    expect(
      writes.filter((what) => what === "minHeight" || what === "maxHeight" || what === "resize")
    ).toEqual(expected);
  });
});

describe("an equal null written on a fresh instance's minHeight", () => {
  it("leaves the instance following its main's minimum, so Apply writes nothing on it", async () => {
    const minWidth: NumberSpec = { kind: "variable", variable: { collection: "Fuse tokens", name: "w120" } };
    const { file } = fixture("Roboto", true, [float("Fuse tokens", "w120", 120)]);
    await reconcileKit(file.figma, heightKit({}, { minWidth }), true);
    file.reopen();
    const instance = await outerInstance(file);
    instance.minHeight = null;
    const start = file.writes.length;
    await reconcileKit(file.figma, heightKit({ minHeight: literal(30) }, { minWidth }), true);
    const writes = file.writes.slice(start).filter((line) => line.startsWith(`${instance.id} `));
    expect([writes, instance.minHeight]).toEqual([[], 30]);
  });
});
