/**
 * How a demo sits in its stage, read in the page. The stage lays its demo out in block flow, so
 * the demo's root takes its width from the kind of box it is, never from the content it shows: a
 * block-level root with no width of its own fills the stage, capped by its own `max-width`, an
 * inline-level root keeps its width on a centred line, and no root runs out of the stage. This module reads each stage's roots and
 * reports the ones that do not.
 *
 * Every helper is declared inside `readDemoWidths`, because Playwright serializes the function it
 * evaluates on its own.
 */

/** One demo root that breaks the stage's width rule. */
export type WidthViolation = {
  /** The id of the demo frame's heading. */
  readonly demo: string;
  /** The root's tag and `data-slot`. */
  readonly root: string;
  /** What is wrong, in px. */
  readonly reason: string;
};

/**
 * Reads every stage on the page and returns its roots that break the width rule.
 *
 * @returns The violations, empty when every root sits as the rule says.
 */
export function readDemoWidths(): WidthViolation[] {
  /** The boxes a stage lays out: element children, through `display: contents`, in flow. */
  function rootsOf(parent: Element): HTMLElement[] {
    return [...parent.children].flatMap((child) => {
      if (!(child instanceof HTMLElement)) {
        return [];
      }
      const style = getComputedStyle(child);
      if (style.display === "contents") {
        return rootsOf(child);
      }
      if (style.display === "none" || style.position === "absolute" || style.position === "fixed") {
        return [];
      }
      return [child];
    });
  }

  /** A computed length in px, or `undefined` for a keyword. */
  function lengthOf(value: string): number | undefined {
    return value.endsWith("px") ? Number.parseFloat(value) : undefined;
  }

  /** Whether the root's own width is `auto`, so the stage decides it. */
  function widthIsAuto(root: HTMLElement): boolean {
    const width = root.computedStyleMap().get("width");
    return width instanceof CSSKeywordValue && width.value === "auto";
  }

  return [...document.querySelectorAll<HTMLElement>("[data-demo-stage]")].flatMap((stage) => {
    const demo = stage.closest("[data-demo-frame]")?.getAttribute("aria-labelledby") ?? "(no frame)";
    const style = getComputedStyle(stage);
    const box = stage.getBoundingClientRect();
    const start = box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
    const end = box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight);
    const content = end - start;
    return rootsOf(stage).flatMap((root): WidthViolation[] => {
      const name = `${root.tagName.toLowerCase()}${root.dataset.slot === undefined ? "" : `[${root.dataset.slot}]`}`;
      const fail = (reason: string): WidthViolation[] => [{ demo, root: name, reason }];
      const rect = root.getBoundingClientRect();
      // No root runs out of the stage, whatever sizes it: the stage would clip what overflows.
      if (rect.width > content + 1) {
        return fail(`root is ${String(rect.width)}px wide in a ${String(content)}px stage`);
      }
      const rootStyle = getComputedStyle(root);
      if (rootStyle.display.startsWith("inline")) {
        // An inline-level root keeps its width and sits centred.
        const startGap = rect.left - start;
        const endGap = end - rect.right;
        return Math.abs(startGap - endGap) > 1
          ? fail(`inline root sits ${String(startGap)}px from the start and ${String(endGap)}px from the end`)
          : [];
      }
      // A root with a width of its own, or capped at an intrinsic size such as `max-w-max`, sizes
      // itself; the stage decides only an auto width under a length cap or none.
      const cap = rootStyle.maxWidth === "none" ? Number.POSITIVE_INFINITY : lengthOf(rootStyle.maxWidth);
      if (!widthIsAuto(root) || cap === undefined) {
        return [];
      }
      const expected = Math.min(content, cap);
      return Math.abs(rect.width - expected) > 1
        ? fail(`block root is ${String(rect.width)}px wide, not the ${String(expected)}px it fills`)
        : [];
    });
  });
}
