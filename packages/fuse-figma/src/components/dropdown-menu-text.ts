/**
 * The docs Dropdown menu demos' text the kit draws. It imports nothing, so the compare page's client
 * bundle can take it without the spec builder's Node imports.
 */

/** The sub trigger's text, the default of its `Label` property: the docs Submenu demo's. */
export const DROPDOWN_MENU_SUB_TRIGGER_TEXT = "Share";

/** The item's text, the default of its `Label` property: the docs Basic demo's first row. */
export const DROPDOWN_MENU_ITEM_TEXT = "Profile";

/** The item's shortcut, the default of its `Shortcut keys` property: the docs Basic demo's first. */
export const DROPDOWN_MENU_SHORTCUT_TEXT = "⇧⌘P";

/** The checkbox row's text, the default of its `Label` property: the docs Checkboxes demo's first. */
export const DROPDOWN_MENU_CHECKBOX_TEXT = "Show toolbar";

/** The radio row's text, the default of its `Label` property: the docs Radio group demo's first. */
export const DROPDOWN_MENU_RADIO_TEXT = "Status bar";

/**
 * The width each row cell sits at: a popup's content box the kit picks, wide enough for every docs
 * row with its icon and shortcut. A row in a popup fills the popup, so the cell's width is a sample.
 */
export const DROPDOWN_ROW_CELL_WIDTH = 160;

/**
 * One child of a docs demo's Dropdown menu popup, as the demo writes it. `widest` marks the row the
 * browser draws wider than every other row, at both densities, which sets the popup's width past its
 * minimum (see `dropdown-popup-kit.ts`).
 */
export type DropdownDemoNode =
  | {
      readonly kind: "item";
      readonly widest?: true;
      readonly label: string;
      readonly shortcut?: string;
      readonly icon?: "User" | "Trash";
      readonly inset?: true;
      readonly disabled?: true;
      readonly destructive?: true;
    }
  | { readonly kind: "checkbox"; readonly label: string; readonly checked: boolean; readonly widest?: true }
  | { readonly kind: "radio"; readonly label: string; readonly value: string; readonly widest?: true }
  | { readonly kind: "sub-trigger"; readonly label: string }
  | { readonly kind: "label"; readonly label: string; readonly inset?: true }
  | { readonly kind: "separator" }
  | { readonly kind: "group"; readonly children: readonly DropdownDemoNode[] }
  | { readonly kind: "radio-group"; readonly value: string; readonly children: readonly DropdownDemoNode[] };

/** The `content` values of the `Dropdown menu popup` set, the docs demos in their order. */
export const DROPDOWN_POPUP_CONTENTS = ["basic", "checkboxes", "radio", "destructive", "submenu"] as const;

/** The docs demos whose popups the `Dropdown menu popup` set draws, by its `content` value. */
export const DROPDOWN_POPUPS = {
  basic: [
    {
      kind: "group",
      children: [
        { kind: "label", label: "Account" },
        { kind: "item", label: "Profile", shortcut: "⇧⌘P" },
        { kind: "item", label: "Billing", shortcut: "⌘B" },
        { kind: "item", label: "Keyboard shortcuts", shortcut: "⌘K", widest: true },
      ],
    },
    { kind: "separator" },
    { kind: "item", label: "Log out" },
  ],
  checkboxes: [
    {
      kind: "group",
      children: [
        { kind: "label", label: "Editor" },
        { kind: "checkbox", label: "Show toolbar", checked: true },
        { kind: "checkbox", label: "Show minimap", checked: false, widest: true },
      ],
    },
  ],
  radio: [
    {
      kind: "radio-group",
      value: "status",
      children: [
        { kind: "label", label: "Visible panel" },
        { kind: "radio", label: "Status bar", value: "status" },
        { kind: "radio", label: "Activity bar", value: "activity", widest: true },
        { kind: "radio", label: "Panel", value: "panel" },
      ],
    },
  ],
  destructive: [
    {
      kind: "group",
      children: [
        { kind: "label", label: "Account", inset: true },
        { kind: "item", label: "Profile", icon: "User", inset: true, widest: true },
        { kind: "item", label: "Billing", inset: true, disabled: true },
      ],
    },
    { kind: "separator" },
    { kind: "item", label: "Delete", icon: "Trash", inset: true, destructive: true },
  ],
  submenu: [
    { kind: "item", label: "New tab" },
    { kind: "item", label: "New window", widest: true },
    { kind: "separator" },
    { kind: "sub-trigger", label: "Share" },
  ],
} as const satisfies Readonly<Record<(typeof DROPDOWN_POPUP_CONTENTS)[number], readonly DropdownDemoNode[]>>;

/** The rows of the docs Submenu demo's submenu, which the `Dropdown menu sub content` set draws. */
export const DROPDOWN_SUBMENU: readonly DropdownDemoNode[] = [
  { kind: "item", label: "Email link" },
  { kind: "item", label: "Copy link" },
  { kind: "item", label: "Messages", widest: true },
];

/** The docs demos' trigger text. */
export const DROPDOWN_TRIGGER_TEXT = "Open";
