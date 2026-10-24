/**
 * The variants `src/compare/kit-markup.test.ts` checks each kit definition's state table against, as
 * Tailwind and fuse.css compile them: the attribute variants an element carries, the group variants
 * an element above it carries, the peer variants a sibling before it carries, the parent-context and
 * tag variants, and the variants static markup cannot show. A definition whose state table names a
 * variant none of them lists fails the suite.
 */
import type { MarkupElement } from "./static-markup.ts";

/**
 * Whether an element matches fuse.css's `data-active:`, which reads `[data-state="active"]` or a
 * `data-active` that is not `"false"`.
 */
function isActive(element: MarkupElement): boolean {
  const active = element.attributes.get("data-active");
  return element.attributes.get("data-state") === "active" || (active !== undefined && active !== "false");
}

/**
 * Whether an element matches each attribute variant, as Tailwind and fuse.css compile it:
 * `disabled:` is `:disabled`, which a `<button>` matches through its attribute, `aria-*:` matches
 * the value `true`, and `data-*:` matches the attribute's presence.
 */
export const ATTRIBUTE_VARIANTS = new Map<string, (element: MarkupElement) => boolean>([
  ["disabled", (element) => element.attributes.has("disabled")],
  ["data-disabled", (element) => element.attributes.has("data-disabled")],
  ["aria-disabled", (element) => element.attributes.get("aria-disabled") === "true"],
  ["aria-pressed", (element) => element.attributes.get("aria-pressed") === "true"],
  ["data-pressed", (element) => element.attributes.has("data-pressed")],
  ["data-checked", (element) => element.attributes.has("data-checked")],
  ["data-unchecked", (element) => element.attributes.has("data-unchecked")],
  ["data-indeterminate", (element) => element.attributes.has("data-indeterminate")],
  // `aria-checked:` compiles to `[aria-checked="true"]`, which a mixed checkbox's
  // `aria-checked="mixed"` does not match.
  ["aria-checked", (element) => element.attributes.get("aria-checked") === "true"],
  ["aria-invalid", (element) => element.attributes.get("aria-invalid") === "true"],
  ["data-invalid", (element) => element.attributes.has("data-invalid")],
  ["data-[pending-indicator]", (element) => element.attributes.has("data-pending-indicator")],
  // `data-[armed=true]:` compiles to `[data-armed="true"]`, which ConfirmButton stamps while armed.
  ["data-[armed=true]", (element) => element.attributes.get("data-armed") === "true"],
  // fuse.css defines `data-horizontal:` and `data-vertical:` on `[data-orientation=…]`.
  ["data-horizontal", (element) => element.attributes.get("data-orientation") === "horizontal"],
  ["data-vertical", (element) => element.attributes.get("data-orientation") === "vertical"],
  // `placeholder:` styles `::placeholder`, which a control paints while it has a placeholder and no
  // value. React writes an input's `defaultValue` as the `value` attribute, and a textarea's as its
  // own text.
  [
    "placeholder",
    (element) =>
      element.attributes.has("placeholder") && (element.attributes.get("value") ?? element.text) === "",
  ],
  // The field box's read-only fill keys off the `readonly` attribute on an enabled control.
  [
    "[&[readonly]:not(:disabled)]",
    (element) => element.attributes.has("readonly") && !element.attributes.has("disabled"),
  ],
  // Base UI stamps `data-placeholder` on a Select trigger while nothing is selected.
  ["data-placeholder", (element) => element.attributes.has("data-placeholder")],
  // Base UI stamps `data-popup-open` on a Select or Navigation menu trigger while its popup is open.
  ["data-popup-open", (element) => element.attributes.has("data-popup-open")],
  // fuse.css defines `data-active:` on `[data-state="active"]` and on a `data-active` that is not
  // `"false"`, which a Sidebar row's `useRender` stamps while it is the current item.
  ["data-active", isActive],
  // tailwindcss-react-aria-components compiles `invalid:` to `[data-invalid]` on an element marked
  // `data-rac`, and to `:invalid` on any other, a validity static markup does not hold, which no
  // set reads.
  ["invalid", (element) => element.attributes.has("data-rac") && element.attributes.has("data-invalid")],
]);

/**
 * The variants that read `data-hovered` on an element marked `data-rac`, which React Aria stamps
 * while the pointer is over it: tailwindcss-react-aria-components compiles `hover:` there to
 * `[data-hovered]`, and fuse.css's `enabled-hover:` reads `[data-rac][data-hovered]` on an element
 * that is not disabled.
 */
export const REACT_ARIA_HOVER = ["hover", "enabled-hover"];

/** Whether an element carries a group marker, such as `group/field`, in its `class`. */
function marks(element: MarkupElement, marker: string): boolean {
  return (element.attributes.get("class") ?? "").split(/\s+/).includes(marker);
}

/**
 * Whether an ancestor matches each group variant, which selects the elements below it:
 * `group-data-disabled/field:` compiles to `:where(.group\/field)[data-disabled] *`, so it holds
 * below an element that carries the `group/field` marker and `data-disabled`, as a disabled
 * `Field.Root` does, and `group-data-[popup-open]/select-trigger:` holds below an open Select
 * trigger, as its caret is.
 */
