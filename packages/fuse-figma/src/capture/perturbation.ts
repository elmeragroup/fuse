/**
 * The perturbation probe: the sizing oracle of a set switched to its capture. Each cell renders on a
 * compare page as the capture renders it, and the probe measures every box of each root it measures
 * three times: as rendered, with the element around the root 120px wider, and with the box's own
 * text longer. From the deltas it infers each box's horizontal sizing: `fill` where the
 * wider container widens it, `hug` where the longer text widens it, and `fixed` where neither does
 * and the box holds text. A box that holds no text and does not fill is `not-fill`, since the probe
 * cannot tell fixed from hug there. The mapped `SizeSpec` kind of the layer the box draws must not
 * contradict the inference. For an anchored composite it also measures the gap between the anchor
 * and the popup, which must equal the popup's `sideOffset`.
 *
 * The measured boxes are oracle data only: the probe compares them and keeps none.
 */

import type { Page } from "playwright";

import { cellSelector } from "../compare/preview-page.ts";
import type {
  ChildLayerSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  SizeSpec,
} from "../components/kit-spec.ts";

/** How much wider the probe makes the element around each root, in CSS pixels. */
export const WIDER_BY = 120;

/** The text the probe appends to every text node below a root. */
const LONGER_BY = " and a much longer sample text";

/** How many times the probe appends that text for its far longer run, past any kit sample's width. */
const LONGEST_BY = 20;

/** One box of a root as the probe measured it: its `data-slot` and its width in each run. */
export type ProbedBox = {
  readonly slot: string;
  /** Whether the root is the box itself, rather than an element below it. */
  readonly root: boolean;
  /** Whether a text node sits at or below the box. */
  readonly text: boolean;
  readonly base: number;
  readonly wider: number;
  readonly longer: number;
  /** Whether the box is as wide as its parent's content box in every run, as a box that fills it is. */
  readonly tracksParent: boolean;
  /** Whether the longer text pushed the box past its parent's content box, as text that cannot wrap does. */
  readonly overflows: boolean;
  /** Whether the box is `position: fixed`, so its container is the viewport the sample declares. */
  readonly fixedInViewport: boolean;
  /**
   * Whether far longer text made the box exactly as wide as its parent's content box, so it fits its
   * text up to the room it has and wraps there, as `w-fit` does.
   */
  readonly capsAtParent: boolean;
  /**
   * Whether the probe widened the element around the box's root. It leaves a positioned parent with
   * an auto width, as Base UI's positioner, as it is, since it shrinks to its content.
   */
  readonly widened: boolean;
};

/** One cell as the probe measured it: each root's boxes, and the gap between two roots. */
export type ProbedCell = {
  readonly id: string;
  readonly boxes: readonly ProbedBox[];
  /** The gap between the first two roots along the axis they sit on, for a cell that measures two. */
  readonly gap: number | undefined;
};

/**
 * What the probe infers a box's horizontal sizing is. `tracks` is a box as wide as its parent's
 * content box in every run: it fills its parent, or it is the only child its hugging parent hugs.
 * `overflows` is a box its longer text pushed past its parent's content box, as text that cannot wrap
 * does, which tells hug from fill no more. `fill-viewport` is a `position: fixed` box that fills its
 * container, the viewport the sample declares, which draws fixed at that viewport's size. `fits` is a
 * box that widens with its text and stops at its parent's content box, as `w-fit` does: it hugs short
 * text and fills past it, so the probe cannot tell the two apart, and either kind agrees. `unknown`
 * is a box without text whose root's container the probe could not widen, or whose container
 * follows the root's own text, so widening it shows nothing the page would do.
 */
export type InferredKind =
  | "fill"
  | "fill-viewport"
  | "hug"
  | "fixed"
  | "not-fill"
  | "tracks"
  | "overflows"
  | "fits"
  | "unknown";

/** How much a width must change, in CSS pixels, for the probe to read a change. */
const CHANGED = 1;

/**
 * Infer a box's horizontal sizing from its widths.
 *
 * @param box - The box as measured.
 * @returns What the deltas say.
 */
