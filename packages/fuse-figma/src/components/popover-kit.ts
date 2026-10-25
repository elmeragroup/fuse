/**
 * Popover, as two component sets on a page of their own: the popup the docs Basic demo opens, and
 * that popup open below its trigger.
 *
 * - `Popover content` is the popup, 1 cell: `Popover.Content` renders Base UI's `<div
 *   data-slot="popover-content">` with the `content` slot of `popoverVariants`. It is the shared
 *   surface on the Popover shell: `bg-popover`, `shadow-md` and a 1px `foreground/10` ring, rounded
 *   `radius-md`, padded `surface-pad-md`, 288px wide, its parts 16px apart. It holds the docs Basic
 *   demo: a header with the title `Dimensions` and the description, each a TEXT property, and two
 *   vertical Fields, `Width` and `Height`, each a `Label` instance above an `Input` instance. The
 *   Field stretches both to its width, which the instances draw by filling it. The demo's inputs hold
 *   no placeholder and no value, so each Input instance's `Text` is empty.
 * - `Popover (open)` is the outline Button trigger, `Details`, with the popup open below it, 1 cell.
 *   Base UI places the popup under the trigger, 4px below it and centered on it, so the composite is
 *   a column of the trigger's instance and the popup's, centered. The column clips nothing, so the
 *   popup's shadow shows (PQ1).
 * - The arrow is left out: `showArrow` draws it as a rotated, bordered pseudo-element, and the docs
 *   Basic demo shows none.
 */
import { fieldVariants, popoverVariants } from "@elmeragroup/fuse/recipe-catalog";

import { BUTTON } from "./button-kit";
import type { Cell, ComponentDefinition, InstanceDefinition, PartDefinition } from "./component-spec";
import { FIELD_ROOT_SR_ONLY, FIELD_ROOT_STRETCH } from "./field-box-kit";
import { INPUT } from "./input-kit";
import { LABEL_OMITTED_COMPOSITIONS } from "./label-kit";
import {
  POPOVER_DESCRIPTION_TEXT,
  POPOVER_FIELD_LABELS,
  POPOVER_TITLE_TEXT,
  POPOVER_TRIGGER_TEXT,
} from "./popover-text";

const { content, header, title, description } = popoverVariants();

const always = (): boolean => true;
const never = (): boolean => false;

/**
 * The variants the popup's cell holds: `data-open` and the side Base UI stamps on an open popup below
 * its trigger, which the popup's motion classes read, and the enabled Field around each label.
 */
const POPUP_FACTS: ReadonlyMap<string, (cell: Cell) => boolean> = new Map([
  // The demo's Fields are enabled, so the label's disabled face never holds.
  ["group-data-disabled/field", never],
  ["data-open", always],
  ["data-closed", never],
  ["data-[side=bottom]", always],
  ...["top", "left", "right", "inline-start", "inline-end"].map(
    (side) => [`data-[side=${side}]`, never] as const
  ),
]);

