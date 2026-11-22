/**
 * The one shape of an absolute icon the kit places out of its box's flow, and the reason any other
 * shape stays in the flow. The kit draws a placed icon as its box's last layer, so Figma paints it
 * over every other layer of the box and under every layer that follows the box up to the root. CSS
 * paints the icon by stacking and tree order instead, and lays it out against its containing block.
 * The build proves the two agree only for the shape Accordion's `infodropdown` trigger gives its
 * caret, and refuses every other, so a shape it has not seen never places:
 *
 * - The icon and its box win only the properties the caret and the trigger win, {@link ICON_PROPERTIES}
 *   and {@link BOX_PROPERTIES}, and style no `::before` or `::after`. A reason names the first other
 *   property in the capture's order, a custom property only where none other wins.
 * - No element precedes the icon, its box, or an element between the box and the root. Text may: the
 *   trigger's label precedes its caret, and CSS and Figma both paint text under the icon.
 * - Nothing follows the icon in its box. Where something follows the box, or an element around it,
 *   their parent lays its children out as a block column, and each later layer, with everything
 *   below it, wins only {@link LATER_PROPERTIES}, as the open item's panel does. A later layer then
 *   sits below the box, takes no position, margin, transform or shadow that could reach the icon,
 *   and Figma's column puts it below the box too.
 * - Each element between the box and the root wins only {@link AROUND_PROPERTIES}, as the header
 *   does, so none sizes itself to let the box reach past it. The root styles no `::before` or
 *   `::after` where it is not the box.
 * - The capture measured the facts `uncovered.ts` reads: `uncovered`, `still` and `iconPlace`.
 *
 * Custom properties take effect only through a property that reads them, so each list names the
 * custom properties the caret's elements win alongside the others. Whether the place the build plans
 * matches the measured one is `components/absolute-icon.ts`'s to say.
 */
import type { IconAcceptance } from "../components/box-cascade.ts";
import { textsOf } from "./capture-format.ts";
import type { CapturedDeclaration, CapturedElement } from "./capture-format.ts";
import { isReset } from "./instance-twin.ts";

/** What the caret's `<svg>` wins: `size-4 shrink-0 transition-transform duration-200 absolute right-0 text-foreground`, its turn, and the resets that are not initial. */
export const ICON_PROPERTIES: ReadonlySet<string> = new Set([
  "border",
  "border-color",
  "box-sizing",
  "color",
  "display",
  "flex-shrink",
  "height",
  "overflow-clip-margin",
  "overflow-x",
  "overflow-y",
  "position",
  "right",
  "rotate",
  "transition-duration",
  "transition-property",
  "transition-timing-function",
  "vertical-align",
  "width",
  "--tw-duration",
]);

/** What the `infodropdown` trigger wins in its four states, the caret's box. */
export const BOX_PROPERTIES: ReadonlySet<string> = new Set([
  "align-items",
  "appearance",
  "background-color",
  "border-color",
  "border-style",
  "box-shadow",
  "box-sizing",
  "color",
  "cursor",
  "display",
  "flex",
  "font",
  "font-weight",
  "gap",
  "justify-content",
  "opacity",
  "outline-color",
  "outline-style",
  "outline-width",
  "position",
  "text-align",
  "text-decoration-line",
  "--tw-font-weight",
  "--tw-outline-style",
  "--tw-ring-color",
  "--tw-ring-shadow",
]);

/** What the header wins, the one element between the caret's box and the item. */
export const AROUND_PROPERTIES: ReadonlySet<string> = new Set([
  "border-color",
  "border-style",
  "box-sizing",
  "display",
  "unicode-bidi",
]);

/** What the open item's panel and everything below it win, the one layer after the caret's header. */
export const LATER_PROPERTIES: ReadonlySet<string> = new Set([
  "animation-name",
  "border",
  "border-color",
  "border-style",
  "box-sizing",
  "display",
  "height",
  "overflow",
  "padding-left",
  "padding-top",
  "transition-duration",
  "transition-property",
  "transition-timing-function",
  "unicode-bidi",
  "--accordion-panel-height",
  "--accordion-panel-width",
  "--tw-duration",
  "--tw-ease",
]);

/** The block displays whose children lay out as a column, one below another (CSS 2.1 §9.4.1). */
const COLUMNS: ReadonlySet<string> = new Set(["block", "flow-root"]);

const ICON_WINS = (property: string) =>
  `the absolute icon wins \`${property}\`, which no absolute icon the kit places wins (\`ICON_PROPERTIES\`)`;
const BOX_WINS = (property: string) =>
  `the absolute icon's box wins \`${property}\`, which no box of an icon the kit places wins (\`BOX_PROPERTIES\`)`;
const AROUND_WINS = (property: string) =>
  `an element between the absolute icon's box and the captured root wins \`${property}\`, which none around a placed icon wins (\`AROUND_PROPERTIES\`)`;
const LATER_WINS = (property: string) =>
  `a layer after the absolute icon's box wins \`${property}\`, which no later layer beside a placed icon wins (\`LATER_PROPERTIES\`), and it can reach over the icon, where Figma draws it on top`;
const EARLIER =
  "an element precedes the absolute icon, its box or an element around it, where CSS can paint it over the icon and Figma draws it under";
