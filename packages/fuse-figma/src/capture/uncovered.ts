/**
 * What the capture's page measures of an absolute `<svg>` that the kit may draw as the last layer of
 * its box's frame, over every other layer there, as Accordion's `infodropdown` trigger holds its
 * caret at its right edge. `absolute-icon.ts` reads these facts beside the closed set of shapes it
 * accepts:
 *
 * - {@link uncovered}: CSS paints nothing over the element. Figma paints a frame's layers in their
 *   order and has no stacking level, so the last layer paints as CSS does only where nothing paints
 *   over the element, which `boxesOver` in `paints-over.ts` decides for `parentSpansBlock` and
 *   `blockSteps` too.
 * - {@link placeReadings} and {@link agreedPlace}: where the element sits in its parent, one value per
 *   length in every mode and as the parent grows, so the build places it by facts that hold there.
 * - {@link stillInEveryMode}: no element of the root runs an animation, which the capture's page
 *   stops and a consumer's page runs.
 *
 * Each is passed to the page as its source, so it reads nothing outside its own body and its
 * arguments, the reads of `stacking.ts` and the helpers of `paints-over.ts` and
 * `containing-block.ts`.
 */

import type { IconPlace } from "./capture-format.ts";
import type { BlockHelpers } from "./containing-block.ts";
import type { PageMode } from "./page-modes.ts";
import type { Stacking } from "./stacking.ts";

/**
 * Whether an absolute `<svg>` paints over every other box of the captured root. Runs in the page.
 *
 * - The element is an `<svg>`, absolute and displayed, and computes `visibility: visible`.
 * - Its `z-index` is `auto`. A level of its own would paint it over boxes outside its box that the
 *   kit draws after the box's frame (CSS 2.1 §9.9.1), and `boxesOver` reads only what paints over
 *   it.
 * - Nothing paints over the element, as `boxesOver` decides, not even a `::before` or `::after`
 *   box that paints nothing, as `parentSpansBlock` requires.
 *
 * @param element - The element.
 * @param root - The captured root the element sits below.
 * @param stacking - The reads of `stacking.ts`, handed to the page with this function.
 * @param helpers - The reads of `paints-over.ts` the page hands in.
 * @returns True where CSS paints nothing over the element.
 */
export function uncovered(
  element: Element,
  root: Element,
  stacking: Stacking,
  helpers: Pick<BlockHelpers, "generatedBoxes" | "boxesOver">
): boolean {
  const own = getComputedStyle(element);
  return (
    element.localName === "svg" &&
    own.position === "absolute" &&
    own.display !== "none" &&
    own.visibility === "visible" &&
    own.zIndex === "auto" &&
    helpers.boxesOver(element, root, stacking, helpers.generatedBoxes)?.length === 0
  );
}

/** One reading of where an `<svg>` sits in its parent, and whether it lies inside the parent's border box. */
export type PlaceReading = { readonly inside: boolean; readonly place: Required<IconPlace> };

/**
 * Where an `<svg>` sits in its parent's border box in the page's mode, with its `rotate` set to
 * `none` for the read: once as the page lays it out, and once each with the parent 10px wider and
 * 10px taller, as `grownAlike` grows it. Runs in the page.
 *
 * @param element - The `<svg>`.
 * @param helpers - `grownAlike` and `withStyles` in `containing-block.ts`.
 * @returns The three readings, or undefined where the element has no parent or the parent does not
 *   grow by the full 10px.
 */
