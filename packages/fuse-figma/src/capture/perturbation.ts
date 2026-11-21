/**
 * The perturbation probe's measurement: the sizing oracle of a set switched to its capture. Each
 * cell renders on a compare page as the capture renders it, and the probe measures every box of each
 * root it measures as rendered, with the element around the root 120px wider, and with the box's own
 * text longer and far longer. For an anchored composite it also measures the gap between the anchor
 * and the popup. `capture/probe-sizing.ts`
 * reads the sizing these widths imply and compares it with the built set.
 *
 * The measured boxes are oracle data only: the probe compares them and keeps none.
 */

import type { Page } from "playwright";

import { cellSelector } from "../compare/preview-page.ts";

/** How much wider the probe makes the element around each root, in CSS pixels. */
export const WIDER_BY = 120;

/** The text the probe appends to every text node below a root. */
const LONGER_BY = " and a much longer sample text";

/** How many times the probe appends that text for its far longer run, past any kit sample's width. */
const LONGEST_BY = 20;

/** One box of a root as the probe measured it: its `data-slot`, its place and its width in each run. */
export type ProbedBox = {
  readonly slot: string;
  /**
   * The box's place, as the capture names places: its root's index among the cell's measured roots,
   * `root`, and the element child index at each step down, as `0/root/1/0`.
   */
  readonly place: string;
  /** Whether the root is the box itself, rather than an element below it. */
  readonly root: boolean;
  /** Whether a text node sits at or below the box. */
  readonly text: boolean;
  /**
   * Whether lengthening the box's text could widen it: some text node is the box's own, or every
   * element between it and the box widened with it or is as wide as its parent's content box, which
   * leaves its width to the elements above it, as a popup's rows do. Text in a box of a set width, as
   * an avatar's initials, or in a visually hidden label, never widens a box above it, hugging or fixed.
   */
  readonly textReaches: boolean;
  /** Whether the box's parent widened when the probe widened the element around the root. */
  readonly parentWidened: boolean;
  readonly base: number;
  readonly wider: number;
  readonly longer: number;
  /** The box's width with its text far longer, the run that reaches past any kit sample's width. */
  readonly longest: number;
  /** Whether the box is as wide as its parent's content box in every run, as a box that fills it is. */
  readonly tracksParent: boolean;
  /** Whether the longer text pushed the box past its parent's content box, as text that cannot wrap does. */
  readonly overflows: boolean;
  /** Whether the box is `position: fixed`, so its container is the viewport the sample declares. */
  readonly fixedInViewport: boolean;
  /**
   * Whether far longer text made the box exactly as wide as the room its parent leaves it, so it fits
   * its text up to that room and wraps there, as `w-fit` does. The room is the parent's content box,
   * less, in a flex row on one line, the row's other in-flow items and the gaps between them, the
   * room a shrinking item gives its overflow back to (CSS Flexbox 1 §9.7), as File upload's
   * description has beside its trigger. A box out of the flow has the whole content box. The parent
   * must keep its width as the text grows: one that widens with the text, as a `max-content` row
   * does, sets no cap the box stops at.
   */
  readonly capsAtParent: boolean;
  /**
   * Whether the probe widened the element around the box's root. It leaves a positioned parent with
   * an auto width, as Base UI's positioner, as it is, since it shrinks to its content.
   */
  readonly widened: boolean;
  /** Whether the box is `display: table-cell`, whose set width is only a minimum (CSS 2.1 §17.5.2.2). */
  readonly tableCell: boolean;
};

/** One cell as the probe measured it: each root's boxes, and the gap between two roots. */
export type ProbedCell = {
  readonly id: string;
  readonly boxes: readonly ProbedBox[];
  /** The gap between the first two roots along the axis they sit on, for a cell that measures two. */
  readonly gap: number | undefined;
};

/**
 * How many frames the probe waits for Base UI to give a popup its anchor's width before it stops: a
 * bound on a hang, far past the frame or two Base UI takes, never a pass condition.
 */
const SETTLE_FRAMES = 600;

/**
 * Measure the cells of an opened page in each run, restoring the page between runs. Before each run
 * reads the page, it waits until each anchored popup takes its anchor's width, as Base UI sets it a
 * frame or more after the anchor resizes, so a popup as wide as its anchor reads as filling. Where
 * the wider run stops, it puts each widened parent's style back before it rejects.
 *
 * @param page - The page.
 * @param cells - Each cell's id and the selectors of the roots it measures.
 * @returns Each cell's boxes.
 */
