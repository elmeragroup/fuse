"use client";

/**
 * Root's reference labels on a vertical chart. Each value label registers its node and its own
 * size, and its reference's writer hands over the guide it draws in every frame. Each slot label
 * registers too, and its writer reports whether its guide shows in the plot now, which reserves the
 * row of slot labels above the plot. Every handover and every change of a label's size, of the row
 * or of the plot places all the value labels again through `placeLabels`, from what every guide
 * draws now, so collision membership, stacking order, the row and offsets all follow the drawn
 * guides and none of them reads a target.
 */
import { writeAttribute, writeStyle } from "./chart-dom";
import type { AttributeNode, StyleNode } from "./chart-dom";
import { placeLabels } from "./layout/reference-labels";
import type { LabelGuide, LabelPlot, LabelSize } from "./layout/reference-labels";

/** The plot measurements a commit reads: its drawn bottom edge and one device pixel. */
export type LabelBounds = Omit<LabelPlot, "start">;

/** The CSS a label node takes its place from. */
export type LabelNode = AttributeNode & StyleNode;

type Entry = {
  readonly node: LabelNode;
  readonly kind: "line" | "area";
  readonly order: number;
  size: LabelSize;
  span: readonly [number, number] | null;
};

/** Root's label registry. */
export type ChartLabels = {
  /** Register a label while it shows, with its size. The result unregisters it. */
  readonly add: (key: string, node: LabelNode, kind: "line" | "area", size: LabelSize) => () => void;
  /** Keep a label's size as the latest commit measured it. */
  readonly resize: (key: string, size: LabelSize) => void;
  /** Keep the plot's drawn bottom edge and pixel size as the latest commit measured them. */
  readonly measure: (bounds: LabelBounds) => void;
  /**
   * Hand over the guide a label's reference draws now, and place every label from it, or null while
   * the reference hides, which takes its label out of the stack.
   */
  readonly move: (key: string, span: readonly [number, number] | null) => void;
  /** Register a slot reference's label while it has one. The result unregisters it. */
  readonly addSlot: (key: string) => () => void;
  /** Report whether a slot label's guide shows in the plot now, which reserves the row of slots. */
  readonly showSlot: (key: string, shown: boolean) => void;
};

/** Whether two label sizes match. */
function sameSize(a: LabelSize, b: LabelSize): boolean {
  return a.height === b.height && a.inset === b.inset;
}

/** Take a label out of the stack. */
function unstack(node: LabelNode): void {
  writeAttribute(node, "data-stack", null);
  writeStyle(node, "--chart-label-bottom", null);
}

/**
 * Create a Root's label registry.
 *
 * @returns The registry.
 */
export function createChartLabels(): ChartLabels {
  const entries = new Map<string, Entry>();
  let mounted = 0;
  let bounds: LabelBounds = { end: 0, pixel: 1 };
  // Each slot label and whether its guide shows now. Any shown one reserves the row above the
  // plot, which keeps every value label below the plot's top.
  const slots = new Map<string, boolean>();
  const place = (): void => {
    const row = [...slots.values()].some(Boolean);
    const plot: LabelPlot = { start: row ? 0 : Number.NEGATIVE_INFINITY, ...bounds };
    const drawn = [...entries.values()].filter(
      (entry): entry is Entry & { span: readonly [number, number] } => entry.span !== null
    );
    // A hidden reference's label holds no place in the stack.
    for (const entry of entries.values()) if (entry.span === null) unstack(entry.node);
    const guides: LabelGuide[] = drawn.map(({ kind, order, span, size }) => ({ kind, order, span, ...size }));
    placeLabels(guides, plot).forEach((bottom, index) => {
      const node = drawn[index]?.node;
      if (node === undefined) return;
      writeStyle(node, "--chart-label-bottom", `${String(bottom)}px`);
      writeAttribute(node, "data-stack", "");
    });
  };
  return {
    add(key, node, kind, size) {
      const entry: Entry = { node, kind, order: mounted, size, span: null };
      mounted += 1;
      entries.set(key, entry);
      return () => {
        if (entries.get(key) !== entry) return;
        entries.delete(key);
        unstack(node);
        place();
      };
    },
    resize(key, size) {
      const entry = entries.get(key);
      if (entry === undefined || sameSize(entry.size, size)) return;
      entry.size = size;
      place();
    },
    measure(next) {
      if (next.end === bounds.end && next.pixel === bounds.pixel) return;
      bounds = next;
      place();
    },
    move(key, span) {
      const entry = entries.get(key);
      if (entry === undefined || (span === null && entry.span === null)) return;
      entry.span = span;
      place();
    },
    addSlot(key) {
      slots.set(key, false);
      return () => {
        const shown = slots.get(key) === true;
        slots.delete(key);
        if (shown) place();
      };
    },
    showSlot(key, shown) {
      if (!slots.has(key) || slots.get(key) === shown) return;
      slots.set(key, shown);
      place();
    },
  };
}
