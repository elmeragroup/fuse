/**
 * The names a set's variant axes may take. An axis that mirrors a Fuse prop takes the prop's name
 * and values as the component's API reference (`apps/docs/src/app/(docs)/components/<page>/api.json`)
 * gives them, a boolean prop's as `false` and `true`. Every other axis is Figma-only, and takes its
 * name and values from {@link FIGMA_AXES}. `axis-vocabulary.test.ts` holds each set to one or the
 * other, against the parts its manifest's `api` names.
 *
 * Variant keys are built from these names, and a renamed axis or value deletes the variants it
 * keys, so a name changes here only before the kit's library is first published.
 */
import type { Cell } from "./component-spec";

/** The values of a two-state axis, a boolean prop's or a Figma-only one's, off first. */
export const BOOLEAN_VALUES = ["false", "true"] as const;

/** A Figma-only axis: the values it may take, and what it draws. */
type FigmaAxis = {
  readonly values: readonly string[];
  readonly draws: string;
};

/**
 * The Figma-only axes: each name, the values a set may list, and what the axis draws. A set lists
 * the values it shows, in its own order.
 */
export const FIGMA_AXES: ReadonlyMap<string, FigmaAxis> = new Map<string, FigmaAxis>([
  [
    "state",
    {
      values: [
        "rest",
        "hover",
        "focus",
        "highlighted",
        "open",
        "active",
        "drop-target",
        "pending",
        "disabled",
        "unavailable",
        "readonly",
        "invalid",
        "invalid-focus",
      ],
      draws:
        "The interaction or validity state the cell forces or the component's props set: a pointer over it, keyboard focus, the highlighted row of a menu, an open submenu, a hovered or active row's badge, a file dragged over it, an action in flight, disabled, a calendar day the user can reach but not pick, read-only, invalid, or invalid with keyboard focus. A set with one static cell names it `rest`.",
    },
  ],
  [
    "content",
    {
      values: [
        "placeholder",
        "value",
        "text",
        "icon",
        "fallback",
        "image",
        "basic",
        "flat",
        "grouped",
        "empty",
        "checkboxes",
        "radio",
        "destructive",
        "submenu",
        "commands",
        "customers",
        "business",
        "footer-close",
        "tip",
        "step",
      ],
      draws:
        "The sample the cell shows: an input's placeholder or value, a Kbd's text or icon, an Avatar's fallback or image, or which of the docs demo's contents a popup, palette or dialog holds.",
    },
  ],
  [
    "form",
    {
      values: ["caret", "caret-open", "search", "clear"],
      draws:
        "Which composite the Input group is drawn from: Combobox's input with its caret, closed or open, Command's search input, or a multiple Combobox's input with its clear button.",
    },
  ],
  [
    "icon",
    {
      values: ["none", "start", "end"],
      draws: "Whether the label has an icon before or after it, which the markup marks with `data-icon`.",
    },
  ],
  [
    "trailing",
    {
      values: ["none", "shortcut", "caret"],
      draws: "What a Command row shows after its label: nothing, a Kbd group shortcut, or a caret.",
    },
  ],
  [
    "media",
    {
      values: ["icon", "image"],
      draws: "Whether an Item's media slot holds an icon or an image.",
    },
  ],
  [
    "kind",
    {
      values: ["plain", "menu", "menu-inset"],
      draws:
        "Which menu a group label sits in: a Select or Combobox popup, a Dropdown menu, or a Dropdown menu with `inset`.",
    },
  ],
  [
    "shape",
    {
      values: ["line", "circle"],
      draws: "The shape the docs demo gives a Skeleton through its classes: a text line or a circle.",
    },
  ],
  [
    "width",
    {
      values: ["hug", "fill"],
      draws: "Whether the box hugs its content or fills the width its container gives it.",
    },
  ],
  [
    "size",
    {
      values: ["24", "32", "40", "48"],
      draws: "An Avatar's diameter in pixels, which its classes set, since Avatar has no size prop.",
    },
  ],
  [
    "level",
    {
      values: ["low", "medium", "full", "exceeded"],
      draws: "Where a Meter's value sits in its range: low, high, at the maximum, or past it.",
    },
  ],
  [
    "status",
    {
      values: ["neutral", "info", "success", "warning", "error", "loading"],
      draws:
        "The status a Toast shows, which the `type` given to `toastManager.add` sets, since no Toast part takes it as a prop: neutral, info, success, warning, error or loading, each with its fill and icon.",
    },
  ],
  [
    "direction",
    {
      values: ["previous", "next"],
      draws: "Which edge link of Pagination the cell draws, `Pagination.Previous` or `Pagination.Next`.",
    },
  ],
  [
    "placement",
    {
      values: ["centered", "top"],
      draws: "Where a modal popup sits in its viewport: centered, or near the top as the Command palette.",
    },
  ],
  [
    "row",
    {
      values: ["header", "body", "last"],
      draws:
        "Which row of a Table the cell draws: the header row, a body row, or the body's last row, which draws no rule under it.",
    },
  ],
  [
    "position",
    {
      values: ["first", "later"],
      draws:
        "Where a Description list Item sits in its list: first, which draws no rule above it, or after another Item, which draws one where the list shows dividers.",
    },
  ],
  [
    "segment",
    {
      values: ["none", "first", "middle", "last"],
      draws:
        "Where a Toggle sits in a segmented Toggle group, `spacing={0}`: on its own, or the group's first, a middle or its last item, which square off the corners they share with a neighbor.",
    },
  ],
  ["keys", { values: ["2"], draws: "How many Kbd caps a Kbd group holds." }],
  ["avatars", { values: ["3"], draws: "How many Avatars an Avatar group holds." }],
  ["pages", { values: ["3"], draws: "How many page links a Pagination row holds." }],
  ["rows", { values: ["3"], draws: "How many rows a Sidebar sub menu holds." }],
  [
    "filters",
    {
      values: ["none", "status"],
      draws: "Which filters a Data table filter bar holds: none, or the Status field's chip and Clear.",
    },
  ],
  [
    "selection",
    {
      values: [
        "none",
        "selected",
        "start",
        "middle",
        "end",
        "start-week-end",
        "middle-week-start",
        "middle-week-end",
        "end-week-start",
      ],
      draws:
        "Where a calendar day sits in the selection: not in it, the one selected day, or the first, a middle or the last day of a selected range, mid-week or, where its row rounds the range's band, on the week's first or last day.",
    },
  ],
  ...(
    [
      ["checked", "Whether a radio or a menu's radio row is the selected one."],
      [
        "selected",
        "Whether a Select or Combobox row holds the selected value, which shows its check, or a Table row is marked selected.",
      ],
      ["open", "Whether the part the trigger opens is open."],
      ["armed", "Whether a Confirm button's first press armed it, so the next press confirms."],
      ["described", "Whether the Item or Alert shows a description under its title."],
      ["collapsed", "Whether the Sidebar is collapsed to its icon rail."],
      [
        "floating",
        "Whether a Sidebar section sits in a floating Sidebar's rounded surface, which pads it with the small surface tier and rounds its rows inside the surface's corner.",
      ],
      [
        "outside",
        "Whether a calendar day belongs to a neighboring month, which the grid shows without its number.",
      ],
      ["today", "Whether a calendar day is today, whose number Calendar sets in a heavier weight."],
    ] as const
  ).map(([name, draws]): readonly [string, FigmaAxis] => [name, { values: BOOLEAN_VALUES, draws }]),
]);

/**
 * Whether a cell's `state` is one of the two that render its control invalid: `invalid`, and
 * `invalid-focus`, the invalid cell with focus forced.
 *
 * @param cell - A cell of a set whose `state` axis holds `invalid`.
 * @returns True at `state=invalid` and `state=invalid-focus`.
 */
export function isInvalid(cell: Cell): boolean {
  return cell.state === "invalid" || cell.state === "invalid-focus";
}
