/**
 * What the real Fuse Button looks like in code for each cell, as plain data: its props, its
 * children and the pseudo classes the page forces. `fuse-markup.ts` turns this into React
 * elements, so the mapping itself stays testable without the Fuse build.
 *
 * - `icon=start` places `<Plus data-icon="inline-start" />` before the label, and `icon=end`
 *   places `<ArrowRight data-icon="inline-end" />` after it, the icons the kit's swap
 *   properties default to.
 * - An icon button holds a bare `<Plus />` and is named by `aria-label`.
 * - `disabled` sets `disabled`, and `pending` sets `isPending`, which renders the spinner.
 * - `hover` forces `:hover`, and `focus` forces `:focus` and `:focus-visible`, as a pointer over
 *   the button or a keyboard user on it would.
 */

import type { ButtonVariant, Cell, IconSize, LabelSize } from "./cells.ts";

/** The label every label cell shows, the kit's `Label` default. */
const CELL_LABEL = "Button";

/** A Fuse icon a cell places. */
export type CellIcon = "Plus" | "ArrowRight";

/** A child of the Button, in order. */
export type CellChild =
  | {
      readonly kind: "icon";
      readonly icon: CellIcon;
      /** The `data-icon` marker that moves the padding on the icon's side, if any. */
      readonly dataIcon: "inline-start" | "inline-end" | undefined;
    }
  | { readonly kind: "label"; readonly text: string };

/** A pseudo class the page forces on the button. */
export type ForcedPseudoClass = "hover" | "focus" | "focus-visible";

/** The props of a Button with a visible label. */
export type LabelButtonCellProps = {
  readonly kind: "label";
  readonly variant: ButtonVariant;
  readonly size: LabelSize;
  readonly disabled: boolean;
  readonly isPending: boolean;
};

/** The props of a square icon-only Button, which its `aria-label` names. */
export type IconButtonCellProps = {
  readonly kind: "icon";
  readonly variant: ButtonVariant;
  readonly size: IconSize;
  readonly disabled: boolean;
  readonly isPending: boolean;
  readonly ariaLabel: string;
};

/** How the page renders one cell. */
export type CellMarkup = {
  readonly props: LabelButtonCellProps | IconButtonCellProps;
  readonly children: readonly CellChild[];
  readonly forced: readonly ForcedPseudoClass[];
};

const FORCED = {
  rest: [],
  hover: ["hover"],
  focus: ["focus", "focus-visible"],
  disabled: [],
  pending: [],
} as const satisfies Record<Cell["state"], readonly ForcedPseudoClass[]>;

function labelChildren(icon: "none" | "start" | "end"): readonly CellChild[] {
  const label: CellChild = { kind: "label", text: CELL_LABEL };
  switch (icon) {
    case "start":
      return [{ kind: "icon", icon: "Plus", dataIcon: "inline-start" }, label];
    case "end":
      return [label, { kind: "icon", icon: "ArrowRight", dataIcon: "inline-end" }];
    case "none":
      return [label];
  }
}

/**
 * The Button markup a cell stands for.
 *
 * @param cell - A parsed cell.
 * @returns The props, children and forced pseudo classes.
 */
export function cellMarkup(cell: Cell): CellMarkup {
  const disabled = cell.state === "disabled";
  const isPending = cell.state === "pending";
  const forced = FORCED[cell.state];
  if (cell.component === "icon-button") {
    return {
      props: {
        kind: "icon",
        variant: cell.variant,
        size: cell.size,
        disabled,
        isPending,
        ariaLabel: CELL_LABEL,
      },
      children: [{ kind: "icon", icon: "Plus", dataIcon: undefined }],
      forced,
    };
  }
  return {
    props: { kind: "label", variant: cell.variant, size: cell.size, disabled, isPending },
    children: labelChildren(cell.icon),
    forced,
  };
}

/**
 * The same cell at rest: the reference the page compares a forced cell's styles against, to
 * tell whether forcing the pseudo class reached Fuse's `enabled-hover:` and `focus-visible:`
 * rules.
 *
 * @param cell - A parsed cell.
 * @returns The cell with its state set to rest.
 */
export function restingTwin(cell: Cell): Cell {
  return { ...cell, state: "rest" };
}
