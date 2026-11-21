/**
 * Unit under test: the widths of the Dialog content and Alert dialog content variants, as the build
 * produces them from the captures. Oracle: Fuse's `overlaySizeVariants`, which sets each size's
 * `--overlay-width` to `min(<container>, 90%)`, and Tailwind's `--container-sm`, `--container-md`,
 * `--container-lg` and `--container-xl`, 24rem, 28rem, 32rem and 36rem, at the 16px root. In the sets'
 * 640px viewport, 90% is 576px, so the four sizes draw 384, 448, 512 and 576px wide. The widths are
 * literals, which no other check of the build holds to the browser, and a renderer that stopped
 * passing `size` would capture every cell at 448px.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { builtKit } from "../../test/built-kit";
import type { BuiltSets } from "../../test/built-kit";

/** Each size's width in the 640px viewport, written from the oracle above. */
const WIDTHS = { sm: 384, md: 448, lg: 512, xl: 576 } as const;

let built: BuiltSets;

beforeAll(async () => {
  built = await builtKit();
});

describe.each(["dialog-content", "alert-dialog-content"])("the set %s", (key) => {
  it("draws each size at its `--overlay-width`", () => {
    const set = built.spec.componentSets.find((candidate) => candidate.key === key);
    const widths = new Map<string, Set<number | string>>();
    for (const variant of set?.variants ?? []) {
      const sizing = variant.root.sizing.horizontal;
      const width =
        sizing.kind === "fixed" && sizing.length.kind === "literal" ? sizing.length.value : sizing.kind;
      const size = variant.properties.size ?? "none";
      widths.set(size, new Set([...(widths.get(size) ?? []), width]));
    }
    expect(Object.fromEntries([...widths].map(([size, each]) => [size, [...each]]))).toEqual(
      Object.fromEntries(Object.entries(WIDTHS).map(([size, width]) => [size, [width]]))
    );
  });
});