export function placeReadings(
  element: Element,
  helpers: Pick<BlockHelpers, "grownAlike" | "withStyles">
): readonly PlaceReading[] | undefined {
  const box = element.parentElement;
  if (box === null) {
    return undefined;
  }
  const readings: PlaceReading[] = [];
  const read = (): boolean =>
    helpers.withStyles([[element, "rotate", "none"]], () => {
      const outer = box.getBoundingClientRect();
      const icon = element.getBoundingClientRect();
      readings.push({
        inside:
          icon.left >= outer.left &&
          icon.right <= outer.right &&
          icon.top >= outer.top &&
          icon.bottom <= outer.bottom,
        place: {
          width: icon.width,
          height: icon.height,
          left: icon.left - outer.left,
          right: outer.right - icon.right,
          top: icon.top - outer.top,
          bottom: outer.bottom - icon.bottom,
          across: icon.left + icon.width / 2 - (outer.left + outer.width / 2),
          down: icon.top + icon.height / 2 - (outer.top + outer.height / 2),
        },
      });
      return true;
    });
  read();
  return helpers.grownAlike(box, read, helpers.withStyles) ? readings : undefined;
}

/**
 * The place an `<svg>`'s readings agree on: its size, where every reading gives one width and one
 * height, and each other value every reading gives alike. Values must be equal, with no tolerance.
 * Runs in the page.
 *
 * @param readings - The readings of each mode, as {@link placeReadings} gives them.
 * @returns The place, or undefined where a mode has no readings, a reading has the `<svg>` reach
 *   outside its parent, or the size differs.
 */
export function agreedPlace(
  readings: readonly (readonly PlaceReading[] | undefined)[]
): IconPlace | undefined {
  const all = readings.flatMap((each) => each ?? []);
  const [first] = all;
  if (first === undefined || readings.includes(undefined) || all.some(({ inside }) => !inside)) {
    return undefined;
  }
  const alike = (key: keyof IconPlace): boolean => all.every(({ place }) => place[key] === first.place[key]);
  if (!alike("width") || !alike("height")) {
    return undefined;
  }
  const kept = (["left", "right", "top", "bottom", "across", "down"] as const).filter(alike);
  return {
    width: first.place.width,
    height: first.place.height,
    ...Object.fromEntries(kept.map((key) => [key, first.place[key]])),
  };
}

/**
 * Whether every element of a root, and each one's `::before` and `::after`, computes
 * `animation-name: none` in every mode, with the page's stopping rule lifted for each read. The rule
 * stops every animation (`compare/preview-page.ts`), so with it on every element reads `none`. The
 * page's own mode, and the rule, come back as they were, also where a read throws. Runs in the page,
 * which `measuredFacts` calls under each `prefers-reduced-motion` value in turn.
 *
 * @param root - The captured root.
 * @param modes - Every mode, as {@link PageMode} stamps it.
 * @param selector - The selector of the `<style>` that holds the stopping rule alone.
 * @returns True where every read gives `none`; false where one names an animation, or where the page
 *   holds no such `<style>`.
 */
export function stillInEveryMode(root: Element, modes: readonly PageMode[], selector: string): boolean {
  const sheet = document.querySelector(selector);
  if (!(sheet instanceof HTMLStyleElement)) {
    return false;
  }
  const marked = [document.documentElement, document.body];
  const saved = marked.map((element) =>
    [...element.attributes]
      .filter(({ name }) => name.startsWith("data-"))
      .map(({ name, value }) => [name, value] as const)
  );
  const elements = [root, ...root.querySelectorAll("*")];
  const still = (element: Element): boolean =>
    [null, "::before", "::after"].every(
      (pseudo) => getComputedStyle(element, pseudo).animationName === "none"
    );
  try {
    return modes.every((mode) => {
      for (const [name, value] of Object.entries(mode.root)) {
        document.documentElement.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(mode.body)) {
        document.body.setAttribute(name, value);
      }
      sheet.disabled = true;
      try {
        return elements.every(still);
      } finally {
        sheet.disabled = false;
      }
    });
  } finally {
    marked.forEach((element, index) => {
      for (const { name } of [...element.attributes].filter((each) => each.name.startsWith("data-"))) {
        element.removeAttribute(name);
      }
      for (const [name, value] of saved[index] ?? []) {
        element.setAttribute(name, value);
      }
    });
  }
}
