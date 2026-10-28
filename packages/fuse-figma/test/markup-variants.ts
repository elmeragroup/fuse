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
  // Base UI marks a read-only NumberField's steppers, which it leaves enabled.
  ["data-readonly", (element) => element.attributes.has("data-readonly")],
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
  // A File upload dropzone carries `data-drop-target` while a file drag that could drop is over it.
  ["data-drop-target", (element) => element.attributes.has("data-drop-target")],
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
  // An open Combobox popup carries `data-empty` while no row matches, which shows its empty message.
  [
    "group-data-empty/combobox-content",
    (ancestor) => marks(ancestor, "group/combobox-content") && ancestor.attributes.has("data-empty"),
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
  // The desktop `Sidebar.Root` also carries `data-collapsible="offcanvas"` while it slides off, and
  // the side it sits on in `data-side`, which its container reads.
  [
    "group-data-[collapsible=offcanvas]",
    (ancestor) => marks(ancestor, "group") && ancestor.attributes.get("data-collapsible") === "offcanvas",
  ],
  ...["left", "right"].map((side): [string, (ancestor: MarkupElement) => boolean] => [
    `group-data-[side=${side}]`,
    (ancestor) => marks(ancestor, "group") && ancestor.attributes.get("data-side") === side,
  ]),
  // A ToggleGroup root carries the `group/toggle-group` marker, its orientation in `data-orientation`
  // and its spacing in `data-spacing`, which its items read.
  ...["horizontal", "vertical"].map((orientation): [string, (ancestor: MarkupElement) => boolean] => [
    `group-data-${orientation}/toggle-group`,
    (ancestor) =>
      marks(ancestor, "group/toggle-group") && ancestor.attributes.get("data-orientation") === orientation,
  ]),
  [
    "group-data-[spacing=0]/toggle-group",
    (ancestor) => marks(ancestor, "group/toggle-group") && ancestor.attributes.get("data-spacing") === "0",
  ],
]);

/**
 * Whether an element at, below or around the measured element matches each attribute variant its own
 * classes name, as a Navigation menu trigger's caret writes its Root's side in `data-side` and reads
 * it through `data-[side=bottom]:`, which compiles to `[data-side="bottom"]`, and as Base UI stamps an
 * open Select popup `data-open` and its side, and Fuse its `data-align-trigger`, which the popup's
 * own classes read around each row. A Dropdown menu row names its own `data-inset` and
 * `data-variant`, which other sets' roots never carry.
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
  // Fuse stamps `data-external-anchor` on a Combobox popup, `"true"` where it sits against an anchor
  // other than its input, and Base UI stamps `data-empty` on the popup and its list while no row matches.
  ["data-[external-anchor=true]", (element) => element.attributes.get("data-external-anchor") === "true"],
  ["data-empty", (element) => element.attributes.has("data-empty")],
  // Tailwind's `in-data-popup-open:` holds below an element that carries `data-popup-open`, as Combobox's
  // CaretDown sits in the open trigger an instance part's root renders.
  ["in-data-popup-open", (element) => element.attributes.has("data-popup-open")],
  // Base UI marks the trigger of an open popup `aria-expanded="true"`, which an instance part's facts
  // declare for a Button trigger in place.
  ["aria-expanded", (element) => element.attributes.get("aria-expanded") === "true"],
  // Fuse stamps `data-inset` on an inset Dropdown menu row or label, and `data-variant` on its rows.
  ["data-inset", (element) => element.attributes.has("data-inset")],
  ["data-[variant=destructive]", (element) => element.attributes.get("data-variant") === "destructive"],
  ["not-data-[variant=destructive]", (element) => element.attributes.get("data-variant") !== "destructive"],
  // ToggleGroup stamps its variant and spacing on each item.
  ["data-[variant=outline]", (element) => element.attributes.get("data-variant") === "outline"],
  ["data-[spacing=0]", (element) => element.attributes.get("data-spacing") === "0"],
]);

/**
 * Whether an element holds each structural pseudo-class among its element siblings: `first:` is
 * `:first-child` and `last:` is `:last-child` (Selectors 4 §14.3), as a ToggleGroup item reads its place
 * in the row.
 */
export const POSITION_VARIANTS = new Map<
  string,
  (elements: readonly MarkupElement[], index: number) => boolean
>([
  [
    "first",
    (elements, index) =>
      !elements.some((element, at) => at < index && element.parent === elements[index]?.parent),
  ],
  [
    "last",
    (elements, index) =>
      !elements.some((element, at) => at > index && element.parent === elements[index]?.parent),
  ],
]);

/** The children of an element in the markup. */
function childrenOf(elements: readonly MarkupElement[], index: number): readonly MarkupElement[] {
  return elements.filter((element) => element.parent === index);
}

/** Whether an element sits below another, at any depth. */
function below(elements: readonly MarkupElement[], index: number, outer: number): boolean {
  const parent = elements[index]?.parent;
  return parent !== undefined && (parent === outer || below(elements, parent, outer));
}

/**
 * Whether an element holds what each `has-[>…]:` variant reads, as Tailwind compiles it:
 * `has-[>button]:` is `:has(> button)`, which holds on an element with a `<button>` child, as an Input
 * group addon holding a button, and `has-[>[data-focus-ring-control]:disabled]:` holds on an Input
 * group whose own control, a direct child, is disabled. `has-data-[variant=inset]:` is
 * `:has([data-variant="inset"])`, which holds on an element with such an element at any depth below
 * it, as `Sidebar.Provider`'s wrapper around an inset `Sidebar.Root`.
 */
