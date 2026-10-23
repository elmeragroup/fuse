import { describe, expect, it } from "vitest";

import * as Accept from "./accept";
import { dragVerdict } from "./drag-verdict";
import type { DragVerdict } from "./drag-verdict";

/** A `DataTransferItem` as a drag exposes it: a kind and a type, never a name. */
type Item = { readonly kind: string; readonly type: string };

const png: Item = { kind: "file", type: "image/png" };
const pdf: Item = { kind: "file", type: "application/pdf" };
const untyped: Item = { kind: "file", type: "" };
const text: Item = { kind: "string", type: "text/plain" };

type Row = readonly [
  items: readonly Item[],
  accept: string | undefined,
  multiple: boolean,
  verdict: DragVerdict,
];

// Each row is one case of the rule in `dragVerdict`'s JSDoc.
const rows = {
  "no file items, as Safari lists them, is unknown": [[], "image/*", true, "unknown"],
  "only string items is unknown": [[text], "image/*", true, "unknown"],
  "two files on a single-file Root are rejected": [[png, png], "image/*", false, "reject"],
  "a PNG and a text file on a single-file image Root leave one certain survivor": [
    [png, { kind: "file", type: "text/plain" }],
    "image/*",
    false,
    "accept",
  ],
  "two untyped items on a single-file Root defer to the drop, since either may be a folder": [
    [untyped, untyped],
    undefined,
    false,
    "accept",
  ],
  "two typed files that pass any accept are certain survivors on a single-file Root": [
    [png, pdf],
    undefined,
    false,
    "reject",
  ],
  "two files on a multiple Root are accepted": [[png, png], "image/*", true, "accept"],
  "known types that all miss accept are rejected": [[pdf, pdf], "image/*", true, "reject"],
  "an extension token keeps a missing type from rejecting": [[pdf], "image/*, .png", true, "accept"],
  "an extension token alone never rejects": [[pdf], ".png", false, "accept"],
  "an extension token with no file items stays unknown": [[], ".png", false, "unknown"],
  "an empty type keeps the drag from rejecting": [[pdf, untyped], "image/*", true, "accept"],
  "one matching item is enough to accept": [[pdf, png], "image/*", true, "accept"],
  "an exact MIME match accepts": [[pdf], "application/pdf", false, "accept"],
  "no accept accepts any file": [[pdf], undefined, false, "accept"],
} satisfies Readonly<Record<string, Row>>;

describe("dragVerdict", () => {
  it.each(Object.entries(rows))("%s", (_name, [items, accept, multiple, verdict]) => {
    expect(dragVerdict(items, { accept: Accept.parse(accept), multiple })).toBe(verdict);
  });
});
