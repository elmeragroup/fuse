import type { ReactElement } from "react";

import { afterEach, beforeEach, expect } from "vitest";

import { Button } from "../src/components/button/button";
import { SkeletonReveal } from "../src/components/skeleton/skeleton-reveal";
import { renderThemed } from "./themed-browser-render";

/** An invoice: a title and its lines. */
export type Invoice = { readonly title: string; readonly lines: readonly string[] };

/** The sample an invoice skeleton is drawn from: one line, shorter than `LONG`. */
export const SAMPLE: Invoice = { title: "Invoice 0000", lines: ["Due 1 January"] };

/** Loaded data: five lines, taller than the sample. */
export const LONG: Invoice = {
  title: "Invoice 4711",
  lines: ["Due 4 May", "Electricity 812 kr", "Grid rent 344 kr", "Fees 39 kr", "Total 1195 kr"],
};

/**
 * An invoice card: a title, a paragraph per line and a Fuse Button, which the skeleton draws as a
 * block.
 *
 * @param props - The invoice to show.
 * @returns The card.
 */
export function InvoiceCard({ invoice }: { invoice: Invoice }): ReactElement {
  return (
    <div className="flex w-72 flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-lg">{invoice.title}</h3>
      {invoice.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <Button>Pay {invoice.title}</Button>
    </div>
  );
}

/** How `renderInvoice` sets up its reveal. */
type InvoiceOptions = {
  /** Called when the reveal reports content in. */
  readonly onReveal?: () => void;
  /** Wraps the reveal, as a scaled ancestor does. */
  readonly around?: (reveal: ReactElement) => ReactElement;
};

/**
 * Renders a `together` invoice reveal drawn from `SAMPLE`, with a `show` that changes its data and
 * loading.
 *
 * @param data - The invoice to show, or null while loading.
 * @param options - `onReveal` and a wrapper.
 * @returns The themed render, with `show(next, loading?)`.
 */
export function renderInvoice(data: Invoice | null, options: InvoiceOptions = {}) {
  const around = options.around ?? ((reveal: ReactElement) => reveal);
  const view = (next: Invoice | null, loading?: boolean) =>
    around(
      <SkeletonReveal
        data={next}
        sample={SAMPLE}
        reveal="together"
        label="Henter faktura"
        loading={loading}
        onReveal={options.onReveal ?? (() => undefined)}>
        {(invoice) => <InvoiceCard invoice={invoice} />}
      </SkeletonReveal>
    );
  const result = renderThemed(view(data));
  return {
    ...result,
    show: (next: Invoice | null, loading?: boolean) => result.rerender(view(next, loading)),
  };
}

/**
 * DOM audit: the reveal parts have no role; locate them by their data-slot.
 *
 * @param name - The part's data-slot.
 * @param within - Where to look; the document unless given.
 * @returns The first part with that slot.
 * @throws Error when there is none, a failure of the suite's setup.
 */
export function slot(name: string, within: ParentNode = document): HTMLElement {
  const element = within.querySelector(`[data-slot="${name}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`expected data-slot="${name}"`);
  return element;
}

/**
 * DOM audit: the reveal parts have no role; the first part with a data-slot, if any.
 *
 * @param name - The part's data-slot.
 * @returns The part, or null when there is none.
 */
export function querySlot(name: string): Element | null {
  return document.querySelector(`[data-slot="${name}"]`);
}

/**
 * The root's own height animation, if one runs.
 *
 * @param root - The reveal's root.
 * @returns The animation of its height, or undefined.
 */
export function heightAnimation(root: HTMLElement): Animation | undefined {
  return root.getAnimations().find((animation) => {
    const effect = animation.effect;
    return effect instanceof KeyframeEffect && effect.getKeyframes().some((frame) => "height" in frame);
  });
}

/**
 * Every Web Animation the reveal started under `root`; the bones' CSS pulse is not one.
 *
 * @param root - Where to look, its subtree included.
 * @returns The script animations.
 */
export function scriptAnimations(root: Element): Animation[] {
  return root.getAnimations({ subtree: true }).filter((animation) => !(animation instanceof CSSAnimation));
}

/**
 * Fails every test of the calling file during which the page reports a ResizeObserver loop: the
 * window `error` event a browser fires when an observer's callback changes the layout it observes,
 * which a consumer's error monitoring would log on every reveal. Call it once at the top level.
 */
export function failOnResizeObserverLoop(): void {
  let loops: string[] = [];
  const listen = (event: ErrorEvent): void => {
    if (event.message.includes("ResizeObserver loop")) loops.push(event.message);
  };
  beforeEach(() => {
    loops = [];
    window.addEventListener("error", listen);
  });
  afterEach(() => {
    window.removeEventListener("error", listen);
    // Soft, so the test fails without throwing out of the hooks: hooks run as a stack, and a throw
    // here would skip the render cleanup registered before it, leaving this test's tree mounted.
    expect.soft(loops, "ResizeObserver loop errors").toEqual([]);
  });
}
