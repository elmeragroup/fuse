/**
 * Unit under test: whether `readFlow` stacks a block container's layers as blocks, and whether
 * `isPlainBlock` takes a list item as a block box, through the cascade's computed style. Oracle:
 * Chromium's layout and computed style for the same declarations, read on 2026-11-17: a 10px
 * `inline-flex` box in a `line-height: 40px` block that shrinks to fit it leaves the block 40px tall
 * (CSS 2.1 §10.8), while a Pagination item in a 24px line is exactly as tall as its 36px link, and `list-style: inherit` takes the list's `list-style-image` and
 * `list-style-position` as well as its `list-style-type` (CSS Cascade 4 §7.3), so the item draws the
 * list's image marker.
 */
import { Effect } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { isPlainBlock, readFlow } from "./box-flow.ts";
import type { BuildContext } from "./component-spec.ts";
import { makeVariableIndex } from "./css-values.ts";
import { NO_LIMITS } from "./kit-spec.ts";
import { CellLedger, LayerStyle, inheritance } from "./layer-style.ts";
import type { Layer } from "./layer-style.ts";
import { compileUtilities } from "./utility-css.ts";

let context: BuildContext;

beforeAll(async () => {
  context = {
    compiled: await Effect.runPromise(compileUtilities([])),
    variables: makeVariableIndex([]),
  };
});

const ORIGIN = { record: () => undefined };

/** A fresh cell's ledger. */
function ledger(): CellLedger {
  return new CellLedger({
    context,
    origin: ORIGIN,
    record: () => undefined,
    cell: {},
    inPlace: undefined,
  });
}

/** A box with the declarations, below the parent where there is one. */
function box(cell: CellLedger, declarations: Readonly<Record<string, string>>, parent?: Layer) {
  const layer = cell.add(
    parent === undefined ? new Map() : inheritance(parent, context),
    [
      {
        part: "box",
        className: "sample",
        origin: ORIGIN,
        rank: 0,
        at: undefined,
        order: 0,
        declarations: Object.entries(declarations).map(([property, value]) => ({ property, value })),
      },
    ],
    parent
  );
  return { layer, style: new LayerStyle(cell, layer, []) };
}

/**
 * Whether a hugging block stacks its one `inline-flex` child as a block, at the block's line height
 * and the child's height, where the capture measured the line box adding nothing to it or not.
 */
function stacksInlineChild(sample: {
  readonly line: string;
  readonly height: string;
  readonly lineFits: boolean;
}): boolean {
  const { line, height, lineFits } = sample;
  const cell = ledger();
  const parent = box(cell, { display: "block", "line-height": line, "font-size": "16px" });
  const child = box(cell, { display: "inline-flex", width: "20px", height }, parent.layer);
  const { layout } = readFlow(
    parent.style,
    {
      parts: [{ key: "child", name: "child", style: child.style, sizing: [] }],
      others: [],
      last: child.style,
      labelBeforeLast: false,
    },
    {
      sizing: { horizontal: { kind: "hug" }, vertical: { kind: "hug" } },
      limits: NO_LIMITS,
      inside: [],
      markers: "resolved",
      lineFits,
    }
  );
  return layout.blocks;
}

describe("an inline-level child alone in a hugging block", () => {
  it("does not stack a 10px child in a 40px line, which the line box makes 40px tall", () => {
    expect(stacksInlineChild({ line: "40px", height: "10px", lineFits: false })).toBe(false);
  });

  it("stacks a 36px Pagination link in a 24px line, where the capture measured the item as tall", () => {
    expect(stacksInlineChild({ line: "24px", height: "36px", lineFits: true })).toBe(true);
  });
});

describe("a list item under `list-style: inherit`", () => {
  const IMAGE = 'url("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7")';

  it("takes the list's type, image and position, and is no plain block, since it draws the image", () => {
    const cell = ledger();
    const list = box(cell, {
      "list-style-type": "none",
      "list-style-image": IMAGE,
      "list-style-position": "inside",
    });
    const item = box(cell, { display: "list-item", "list-style": "inherit" }, list.layer);
    expect(
      ["list-style-type", "list-style-image", "list-style-position"].map((property) =>
        item.style.resolved(property)
      )
    ).toEqual(["none", IMAGE, "inside"]);
    expect(isPlainBlock(item.style, "resolved")).toBe(false);
  });

  it("is a plain block where the list's type and image are both none and its marker sets no content", () => {
    const cell = ledger();
    const list = box(cell, { "list-style": "none" });
    const item = box(cell, { display: "list-item", "list-style": "inherit" }, list.layer);
    expect([isPlainBlock(item.style, "resolved"), isPlainBlock(item.style, "content")]).toEqual([
      true,
      false,
    ]);
  });
});