export const GROUP_VARIANTS = new Map<string, (ancestor: MarkupElement) => boolean>([
  [
    "group-data-disabled/field",
    (ancestor) => marks(ancestor, "group/field") && ancestor.attributes.has("data-disabled"),
  ],
  [
    "group-data-[popup-open]/select-trigger",
    (ancestor) => marks(ancestor, "group/select-trigger") && ancestor.attributes.has("data-popup-open"),
  ],
  // An open Navigation menu trigger carries `data-popup-open`, which its caret reads.
  [
    "group-data-popup-open/navigation-menu-trigger",
    (ancestor) =>
      marks(ancestor, "group/navigation-menu-trigger") && ancestor.attributes.has("data-popup-open"),
  ],
  // An open Accordion item's trigger carries `data-panel-open`, which its caret reads.
  [
    "group-data-[panel-open]/accordion-trigger",
    (ancestor) => marks(ancestor, "group/accordion-trigger") && ancestor.attributes.has("data-panel-open"),
  ],
  // `group-data-[size=sm]/item:` holds below an Item row that carries `data-size="sm"`, as the image
  // media's `size-8` does.
  ...["default", "sm", "xs"].map((size): [string, (ancestor: MarkupElement) => boolean] => [
    `group-data-[size=${size}]/item`,
    (ancestor) => marks(ancestor, "group/item") && ancestor.attributes.get("data-size") === size,
  ]),
  // A collapsed `Sidebar.Root` carries the `group` marker and `data-collapsible="icon"`, which its rows
  // read as the icon rail.
  [
    "group-data-[collapsible=icon]",
    (ancestor) => marks(ancestor, "group") && ancestor.attributes.get("data-collapsible") === "icon",
  ],
]);

/**
 * Whether an element at, below or around the measured element matches each attribute variant its own
 * classes name, as a Navigation menu trigger's caret writes its Root's side in `data-side` and reads
 * it through `data-[side=bottom]:`, which compiles to `[data-side="bottom"]`, and as Base UI stamps an
 * open Select popup `data-open` and its side, and Fuse its `data-align-trigger`, which the popup's
 * own classes read around each row.
 */
export const NAMED_ATTRIBUTE_VARIANTS = new Map<string, (element: MarkupElement) => boolean>([
  ...["bottom", "left", "right", "top", "inline-end", "inline-start"].map(
    (side): [string, (element: MarkupElement) => boolean] => [
      `data-[side=${side}]`,
      (element) => element.attributes.get("data-side") === side,
    ]
  ),
  ["data-open", (element) => element.attributes.has("data-open")],
  ["data-closed", (element) => element.attributes.has("data-closed")],
  ["data-[align-trigger=true]", (element) => element.attributes.get("data-align-trigger") === "true"],
]);

/**
 * Whether a sibling before the measured element matches each peer variant, which selects the
 * elements after it: `peer-data-active/menu-button:` compiles to `:is(:where(.peer\/menu-button)…
 * ~ *)`, so it holds after an element that carries the `peer/menu-button` marker and is active, as a
 * Sidebar menu badge holds after its active menu button.
 */
export const PEER_VARIANTS = new Map<string, (sibling: MarkupElement) => boolean>([
  ["peer-data-active/menu-button", (sibling) => marks(sibling, "peer/menu-button") && isActive(sibling)],
]);

/**
 * Whether the measured root holds what a parent-context variant reads, for each part directly below
 * it: fuse.css's `item-described:` compiles to
 * `:where(:has( > [data-slot="item-content"] > [data-slot="item-description"])) > &`, so it holds on
 * the children of a row whose content column holds a description.
 */
export const PARENT_VARIANTS = new Map<
  string,
  (elements: readonly MarkupElement[], parent: number) => boolean
>([
  [
    "item-described",
    (elements, parent) =>
      elements.some(
        (content, index) =>
          content.parent === parent &&
          content.attributes.get("data-slot") === "item-content" &&
          elements.some(
            (description) =>
              description.parent === index && description.attributes.get("data-slot") === "item-description"
          )
      ),
  ],
]);

/**
 * The variants that test the root's own tag: `[a]:` compiles to `:is(a)`. Each is checked on a set
 * whose definition gives it a meaning, since a link root of a set that never reads it, as React Aria's
 * Link, is an `<a>` too.
 */
export const TAG_VARIANTS = new Map<string, (element: MarkupElement) => boolean>([
  ["[a]", (element) => element.name === "a"],
]);

/**
 * The condition variants static markup cannot check against the measured element's attributes:
 * the pseudo classes the page forces, on the measured element or on the sibling a peer variant
 * reads, `focus` among them for a highlighted menu row, the icon edge, which holds on a descendant, the breakpoints, which the page's viewport
 * decides, and `ltr:`, which the page's direction decides, left to right on the compare page.
 */
export const NOT_ATTRIBUTES = new Set([
  "enabled-hover",
  "hover",
  "focus-visible",
  "focus",
  "peer-hover/menu-button",
  "has-data-[icon=inline-start]",
  "has-data-[icon=inline-end]",
  "sm",
  "md",
  "ltr",
]);
