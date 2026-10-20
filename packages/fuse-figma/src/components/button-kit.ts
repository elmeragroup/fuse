/**
 * Button, as two component sets. `Button` holds every variant of the recipe at the four label
 * sizes, in five states, with no icon, a start icon or an end icon: 420 cells. `Icon button`
 * holds every variant at the four square sizes in five states, 140 cells, each an icon with no
 * label.
 *
 * - `default` and `secondary` fill with a bound color. `outline` draws a border whose width is
 *   a variable and casts a shadow whose blur and spread are formulas over it. `destructive` and
 *   `success` fill and stroke with role tints such as `error/10`. `ghost` fills only on hover,
 *   and `link` draws no box and underlines on hover.
 * - Each size reads its own row of the `Fuse density` control metrics.
 * - The states map Fuse's state variants onto one `state` axis. Hover comes from
 *   `enabled-hover:`, focus from `focus-visible:` and disabled from the three disabled faces.
 *   Pending is the disabled face plus a spinner in the leading slot, as `isPending` renders it.
 * - An icon moves the padding on its side through `has-data-[icon=inline-*]:`. Each icon is an
 *   instance of the kit's icon components, which a swap property picks.
 * - `icon-inline` stays out. It takes its size from the surrounding text line, which a
 *   standalone component does not have.
 */
import { buttonVariants } from "@elmeragroup/fuse/recipe-catalog";

import type { Cell, ComponentDefinition, IconSlot } from "./component-spec";

type ButtonVariant = keyof typeof buttonVariants.variants.variant;
type ButtonSize = keyof typeof buttonVariants.variants.size;

/** Every variant the recipe declares, in its order, so a new variant reaches Figma too. */
const VARIANTS = Object.keys(buttonVariants.variants.variant).filter(isVariant);

/**
 * The sizes in the recipe's order, with its default first. Figma makes the top-left variant a
 * set's default, so an instance a designer places starts at the size `<Button>` renders.
 */
const LABEL_SIZES = ["default", "xs", "sm", "lg"] as const satisfies readonly ButtonSize[];
const ICON_SIZES = ["icon", "icon-xs", "icon-sm", "icon-lg"] as const satisfies readonly ButtonSize[];

function isVariant(value: string | undefined): value is ButtonVariant {
  return value !== undefined && Object.hasOwn(buttonVariants.variants.variant, value);
}

function isSize(value: string | undefined): value is ButtonSize {
  return value !== undefined && Object.hasOwn(buttonVariants.variants.size, value);
}

function classesFor(cell: Cell): string {
  const { variant, size } = cell;
  if (!isVariant(variant) || !isSize(size)) {
    throw new Error(`Button has no variant ${variant ?? ""} or size ${size ?? ""}`);
  }
  return buttonVariants({ variant, size });
}

const inState = (state: string) => (cell: Cell) => cell.state === state;

const STATE_AXIS = { name: "state", values: ["rest", "hover", "focus", "disabled", "pending"] };

/**
 * The state variants and the cells they hold in. A disabled Button is a native disabled
 * button, which Base UI also marks `data-disabled`. A pending Button stays focusable, so Base
 * UI marks it `aria-disabled` and `data-disabled` instead of `disabled`. Either way the state
 * face draws the disabled look.
 */
const STATE_CONDITIONS = [
  ["enabled-hover", inState("hover")],
  ["focus-visible", inState("focus")],
  ["disabled", inState("disabled")],
  ["data-disabled", (cell: Cell) => cell.state === "disabled" || cell.state === "pending"],
  ["aria-disabled", inState("pending")],
  ["data-[pending-indicator]", inState("pending")],
] as const;

/**
 * The states the recipe styles and the kit leaves out. An invalid or expanded Button belongs
 * to a form or a menu trigger, the press offset to a moment of interaction, and the group
 * corners to a Button group, none of which a standalone component shows.
 */
const OMITTED_STATES = new Set([
  "aria-invalid",
  "data-invalid",
  "aria-expanded",
  "enabled-active",
  "in-data-[slot=button-group]",
]);