export function inferKind(box: ProbedBox): InferredKind {
  if (box.wider - box.base > CHANGED) {
    return box.fixedInViewport ? "fill-viewport" : "fill";
  }
  if (!box.text) {
    return box.widened ? "not-fill" : "unknown";
  }
  if (box.tracksParent && !box.root) {
    return "tracks";
  }
  if (box.overflows && !box.root) {
    return "overflows";
  }
  if (box.longer - box.base > CHANGED && box.capsAtParent && !box.root) {
    return "fits";
  }
  return box.longer - box.base > CHANGED ? "hug" : "fixed";
}

/**
 * Whether a mapped horizontal sizing agrees with what the probe inferred. A root that fills its host
 * draws fixed at the host's width, since a component's root has no parent in Figma.
 *
 * @param inferred - The inferred kind.
 * @param mapped - The layer's horizontal sizing.
 * @param root - Whether the box is a set's root.
 * @returns True where they agree.
 */
export function agrees(inferred: InferredKind, mapped: SizeSpec, root: boolean): boolean {
  switch (inferred) {
    case "fill":
      return mapped.kind === "fill" || (root && mapped.kind === "fixed");
    case "fill-viewport":
      return mapped.kind === "fixed" || mapped.kind === "fill";
    case "hug":
      return mapped.kind === "hug";
    case "fixed":
      return mapped.kind === "fixed";
    case "not-fill":
      return mapped.kind !== "fill";
    case "tracks":
    case "overflows":
    case "fits":
      return mapped.kind === "fill" || mapped.kind === "hug";
    case "unknown":
      return true;
  }
}

/**
 * Measure the cells of an opened page three times, restoring the page between runs.
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
    ({ roots, widerBy, longerBy, longestBy }) => {
      type Box = {
        slot: string;
        root: boolean;
        text: boolean;
        width: number;
        parent: number;
        fixed: boolean;
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
      const boxesOf = (root: Element): Box[] =>
        [root, ...root.querySelectorAll("[data-slot]")].map((element) => ({
          slot: element.getAttribute("data-slot") ?? "",
          root: element === root,
          text: [...element.querySelectorAll("*"), element].some((each) =>
            [...each.childNodes].some((node) => node.nodeType === 3 && (node.textContent ?? "").trim() !== "")
          ),
          width: element.getBoundingClientRect().width,
          parent: contentWidth(element.parentElement),
          fixed: getComputedStyle(element).position === "fixed",
        }));
      const measure = () =>
        roots.map(({ selectors }) =>
          selectors.flatMap((selector) => {
            const root = document.querySelector(selector);
            return root === null ? [] : boxesOf(root);
          })
        );
      const elementsOf = (selectors: readonly string[]) =>
        selectors.flatMap((selector) => {
          const root = document.querySelector(selector);
          return root === null ? [] : [root];
        });
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
      // Wider: each root's parent, the element its width fills.
      const widened: { element: HTMLElement; style: string | null }[] = [];
      const widenedRoots = new Set<Element>();
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
      const wider = measure();
      for (const { element, style } of widened) {
        if (style === null) {
          element.removeAttribute("style");
        } else {
          element.setAttribute("style", style);
        }
      }
      // Longer: each box's own text alone, so a sibling's text that cannot wrap does not widen it.
      const longer = roots.map(({ selectors }) =>
        selectors.flatMap((selector) => {
          const root = document.querySelector(selector);
          if (root === null) {
            return [];
          }
          return [root, ...root.querySelectorAll("[data-slot]")].map((element) => {
            const lengthened: { node: Node; text: string }[] = [];
            const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
              const text = node.textContent ?? "";
              if (text.trim() !== "") {
                lengthened.push({ node, text });
                node.textContent = text + longerBy;
              }
            }
            const measured = {
              width: element.getBoundingClientRect().width,
              parent: contentWidth(element.parentElement),
            };
            // Far longer, so a box that fits its text, as `w-fit` does, reaches its parent and wraps.
            for (const { node, text } of lengthened) {
              node.textContent = text + longerBy.repeat(longestBy);
            }
            const longest = {
              width: element.getBoundingClientRect().width,
              parent: contentWidth(element.parentElement),
            };
            for (const { node, text } of lengthened) {
              node.textContent = text;
            }
            return { ...measured, capped: Math.abs(longest.width - longest.parent) <= 1 };
          });
        })
      );
      return roots.map(({ id }, at) => ({
        id,
        gap: gaps[at],
        boxes: (base[at] ?? []).map((box, index) => ({
          slot: box.slot,
          root: box.root,
          text: box.text,
          base: box.width,
          wider: wider[at]?.[index]?.width ?? box.width,
          longer: longer[at]?.[index]?.width ?? box.width,
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
    { roots, widerBy: WIDER_BY, longerBy: LONGER_BY, longestBy: LONGEST_BY }
  );
}

/** One contradiction the probe found: the box, what it inferred and what the spec maps. */
export type Contradiction = {
  readonly cell: string;
  readonly slot: string;
  readonly inferred: InferredKind;
  readonly mapped: SizeSpec["kind"];
};