/** The title, Base UI's `<h2>`. */
const TITLE: PartDefinition = {
  key: "title",
  slot: "popover-title",
  shownIn: always,
  classesFor: () => title(),
  elementDefaults: [{ className: "user agent style sheet, h2", property: "display", value: "block" }],
  label: {
    key: "text",
    name: "text",
    characters: POPOVER_TITLE_TEXT,
    textProperty: "Title",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The description, Base UI's `<p>`. */
const DESCRIPTION: PartDefinition = {
  key: "description",
  slot: "popover-description",
  shownIn: always,
  classesFor: () => description(),
  elementDefaults: [{ className: "user agent style sheet, p", property: "display", value: "block" }],
  label: {
    key: "text",
    name: "text",
    characters: POPOVER_DESCRIPTION_TEXT,
    textProperty: "Description",
    shownIn: always,
  },
  iconsFor: () => [],
};

/** The header that stacks the title and the description. */
const HEADER: PartDefinition = {
  key: "header",
  slot: "popover-header",
  shownIn: always,
  classesFor: () => header(),
  label: undefined,
  iconsFor: () => [],
  parts: [TITLE, DESCRIPTION],
};

/**
 * A vertical `Field.Root` holding a `Field.Label` and an `<Input />`, as the docs Basic demo writes
 * each. The label is a frame with its own text, since the Field stretches it and its text fills it,
 * which a `Label` instance cannot draw. The input is an instance with no text, since the demo's input
 * holds neither a placeholder nor a value.
 */
function fieldOf(label: string): PartDefinition {
  const key = label.toLowerCase();
  const input: InstanceDefinition = {
    kind: "instance",
    key: `input-${key}`,
    of: INPUT,
    cell: () => ({ content: "value", state: "rest" }),
    properties: () => ({ text: { Text: "" } }),
    shownIn: always,
    exposed: true,
  };
  return {
    key: `field-${key}`,
    slot: "field",
    shownIn: always,
    classesFor: () => fieldVariants().root(),
    label: undefined,
    iconsFor: () => [],
    parts: [
      {
        key: `label-${key}`,
        slot: "field-label",
        shownIn: always,
        classesFor: () => fieldVariants().label(),
        label: {
          key: "label",
          name: "label",
          characters: label,
          textProperty: `${label} label`,
          shownIn: always,
        },
        iconsFor: () => [],
      },
      input,
    ],
  };
}

/** The open popup, as `<Popover.Content>` holding the docs Basic demo's header and Fields. */
export const POPOVER_CONTENT: ComponentDefinition = {
  key: "popover-content",
  name: "Popover content",
  slot: "popover-content",
  axes: [{ name: "content", values: ["basic"] }],
  columnAxis: "content",
  classesFor: () => content(),
  states: {},
  facts: POPUP_FACTS,
  // The popup holds focus only while a keyboard user tabs to it, and the kit draws it at rest.
  omittedStates: new Set(["focus-visible"]),
  omittedCompositions: new Map([
    ...LABEL_OMITTED_COMPOSITIONS,
    FIELD_ROOT_SR_ONLY,
    [
      FIELD_ROOT_STRETCH,
      "the Field stretches its label and input to its width: the input's own `w-full` already takes it, and the label paints nothing past its text",
    ],
  ]),
  label: undefined,
  iconsFor: () => [],
  parts: [HEADER, ...POPOVER_FIELD_LABELS.map(fieldOf)],
  swapProperties: [],
};

/**
 * The open Popover: the outline Button trigger and the popup below it. The composite has no element
 * of its own: the column draws Base UI's placement, the popup 4px below the trigger and centered on
 * it.
 */
export const POPOVER_OPEN: ComponentDefinition = {
  key: "popover-open",
  name: "Popover (open)",
  slot: "popover-open",
  axes: [{ name: "placement", values: ["below"] }],
  columnAxis: "placement",
  classesFor: () => "flex flex-col items-center gap-1",
  // The popup's shadow reaches past the column below and beside it.
  rootOverflow: "visible",
  states: {},
  facts: new Map(),
  omittedStates: new Set(),
  label: undefined,
  iconsFor: () => [],
  parts: [
    {
      kind: "instance",
      key: "trigger",
      of: BUTTON,
      cell: () => ({ variant: "outline", size: "default", state: "rest", icon: "none" }),
      properties: () => ({ text: { Label: POPOVER_TRIGGER_TEXT } }),
      // `Popover.Trigger` renders the Button with its own slot, and Base UI marks it expanded and
      // `data-popup-open` while the popup is open. The outline Button paints `aria-expanded:` alone.
      slot: "popover-trigger",
      facts: new Map([
        ["aria-expanded", always],
        ["data-popup-open", always],
      ]),
      shownIn: always,
      exposed: true,
    },
    {
      kind: "instance",
      key: "content",
      of: POPOVER_CONTENT,
      cell: () => ({ content: "basic" }),
      shownIn: always,
    },
  ],
  swapProperties: [],
};