export const HAS_VARIANTS = new Map<string, (elements: readonly MarkupElement[], index: number) => boolean>([
  ...(
    [
      [
        "has-[>[data-focus-ring-control]:disabled]",
        (child) => child.attributes.has("data-focus-ring-control") && child.attributes.has("disabled"),
      ],
      [
        "has-[>[data-focus-ring-control][aria-invalid=true]]",
        (child) =>
          child.attributes.has("data-focus-ring-control") && child.attributes.get("aria-invalid") === "true",
      ],
      ["has-[>[data-align=inline-start]]", (child) => child.attributes.get("data-align") === "inline-start"],
      ["has-[>[data-align=inline-end]]", (child) => child.attributes.get("data-align") === "inline-end"],
      ["has-[>button]", (child) => child.name === "button"],
      // A Combobox popup that holds a search field as its own child.
      ["has-[>[data-slot=input-group]]", (child) => child.attributes.get("data-slot") === "input-group"],
      ["has-[>svg]", (child) => child.name === "svg"],
      // A Field.Set that holds a radio group as its own child, and a group that holds selection cards.
      ["has-[>[data-slot=radio-group]]", (child) => child.attributes.get("data-slot") === "radio-group"],
      [
        "has-[>[data-slot=checkbox-group]]",
        (child) => child.attributes.get("data-slot") === "checkbox-group",
      ],
      ["has-[>[data-selection-item]]", (child) => child.attributes.has("data-selection-item")],
    ] as const satisfies readonly (readonly [string, (child: MarkupElement) => boolean])[]
  ).map(([variant, matches]): [string, (elements: readonly MarkupElement[], index: number) => boolean] => [
    variant,
    (elements, index) => childrenOf(elements, index).some(matches),
  ]),
  // `has-disabled:` compiles to `:has(:disabled)`: a disabled form control at any depth, as a Radio
  // row's label holds its radio's hidden `<input>`.
  [
    "has-disabled",
    (elements, index) =>
      elements.some(
        (element, at) =>
          ["input", "button", "select", "textarea"].includes(element.name) &&
          element.attributes.has("disabled") &&
          below(elements, at, index)
      ),
  ],
  [
    "has-data-[variant=inset]",
    (elements, index) =>
      elements.some(
        (element, at) => element.attributes.get("data-variant") === "inset" && below(elements, at, index)
      ),
  ],
]);

/**
 * Whether an ancestor is the group each `group-has-…:` variant reads: `group-has-data-[slot=combobox-clear]/input-group:`
 * compiles to `:where(.group\/input-group):has([data-slot="combobox-clear"]) *`, so it holds below an
 * Input group that holds Combobox's clear button, as the caret beside it does.
 */
export const GROUP_HAS_VARIANTS = new Map<
  string,
  (elements: readonly MarkupElement[], ancestor: number) => boolean
>([
  [
    "group-has-data-[slot=combobox-clear]/input-group",
    (elements, ancestor) => {
      const group = elements[ancestor];
      return (
        group !== undefined &&
        marks(group, "group/input-group") &&
        elements.some(
          (element, index) =>
            below(elements, index, ancestor) && element.attributes.get("data-slot") === "combobox-clear"
        )
      );
    },
  ],
]);

/**
 * Whether a sibling before the measured element matches each peer variant, which selects the
 * elements after it: `peer-data-active/menu-button:` compiles to `:is(:where(.peer\/menu-button)…
 * ~ *)`, so it holds after an element that carries the `peer/menu-button` marker and is active, as a
 * Sidebar menu badge holds after its active menu button.
 */
export const PEER_VARIANTS = new Map<string, (sibling: MarkupElement) => boolean>([
  ["peer-data-active/menu-button", (sibling) => marks(sibling, "peer/menu-button") && isActive(sibling)],
  // A Radio row's content reads the radio before it, which carries the plain `peer` marker.
  ["peer-data-disabled", (sibling) => marks(sibling, "peer") && sibling.attributes.has("data-disabled")],
]);

/**
 * Whether an ancestor of an element matches each `in-*` variant, which selects the elements inside it:
 * `in-data-[slot=navigation-menu-popup]:` compiles to `:where([data-slot="navigation-menu-popup"]) &`,
 * so it holds on a row link inside the Navigation menu's popup.
 */
export const IN_VARIANTS = new Map<string, (ancestor: MarkupElement) => boolean>([
  [
    "in-data-[slot=navigation-menu-popup]",
    (ancestor) => ancestor.attributes.get("data-slot") === "navigation-menu-popup",
  ],
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
  // Input group rings while its control has keyboard focus, which the page forces on the control.
  "has-[[data-focus-ring-control]:focus-visible]",
  // A File upload dropzone rings while its trigger has keyboard focus, which the page forces there.
  "has-focus-visible",
  // The page's browser meets `@supports (backdrop-filter: …)`, which the overlay scrim's blur reads.
  "supports-backdrop-filter",
  "peer-hover/menu-button",
  // The page writes `data-highlighted` on a highlighted Combobox or Command row when it forces the
  // state, and a Command row's trailing part reads it from the row.
  "data-highlighted",
  "in-data-highlighted",
  // A Dropdown menu row's shortcut reads the row's DOM focus.
  "group-focus/dropdown-menu-item",
  "has-data-[icon=inline-start]",
  "has-data-[icon=inline-end]",
  "sm",
  "md",
  "ltr",
]);