export async function probeCells(
  page: Page,
  cells: readonly { readonly id: string; readonly measured: readonly string[] }[]
): Promise<readonly ProbedCell[]> {
  const roots = cells.map(({ id, measured }) => ({
    id,
    selectors: measured.map((selector) => cellSelector(id, selector)),
  }));
  return page.evaluate(
    async ({ roots, widerBy, longerBy, longestBy, settleFrames }) => {
      type Box = {
        slot: string;
        place: string;
        root: boolean;
        text: boolean;
        width: number;
        parent: number;
        fixed: boolean;
        tableCell: boolean;
      };
      const contentWidth = (element: Element | null): number => {
        if (element === null) {
          return Number.NaN;
        }
        const style = getComputedStyle(element);
        return (
          element.getBoundingClientRect().width -
          ["padding-left", "padding-right", "border-left-width", "border-right-width"].reduce(
            (sum, property) => sum + Number.parseFloat(style.getPropertyValue(property) || "0"),
            0
          )
        );
      };
      // A block with an auto width fills its parent's content box less its own margins (CSS 2.1
      // §10.3.3), so the room a box's border box spans is the parent's content less those margins.
      const roomOf = (element: Element): number => {
        const style = getComputedStyle(element);
        return (
          contentWidth(element.parentElement) -
          Number.parseFloat(style.marginLeft || "0") -
          Number.parseFloat(style.marginRight || "0")
        );
      };
      // What a flex row on one line takes beside one of its in-flow items: its other in-flow items
      // and the gaps between them, which leave the item the rest (CSS Flexbox 1 §9.7). An absolute or
      // fixed box is out of the flow (§4.1), so the row takes nothing beside it. Elsewhere it is 0.
      const outOfFlow = (style: CSSStyleDeclaration): boolean =>
        style.position === "absolute" || style.position === "fixed";
      const besideOf = (element: Element): number => {
        const parent = element.parentElement;
        const row = parent === null ? undefined : getComputedStyle(parent);
        if (
          parent === null ||
          row === undefined ||
          outOfFlow(getComputedStyle(element)) ||
          !["flex", "inline-flex"].includes(row.display) ||
          row.flexDirection !== "row" ||
          row.flexWrap !== "nowrap"
        ) {
          return 0;
        }
        const flowing = [...parent.children].filter((child) => {
          const style = getComputedStyle(child);
          return style.display !== "none" && !outOfFlow(style);
        });
        const others = flowing
          .filter((child) => child !== element)
          .reduce((sum, child) => {
            const style = getComputedStyle(child);
            return (
              sum +
              child.getBoundingClientRect().width +
              Number.parseFloat(style.marginLeft || "0") +
              Number.parseFloat(style.marginRight || "0")
            );
          }, 0);
        const gap = Number.parseFloat(row.columnGap);
        return others + (Number.isNaN(gap) ? 0 : gap) * Math.max(0, flowing.length - 1);
      };
      const placeOf = (element: Element, root: Element, index: number): string => {
        const steps: number[] = [];
        for (let at = element; at !== root && at.parentElement !== null; at = at.parentElement) {
          steps.unshift([...at.parentElement.children].indexOf(at));
        }
        return [String(index), "root", ...steps.map(String)].join("/");
      };
      const boxesOf = (root: Element, index: number): Box[] =>
        [root, ...root.querySelectorAll("[data-slot]")].map((element) => ({
          slot: element.getAttribute("data-slot") ?? "",
          place: placeOf(element, root, index),
          root: element === root,
          text: [...element.querySelectorAll("*"), element].some((each) =>
            [...each.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "")
          ),
          width: element.getBoundingClientRect().width,
          parent: roomOf(element),
          fixed: getComputedStyle(element).position === "fixed",
          tableCell: getComputedStyle(element).display === "table-cell",
        }));
      // A root's index is its selector's: the renderer names the roots in the order the capture holds them.
      const measure = () =>
        roots.map(({ selectors }) =>
          selectors.flatMap((selector, index) => {
            const root = document.querySelector(selector);
            return root === null ? [] : boxesOf(root, index);
          })
        );
      const elementsOf = (selectors: readonly string[]) =>
        selectors.flatMap((selector) => {
          const root = document.querySelector(selector);
          return root === null ? [] : [root];
        });
      // Base UI writes a popup's `--anchor-width` on its positioner a frame or more after its anchor
      // resizes, so the probe waits for each anchored popup it measures beside its anchor to take the
      // anchor's width before each run reads the page: as rendered, widened, and once it puts the
      // page back. A popup is the root that names Base UI's `data-side`, as the capture build's
      // anchored placement reads it, and its anchor the other root, whatever the property holds when
      // the probe starts.
      const anchored = roots.flatMap(({ id, selectors }) => {
        const elements = elementsOf(selectors);
        const popup = elements.find((each) => each.hasAttribute("data-side"));
        const anchor = elements.find((each) => each !== popup);
        return popup?.parentElement && anchor !== undefined
          ? [{ id, positioner: popup.parentElement, anchor }]
          : [];
      });
      // The property in pixels, or NaN for a value that is not one, as `auto` or none.
      const anchorWidthOf = (positioner: HTMLElement): number => {
        const value = positioner.style.getPropertyValue("--anchor-width").trim();
        return /^\d+(\.\d+)?px$/.test(value) ? Number.parseFloat(value) : Number.NaN;
      };
      const settle = async (): Promise<void> => {
        for (let frame = 0; ; frame += 1) {
          // A NaN never sits within a pixel of the anchor, so a value that is no length keeps waiting.
          const apart = anchored.filter(
            ({ positioner, anchor }) =>
              !(Math.abs(anchorWidthOf(positioner) - anchor.getBoundingClientRect().width) < 1)
          );
          if (apart.length === 0) {
            return;
          }
          if (frame === settleFrames) {
            throw new Error(
              `Base UI never set --anchor-width to the anchor's width in ${apart.map(({ id }) => id).join(", ")}`
            );
          }
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      };
      await settle();
      const base = measure();
      const rootOf = (box: { root: boolean }, at: number, index: number): boolean => {
        const selectors = roots[at]?.selectors ?? [];
        let seen = 0;
        for (const selector of selectors) {
          const root = document.querySelector(selector);
          if (root === null) {
            continue;
          }
          const count = 1 + root.querySelectorAll("[data-slot]").length;
          if (index < seen + count) {
            return widenedRoots.has(root);
          }
          seen += count;
        }
        return false;
      };
      const gaps = roots.map(({ selectors }) => {
        const [first, second] = elementsOf(selectors).map((each) => each.getBoundingClientRect());
        if (first === undefined || second === undefined) {
          return undefined;
        }
        const vertical = Math.max(second.top - first.bottom, first.top - second.bottom);
        const horizontal = Math.max(second.left - first.right, first.left - second.right);
        return Math.max(vertical, horizontal);
      });
      // Wider: each root's parent, the element its width fills. The page gets each parent's style
      // back whether or not the wider run settles.
      const widened: { element: HTMLElement; style: string | null }[] = [];
      const widenedRoots = new Set<Element>();
      const widerRun = async () => {
        for (const { selectors } of roots) {
          for (const root of elementsOf(selectors)) {
            const parent = root.parentElement;
            // A positioned parent with an auto width, as Base UI's positioner, shrinks to its content,
            // so it is no container a box could fill; the probe leaves it as it is. The compare page's
            // own cell is positioned too, and it is the container the kit's frame stands for, so the
            // probe widens it: a root without text that sits in it is measured, not `unknown`.
            // A parent whose width follows the root's own text, as a slot that shrinks to fit holds a
            // Field around a label, hugs the root: widening it shows nothing the page would do.
            const followsText = (() => {
              if (parent === null) {
                return false;
              }
              const before = contentWidth(parent);
              const nodes: { node: Node; text: string }[] = [];
              const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
              for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
                const text = node.textContent ?? "";
                if (text.trim() !== "") {
                  nodes.push({ node, text });
                  node.textContent = `${text}W`;
                }
              }
              const after = contentWidth(parent);
              for (const { node, text } of nodes) {
                node.textContent = text;
              }
              return Math.abs(after - before) > 0.01;
            })();
            const shrinks =
              parent !== null &&
              ((["absolute", "fixed"].includes(getComputedStyle(parent).position) &&
                !parent.hasAttribute("data-compare-cell")) ||
                followsText);
            if (parent !== null && !shrinks) {
              widenedRoots.add(root);
            }
            if (parent !== null && !shrinks && !widened.some((each) => each.element === parent)) {
              widened.push({ element: parent, style: parent.getAttribute("style") });
              parent.style.width = `${String(parent.getBoundingClientRect().width + widerBy)}px`;
              parent.style.maxWidth = "none";
            }
          }
        }
        await settle();
        return measure();
      };
      const restore = (): void => {
        for (const { element, style } of widened) {
          if (style === null) {
            element.removeAttribute("style");
          } else {
            element.setAttribute("style", style);
          }
        }
      };
      const wider = await widerRun().finally(restore);
      await settle();
      // Longer: each box's own text alone, so a sibling's text that cannot wrap does not widen it.
      const longer = roots.map(({ selectors }) =>
        selectors.flatMap((selector) => {
          const root = document.querySelector(selector);
          if (root === null) {
            return [];
          }
          return [root, ...root.querySelectorAll("[data-slot]")].map((element) => {
            // Read before the text lengthens, so an item that shrinks beside a longer text does not
            // leave the box a room that grows with it, and so is the parent's width, which a parent
            // that fits its content widens with the text.
            const beside = besideOf(element);
            const before = roomOf(element);
            const lengthened: { node: Node; text: string; between: { element: Element; width: number }[] }[] =
              [];
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
              const text = node.textContent ?? "";
              if (text.trim() !== "") {
                // The elements from the text's own up to the box, which a longer text widens on its way.
                const between: { element: Element; width: number }[] = [];
                for (let up = node.parentElement; up !== null && up !== element; up = up.parentElement) {
                  between.push({ element: up, width: up.getBoundingClientRect().width });
                }
                lengthened.push({ node, text, between });
              }
            }
            for (const { node, text } of lengthened) {
              node.textContent = text + longerBy;
            }
            const measured = {
              width: element.getBoundingClientRect().width,
              parent: roomOf(element),
              reaches: lengthened.some(({ between }) =>
                between.every(
                  ({ element: up, width }) =>
                    up.getBoundingClientRect().width - width > 1 ||
                    Math.abs(up.getBoundingClientRect().width - contentWidth(up.parentElement)) <= 1
                )
              ),
            };
            // Far longer, so a box that fits its text, as `w-fit` does, reaches its parent and wraps.
            for (const { node, text } of lengthened) {
              node.textContent = text + longerBy.repeat(longestBy);
            }
            const longest = {
              width: element.getBoundingClientRect().width,
              parent: roomOf(element),
            };
            for (const { node, text } of lengthened) {
              node.textContent = text;
            }
            // A cap is a room that stays put: a parent that grew with the text set no limit the box
            // stopped at.
            return {
              ...measured,
              longest: longest.width,
              capped:
                Math.abs(longest.parent - before) <= 1 &&
                Math.abs(longest.width - (longest.parent - beside)) <= 1,
            };
          });
        })
      );
      return roots.map(({ id }, at) => ({
        id,
        gap: gaps[at],
        boxes: (base[at] ?? []).map((box, index) => ({
          slot: box.slot,
          place: box.place,
          root: box.root,
          text: box.text,
          textReaches: longer[at]?.[index]?.reaches === true,
          parentWidened: (wider[at]?.[index]?.parent ?? box.parent) - box.parent > 1,
          base: box.width,
          wider: wider[at]?.[index]?.width ?? box.width,
          longer: longer[at]?.[index]?.width ?? box.width,
          longest: longer[at]?.[index]?.longest ?? box.width,
          tableCell: box.tableCell,
          tracksParent: [box, wider[at]?.[index], longer[at]?.[index]].every(
            (run) => run !== undefined && Math.abs(run.width - run.parent) <= 1
          ),
          overflows:
            (longer[at]?.[index]?.width ?? 0) > (longer[at]?.[index]?.parent ?? Number.POSITIVE_INFINITY) + 1,
          fixedInViewport: box.fixed,
          capsAtParent: longer[at]?.[index]?.capped === true,
          widened: rootOf(box, at, index),
        })),
      }));
    },
    { roots, widerBy: WIDER_BY, longerBy: LONGER_BY, longestBy: LONGEST_BY, settleFrames: SETTLE_FRAMES }
  );
}
