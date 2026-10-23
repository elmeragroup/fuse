/**
 * React Aria's Link, as one component set on the Link page: each color variant at both weights, in
 * four states, 48 cells.
 *
 * `Link` renders React Aria Components' `Link`, an `<a data-rac>` with no `data-slot`, or a
 * `<span role="link" data-rac>` while disabled, and passes a `className` function that React Aria
 * calls with the link's render props. That function adds the state focus ring at `isFocusVisible`
 * and the rac-target disabled face at `isDisabled` to `linkVariants`, so a cell's classes are those
 * of the render props React Aria hands it in that state. A hover fades the link through
 * `enabled-hover:opacity-80`, which reads React Aria's `data-hovered` on an element marked
 * `data-rac`.
 *
 * The set crosses the two axes the docs demos vary, `variant` and `weight`. The demos vary
 * `truncate` too, but a link cuts its text only where its container is narrower than the text, as
 * the demo's `max-w-40` row is, and a link in a hugging Figma frame keeps its text's own width past
 * a limit (P7), so the set leaves it off. No demo varies `leading` or `align`, so the text keeps the
 * host page's line height and sets its line from the start.
 */
import { cn, focusRing, linkVariants, racDisabledStateFaceClass } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, ElementSelector } from "./component-spec";
import { HOST_TYPE } from "./host-type";
import { ownKey } from "./own-key";

type LinkVariant = keyof typeof linkVariants.variants.variant;
type LinkWeight = keyof typeof linkVariants.variants.weight;

const COLOR_CLASSES = linkVariants.variants.variant;

function isVariant(value: string | undefined): value is LinkVariant {
  return ownKey(COLOR_CLASSES, value);
}

function isWeight(value: string | undefined): value is LinkWeight {
  return ownKey(linkVariants.variants.weight, value);
}

/**
 * Every variant the recipe declares, in its order, so a new one reaches Figma too, except one whose
 * class repeats an earlier one's and so draws the same in every cell: `secondary`, the deprecated
 * alias of `foreground`, and `inherit`, which gives `default`'s `text-inherit`.
 */
const VARIANTS = Object.keys(COLOR_CLASSES)
  .filter(isVariant)
  .filter(
    (variant, index, all) =>
      all.findIndex((other) => COLOR_CLASSES[other] === COLOR_CLASSES[variant]) === index
  );

/** The weights in the recipe's order, its default `normal` first. */
const WEIGHTS = Object.keys(linkVariants.variants.weight).filter(isWeight);

/**
 * The text every cell shows, the default of the `Label` text property: the first link of the docs
 * Router demo. The compare renderer renders the same text.
 */
export const LINK_LABEL = "Invoice 1042";

/**
 * The link's element, which React Aria marks `data-rac`: an `<a>` while it is enabled and a
 * `<span role="link">` while it is disabled, so the selector names any element.
 */
const LINK_ELEMENT: ElementSelector = { tag: "*", attributes: { "data-rac": true } };

/**
 * The classes `Link` gives a cell: the recipe at the cell's variant and weight, the state focus ring
 * at the `isFocusVisible` React Aria hands it while a keyboard user focuses the link, and the
 * disabled face at its `isDisabled`.
 *
 * @throws When the cell names a variant or weight the recipe does not declare, a defect in the
 *   caller's cell.
 */
function classesFor(cell: Cell): string {
  const { variant, weight } = cell;
  if (!isVariant(variant) || !isWeight(weight)) {
    throw new Error(`Link has no variant ${variant ?? ""} or weight ${weight ?? ""}`);
  }
  const isFocusVisible = cell.state === "focus";
  const isDisabled = cell.state === "disabled";
  return cn(
    linkVariants({ variant, weight }),
    focusRing({ target: "state", isFocusVisible }).root(),
    isDisabled && racDisabledStateFaceClass
  );
}

/** A link, as `<Link href="/invoices/1042">Invoice 1042</Link>` at a variant and weight. */
export const LINK: ComponentDefinition = {
  key: "link",
  name: "Link",
  slot: "link",
  element: LINK_ELEMENT,
  rootKind: "react-aria-element",
  inheritedFor: () => HOST_TYPE,
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "weight", values: WEIGHTS },
    { name: "state", values: ["rest", "hover", "focus", "disabled"] },
  ],
  columnAxis: "state",
  classesFor,
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: {
    key: "label",
    name: "label",
    characters: LINK_LABEL,
    textProperty: "Label",
    shownIn: () => true,
  },
  iconsFor: () => [],
  swapProperties: [],
};
