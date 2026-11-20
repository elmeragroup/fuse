/**
 * How the build sizes the height of a root that sets none, where flex rows around it stretch it. The
 * unit under test is `buildComponentSet` on hand-built captures of one-cell `chip` sets
 * (`test/capture-fixtures.ts`), whose sample host is a 320px row, as the manifest's preview height
 * names it.
 *
 * Oracle: CSS Flexbox 1 §9.4 steps 11 and 15. A flex row on one line whose height is definite has a
 * line as tall as its content box, and a child that sets no height, no `align-self` but `stretch`
 * and no vertical margin stretches to that line. A row that sets no height is itself stretched the
 * same way by the row around it. Chromium draws List detail's pane, an `<aside>` of `auto` height in
 * the List detail root, a flex row in the docs demo's `h-80` row, 320px tall. Where any row wraps,
 * aligns its items, pads its content or sets a height, or the root sets a vertical margin, the root's
 * height is something else, and where the capture did not measure the host as tall as its length in
 * every mode (`basisAsDeclared`), the build does not know the host's own container. Each of those
 * leaves the root hugging its height.
 */
import { describe, expect, it } from "vitest";

import { buildCaptured, chip, fixed, HUG, literal } from "../../test/capture-fixtures";
import type { MeasuredFacts } from "../capture/capture-format";

/** Build a chip whose root sits in a wrapper row in the host row, each winning the given classes. */
function build(spec: { host?: string; wrapper?: string; root?: string; measured?: MeasuredFacts }) {
  const { host = "flex", wrapper = "flex flex-1", root = "flex flex-col w-[352px]" } = spec;
  return buildCaptured(chip({ previewHeight: { pixels: 320 } }), [
    {
      cell: { state: "rest" },
      around: [
        { slot: "host", classes: host },
        { slot: "wrapper", classes: wrapper },
      ],
      root: { slot: "chip", classes: root, measured: spec.measured ?? { basisAsDeclared: true } },
    },
  ]);
}

describe("a root of auto height in flex rows that stretch it", () => {
  it("is as tall as the host where every row stretches it and the capture measured the host", async () => {
    const { variant } = await build({});
    expect(variant?.root.sizing.vertical).toEqual(fixed(literal(320)));
  });

  it.each([
    ["without the measurement", { measured: {} }],
    ["in a wrapper that aligns its items", { wrapper: "flex flex-1 items-start" }],
    ["in a wrapper that wraps", { wrapper: "flex flex-1 flex-wrap" }],
    ["in a wrapper that pads its content", { wrapper: "flex flex-1 py-[8px]" }],
    ["in a wrapper that sets a height", { wrapper: "flex flex-1 h-[200px]" }],
    ["in a host that sets a height of its own", { host: "flex h-[200px]" }],
    ["in a wrapper that is a column", { wrapper: "flex flex-1 flex-col" }],
    ["with a vertical margin", { root: "flex flex-col w-[352px] my-[8px]" }],
    ["that aligns itself", { root: "flex flex-col w-[352px] self-start" }],
    ["in a block host", { host: "block" }],
  ])("hugs its height %s", async (_, spec) => {
    const { variant } = await build(spec);
    expect(variant?.root.sizing.vertical).toEqual(HUG);
  });
});