const FOLLOWED = "an element or a text follows the absolute icon in its box, which Figma draws over the icon";
const NO_COLUMN =
  "a layer follows the absolute icon's box, or an element around it, in a parent that is no block column, so it can sit beside the icon, where Figma draws it on top";
const GENERATED =
  "the captured root styles a `::before` or `::after`, which can paint beside the absolute icon's box, where Figma draws it in the root's frame";
const UNCOVERED =
  "the capture did not measure CSS painting nothing over the absolute icon in every mode (`uncovered`), while Figma draws the icon over every layer of its box";
const MOVING =
  "the capture did not read `animation-name: none` on every element of the captured root in every mode, without and with reduced motion (`still`), so a consumer's page can run an animation the capture's page stops";
const UNPLACED =
  "the capture measured no one size for the absolute icon inside its box in every mode and as the box grows (`iconPlace`)";

/** The properties an element wins as the build's cascade keeps them: the reset a base sheet sets aside. */
function wins(element: CapturedElement, declarations: readonly CapturedDeclaration[]): readonly string[] {
  const own = element.declarations.flatMap((index) => {
    const declaration = declarations[index];
    return declaration === undefined || isReset(declaration, index, element.initial)
      ? []
      : [declaration.property];
  });
  const pseudo = Object.entries(element.pseudo).flatMap(([name, indexes]) =>
    indexes.length > 0 ? [`::${name}`] : []
  );
  return [...own, ...pseudo];
}

/** The first property an element wins outside a set, a custom property only where it wins no other, or undefined. */
function outside(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[],
  allowed: ReadonlySet<string>
): string | undefined {
  const others = wins(element, declarations).filter((property) => !allowed.has(property));
  return others.find((property) => !property.startsWith("--")) ?? others[0];
}

/** The element and everything below it. */
function subtree(element: CapturedElement): readonly CapturedElement[] {
  return [element, ...element.children.flatMap(subtree)];
}

/**
 * The `display` an element's own declarations give it, the browser's `block` for a `<div>` included,
 * or undefined where it wins none.
 */
function displayOf(
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[]
): string | undefined {
  return element.declarations
    .map((index) => declarations[index])
    .findLast((declaration) => declaration?.longhands.includes("display") === true)
    ?.value.trim();
}

/**
 * Why a level of the chain is outside the shape: the element among its parent's children, where
 * `level` says whether the element is the icon in its box or an element at or above the box.
 */
function levelRefusal(
  parent: CapturedElement,
  element: CapturedElement,
  declarations: readonly CapturedDeclaration[],
  level: "icon" | "around"
): string | undefined {
  const place = parent.children.indexOf(element);
  if (place > 0) {
    return EARLIER;
  }
  const later = parent.children.slice(place + 1);
  const textAfter = textsOf(parent)
    .slice(place + 1)
    .some((text) => text.trim() !== "");
  if (later.length === 0 && !textAfter) {
    return undefined;
  }
  if (level === "icon") {
    return FOLLOWED;
  }
  const display = displayOf(parent, declarations);
  if (display === undefined || !COLUMNS.has(display)) {
    return NO_COLUMN;
  }
  for (const each of later.flatMap(subtree)) {
    const property = outside(each, declarations, LATER_PROPERTIES);
    if (property !== undefined) {
      return LATER_WINS(property);
    }
  }
  return undefined;
}

/**
 * Whether the capture holds an absolute icon in the one shape the kit places, as the module says.
 *
 * @param chain - The elements from the captured root down to the icon's `<svg>`, its box last but one.
 * @param declarations - The capture's declarations.
 * @returns The acceptance, with the place the capture measured, or the reason it is not the shape.
 */
export function iconAcceptance(
  chain: readonly CapturedElement[],
  declarations: readonly CapturedDeclaration[]
): IconAcceptance {
  const icon = chain.at(-1);
  const box = chain.at(-2);
  if (icon === undefined || box === undefined) {
    return { kind: "refused", why: UNCOVERED };
  }
  const own = outside(icon, declarations, ICON_PROPERTIES);
  const boxes = outside(box, declarations, BOX_PROPERTIES);
  const [root] = chain;
  const generated =
    root !== undefined && root !== box && Object.values(root.pseudo).some((each) => each.length > 0);
  const around = chain
    .slice(1, -2)
    .map((element) => outside(element, declarations, AROUND_PROPERTIES))
    .find((property) => property !== undefined);
  const level = chain
    .slice(1)
    .map((element, index) => {
      const parent = chain[index];
      return parent === undefined
        ? undefined
        : levelRefusal(parent, element, declarations, element === icon ? "icon" : "around");
    })
    .findLast((why) => why !== undefined);
  const why =
    own !== undefined
      ? ICON_WINS(own)
      : boxes !== undefined
        ? BOX_WINS(boxes)
        : around !== undefined
          ? AROUND_WINS(around)
          : generated
            ? GENERATED
            : level;
  if (why !== undefined) {
    return { kind: "refused", why };
  }
  const { measured } = icon;
  if (measured?.uncovered !== true) {
    return { kind: "refused", why: UNCOVERED };
  }
  if (measured.still !== true) {
    return { kind: "refused", why: MOVING };
  }
  return measured.iconPlace === undefined
    ? { kind: "refused", why: UNPLACED }
    : { kind: "accepted", place: measured.iconPlace };
}
