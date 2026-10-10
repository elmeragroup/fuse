import { describe, expect, it } from "vitest";

import type { ThemeInput } from "@elmeragroup/fuse/theme";

import { STUDIO_METRICS, metricStyle } from "../../src/studio/lib/density-metrics";
import {
  NO_OVERRIDES,
  editHistory,
  guardedHistory,
  metricOverridesFor,
  reduceEdits,
  reduceGuarded,
} from "../../src/studio/lib/edits";
import type { EditAction, EditHistory, StudioDocument } from "../../src/studio/lib/edits";
import { decodeShare, encodeShare } from "../../src/studio/lib/share-codec";
import { documentCycles } from "../../src/studio/lib/token-values";

const ELMA = { variant: "external", brand: "elma", segment: "private" } as const satisfies ThemeInput;

const EMPTY: StudioDocument = { theme: ELMA, overrides: NO_OVERRIDES };

function run(...actions: EditAction[]): EditHistory {
  return actions.reduce(reduceEdits, editHistory(EMPTY));
}

/** Share text for a JSON payload, encoded the way the codec's version 1 is documented. */
function shareText(payload: { readonly t: string; readonly m?: object }): string {
  return `1.${btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "")}`;
}

describe("set-metric", () => {
  it("files a metric edit under the density it was made in, leaving the other density alone", () => {
    const { present } = run({ type: "set-metric", density: "comfortable", name: "control-h-md", px: 56 });
    expect(present.overrides.density).toEqual({ comfortable: { "control-h-md": 56 } });
    expect(metricOverridesFor(present.overrides, "comfortable")).toEqual({ "control-h-md": 56 });
    expect(metricOverridesFor(present.overrides, "dense")).toEqual({});
  });

  it("keeps the same metric's dense and comfortable edits apart", () => {
    const { present } = run(
      { type: "set-metric", density: "dense", name: "row-h", px: 28 },
      { type: "set-metric", density: "comfortable", name: "row-h", px: 40 }
    );
    expect(metricOverridesFor(present.overrides, "dense")).toEqual({ "row-h": 28 });
    expect(metricOverridesFor(present.overrides, "comfortable")).toEqual({ "row-h": 40 });
  });

  it("leaves token edits untouched", () => {
    const { present } = run(
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      { type: "set-metric", density: "dense", name: "row-h", px: 28 }
    );
    expect(present.overrides.light).toEqual({ primary: "#ff0000" });
  });

  it("adds no undo step for a value already in effect", () => {
    const once = run({ type: "set-metric", density: "dense", name: "row-h", px: 28 });
    expect(reduceEdits(once, { type: "set-metric", density: "dense", name: "row-h", px: 28 })).toBe(once);
  });
});

describe("metric undo", () => {
  it("undoes and redoes a metric edit", () => {
    const set = run({ type: "set-metric", density: "comfortable", name: "control-h-md", px: 56 });
    const undone = reduceEdits(set, { type: "undo" });
    expect(metricOverridesFor(undone.present.overrides, "comfortable")).toEqual({});
    const redone = reduceEdits(undone, { type: "redo" });
    expect(metricOverridesFor(redone.present.overrides, "comfortable")).toEqual({ "control-h-md": 56 });
  });

  it("makes one slider drag one undo step", () => {
    const dragged = run(
      { type: "set-metric", density: "dense", name: "row-h", px: 30, coalesce: "drag-1" },
      { type: "set-metric", density: "dense", name: "row-h", px: 34, coalesce: "drag-1" },
      { type: "set-metric", density: "dense", name: "row-h", px: 38, coalesce: "drag-1" }
    );
    expect(dragged.past).toHaveLength(1);
    expect(reduceEdits(dragged, { type: "undo" }).present).toEqual(EMPTY);
  });
});

describe("reset-metric", () => {
  it("resets one density's edit and keeps the other's", () => {
    const { present } = run(
      { type: "set-metric", density: "dense", name: "row-h", px: 28 },
      { type: "set-metric", density: "comfortable", name: "row-h", px: 40 },
      { type: "reset-metric", density: "dense", name: "row-h" }
    );
    expect(metricOverridesFor(present.overrides, "dense")).toEqual({});
    expect(metricOverridesFor(present.overrides, "comfortable")).toEqual({ "row-h": 40 });
  });

  it("adds no undo step when the metric has no edit", () => {
    const start = run();
    expect(reduceEdits(start, { type: "reset-metric", density: "dense", name: "row-h" })).toBe(start);
  });

  it("is cleared by reset-all with the token edits", () => {
    const { present } = run(
      { type: "set", scheme: "light", name: "primary", value: "#ff0000" },
      { type: "set-metric", density: "dense", name: "row-h", px: 28 },
      { type: "reset-all" }
    );
    expect(present.overrides).toBe(NO_OVERRIDES);
  });
});

describe("metric edits in the guarded session", () => {
  it("admits a metric edit, which reads no token and so cannot close an alias cycle", () => {
    const { history, refusal } = reduceGuarded(
      guardedHistory(EMPTY),
      { type: "set-metric", density: "dense", name: "row-h", px: 30 },
      documentCycles
    );
    expect(refusal).toBeUndefined();
    expect(history.present.overrides.density).toEqual({ dense: { "row-h": 30 } });
  });
});

describe("metricStyle", () => {
  it("declares each metric edit as a px custom property", () => {
    expect(metricStyle({ "control-h-md": 56, "surface-gap-sm": 4.5 })).toEqual({
      "--control-h-md": "56px",
      "--surface-gap-sm": "4.5px",
    });
  });

  it("declares nothing without edits", () => {
    expect(metricStyle({})).toEqual({});
  });
});

describe("metric edits in share text", () => {
  it("round-trips per-density metric edits", () => {
    const document: StudioDocument = {
      theme: ELMA,
      overrides: {
        ...NO_OVERRIDES,
        density: { dense: { "control-h-xs": 16 }, comfortable: { "row-h": 40 } },
      },
    };
    const encoded = encodeShare(document);
    expect(encoded.ok).toBe(true);
    expect(encoded.ok && decodeShare(encoded.text)).toEqual(document);
  });

  it("stays inside the share size limit with every metric edited at both densities", () => {
    const every = Object.fromEntries(STUDIO_METRICS.map((metric) => [metric.name, 96]));
    const document: StudioDocument = {
      theme: ELMA,
      overrides: { ...NO_OVERRIDES, density: { dense: every, comfortable: every } },
    };
    const encoded = encodeShare(document);
    expect(encoded.ok).toBe(true);
    expect(encoded.ok && decodeShare(encoded.text)).toEqual(document);
  });

  it("reads a link from before metric edits as having none", () => {
    expect(decodeShare(shareText({ t: "external-elma-private" }))?.overrides.density).toBeUndefined();
  });

  it("reads the documented payload", () => {
    expect(
      decodeShare(shareText({ t: "external-elma-private", m: { comfortable: { "control-h-md": 56 } } }))
        ?.overrides.density
    ).toEqual({ comfortable: { "control-h-md": 56 } });
  });

  it.each([
    ["an unknown density", { roomy: { "row-h": 40 } }],
    ["an unknown metric", { dense: { "row-height": 40 } }],
    ["a text value", { dense: { "row-h": "40px" } }],
    ["a negative value", { dense: { "row-h": -1 } }],
    ["a value past the knob's range", { dense: { "row-h": 97 } }],
    ["a list in place of a group", { dense: [40] }],
  ])("refuses %s", (_case, metrics) => {
    expect(decodeShare(shareText({ t: "external-elma-private", m: metrics }))).toBeUndefined();
  });
});