/** What the probe found of a set: each contradiction, and how many boxes it compared. */
export type Contradictions = {
  readonly found: readonly Contradiction[];
  readonly compared: number;
  /** How many compared boxes the probe inferred each kind for. */
  readonly inferred: ReadonlyMap<InferredKind, number>;
};

/** The frame and instance layers of a variant by key, each key that names one layer only. */
function layersByKey(root: ComponentRootSpec): ReadonlyMap<string, ChildLayerSpec> {
  const found = new Map<string, ChildLayerSpec[]>();
  const visit = (layer: ChildLayerSpec): void => {
    if (layer.kind === "frame" || layer.kind === "instance") {
      found.set(layer.key, [...(found.get(layer.key) ?? []), layer]);
    }
    if (layer.kind === "frame") {
      layer.children.forEach(visit);
    }
  };
  root.children.forEach(visit);
  return new Map(
    [...found].flatMap(([key, layers]) =>
      layers.length === 1 && layers[0] !== undefined ? [[key, layers[0]] as const] : []
    )
  );
}

/**
 * The contradictions between a set's mapped horizontal sizings and what the probe inferred of its
 * boxes. A box matches the layer whose key its manifest gives its `data-slot`, where one layer has
 * that key; a set's one root matches the variant's root.
 *
 * @param set - The built set.
 * @param probed - Each cell's boxes, by the variant key of its cell.
 * @param keyOfSlot - The key of the part each `data-slot` names in the manifest, where one part has it.
 * @returns Each contradiction, and how many boxes the probe compared.
 */
export function contradictions(
  set: Omit<ComponentSetSpec, "page">,
  probed: ReadonlyMap<string, ProbedCell>,
  keyOfSlot: ReadonlyMap<string, string>
): Contradictions {
  const found: Contradiction[] = [];
  let compared = 0;
  const counts = new Map<InferredKind, number>();
  for (const variant of set.variants) {
    const cell = probed.get(variant.key);
    if (cell === undefined) {
      continue;
    }
    const keyed = layersByKey(variant.root);
    const roots = cell.boxes.filter((box) => box.root);
    for (const box of cell.boxes) {
      // A set's one root is the variant's root; an open composite's roots are its instances.
      const key = keyOfSlot.get(box.slot);
      const layer =
        box.root && roots.length === 1 ? variant.root : key === undefined ? undefined : keyed.get(key);
      if (layer === undefined || !("sizing" in layer)) {
        continue;
      }
      compared += 1;
      const inferred = inferKind(box);
      counts.set(inferred, (counts.get(inferred) ?? 0) + 1);
      const isRoot = layer === variant.root;
      if (!agrees(inferred, layer.sizing.horizontal, isRoot)) {
        found.push({ cell: variant.key, slot: box.slot, inferred, mapped: layer.sizing.horizontal.kind });
      }
    }
  }
  return { found, compared, inferred: counts };
}