/**
 * The child selectors of the recipe. `[&_svg]` reaches every icon, the spinner's included.
 * `[&>svg:not([data-icon=inline-end])]` reaches only an `<svg>` child of the root that is not
 * an end icon, which a pending Button hides.
 */
const CHILD_SELECTORS = new Map<string, (slot: IconSlot) => boolean>([
  ["[&_svg]", () => true],
  ["[&_svg:not([class*='size-'])]", () => true],
  ["[&>svg:not([data-icon=inline-end])]", (slot) => slot.direct && slot.dataIcon !== "inline-end"],
]);

/** The spinner `isPending` renders in a span that carries `data-icon="inline-start"`. */
const SPINNER: IconSlot = {
  key: "spinner",
  name: "Spinner",
  side: "start",
  direct: false,
  dataIcon: "inline-start",
  icon: "SpinnerGap",
  swapProperty: undefined,
};

const START_ICON: IconSlot = {
  key: "icon-start",
  name: "Start icon",
  side: "start",
  direct: true,
  dataIcon: "inline-start",
  icon: "Plus",
  swapProperty: "Start icon",
};

const END_ICON: IconSlot = {
  key: "icon-end",
  name: "End icon",
  side: "end",
  direct: true,
  dataIcon: "inline-end",
  icon: "ArrowRight",
  swapProperty: "End icon",
};

/** The one icon of an icon button, a bare `<svg>` child, as `<Button size="icon"><Plus /></Button>`. */
const ONLY_ICON: IconSlot = {
  key: "icon-only",
  name: "Icon",
  side: "start",
  direct: true,
  dataIcon: undefined,
  icon: "Plus",
  swapProperty: "Icon",
};

/** The swap property of each slot that has one, starting with the slot's icon. */
function swapProperties(slots: readonly IconSlot[]): ComponentDefinition["swapProperties"] {
  return slots.flatMap((slot) =>
    slot.swapProperty === undefined ? [] : [{ name: slot.swapProperty, defaultIcon: slot.icon }]
  );
}

/** The spinner when the cell is pending, then the icons the cell's `icon` value places. */
function buttonIcons(cell: Cell): readonly IconSlot[] {
  const pending = cell.state === "pending" ? [SPINNER] : [];
  switch (cell.icon) {
    case "start":
      return [...pending, START_ICON];
    case "end":
      return [...pending, END_ICON];
    default:
      return pending;
  }
}

export const BUTTON: ComponentDefinition = {
  key: "button",
  name: "Button",
  slot: "button",
  axes: [
    { name: "variant", values: VARIANTS },
    { name: "size", values: LABEL_SIZES },
    STATE_AXIS,
    { name: "icon", values: ["none", "start", "end"] },
  ],
  columnAxis: "state",
  classesFor,
  conditions: new Map([
    ...STATE_CONDITIONS,
    // The spinner's span carries `data-icon="inline-start"`, so a pending cell takes the start
    // icon's padding even with no icon of its own.
    ["has-data-[icon=inline-start]", (cell: Cell) => cell.icon === "start" || cell.state === "pending"],
    ["has-data-[icon=inline-end]", (cell: Cell) => cell.icon === "end"],
  ]),
  omittedStates: OMITTED_STATES,
  childSelectors: CHILD_SELECTORS,
  label: { key: "label", name: "label", characters: "Button", textProperty: "Label" },
  iconsFor: buttonIcons,
  swapProperties: swapProperties([START_ICON, END_ICON]),
};

/** The square sizes, as `<Button size="icon">` renders them around a lone icon. */
export const ICON_BUTTON: ComponentDefinition = {
  key: "icon-button",
  name: "Icon button",
  slot: "button",
  axes: [{ name: "variant", values: VARIANTS }, { name: "size", values: ICON_SIZES }, STATE_AXIS],
  columnAxis: "state",
  classesFor,
  conditions: new Map([...STATE_CONDITIONS, ["has-data-[icon=inline-start]", inState("pending")]]),
  omittedStates: OMITTED_STATES,
  childSelectors: CHILD_SELECTORS,
  label: undefined,
  iconsFor: (cell) => (cell.state === "pending" ? [SPINNER, ONLY_ICON] : [ONLY_ICON]),
  swapProperties: swapProperties([ONLY_ICON]),
};
