/**
 * The cells `figma:compare` knows how to render: a kit variant key parsed into the Button props
 * it stands for. A key such as `button/variant=ghost,size=sm,state=hover,icon=end` names the
 * component set, then each variant property. The parser accepts only the axes and values the
 * harness can render, so a new axis in the kit shows up as an unsupported cell, not as a cell
 * rendered without it.
 */

import { Result } from "effect";

import { buttonVariants } from "@elmeragroup/fuse/recipe-catalog";

/** A `variant` the Button recipe declares. */
export type ButtonVariant = keyof typeof buttonVariants.variants.variant;

type RecipeSize = keyof typeof buttonVariants.variants.size;

/** A label size: every recipe size except the square `icon*` ones. */
export type LabelSize = Exclude<RecipeSize, `icon${string}`>;

/**
 * A square icon size. `icon-inline` stays out, as in the kit, because it takes its size from
 * the surrounding text line.
 */
export type IconSize = Exclude<Extract<RecipeSize, `icon${string}`>, "icon-inline">;

/** The kit's `state` axis. */
export const CELL_STATES = ["rest", "hover", "focus", "disabled", "pending"] as const;

/** One value of the kit's `state` axis. */
export type CellState = (typeof CELL_STATES)[number];

/** The kit's `icon` axis on `Button`. */
export const ICON_PLACEMENTS = ["none", "start", "end"] as const;

/** One value of the kit's `icon` axis. */
export type IconPlacement = (typeof ICON_PLACEMENTS)[number];

/** A cell of the `Button` set. */
export type LabelButtonCell = {
  readonly component: "button";
  readonly variant: ButtonVariant;
  readonly size: LabelSize;
  readonly state: CellState;
  readonly icon: IconPlacement;
};

/** A cell of the `Icon button` set. */
export type IconButtonCell = {
  readonly component: "icon-button";
  readonly variant: ButtonVariant;
  readonly size: IconSize;
  readonly state: CellState;
};

/** A cell the harness renders. */
export type Cell = LabelButtonCell | IconButtonCell;

/** A variant key the harness cannot render. */
export class UnsupportedVariant extends Error {
  readonly _tag = "UnsupportedVariant" as const;
  /** The key as the snapshot holds it. */
  readonly variant: string;

  /**
   * @param variant - The key as the snapshot holds it.
   * @param reason - Why the harness cannot render it.
   */
  constructor(variant: string, reason: string) {
    super(`${variant}: ${reason}`);
    this.variant = variant;
  }
}

/** Every `variant` the recipe declares, in its order. */
export const BUTTON_VARIANTS: readonly ButtonVariant[] = Object.keys(buttonVariants.variants.variant).filter(
  isButtonVariant
);

/** Every label size the recipe declares, in its order. */
export const LABEL_SIZES: readonly LabelSize[] = Object.keys(buttonVariants.variants.size).filter(
  isLabelSize
);

/** Every square size the kit models, in the recipe's order. */
export const ICON_SIZES: readonly IconSize[] = Object.keys(buttonVariants.variants.size).filter(isIconSize);

function isButtonVariant(value: string): value is ButtonVariant {
  return Object.hasOwn(buttonVariants.variants.variant, value);
}

function isLabelSize(value: string): value is LabelSize {
  return Object.hasOwn(buttonVariants.variants.size, value) && !value.startsWith("icon");
}

function isIconSize(value: string): value is IconSize {
  return (
    Object.hasOwn(buttonVariants.variants.size, value) && value.startsWith("icon") && value !== "icon-inline"
  );
}

const AXES = {
  button: ["variant", "size", "state", "icon"],
  "icon-button": ["variant", "size", "state"],
} as const;

/**
 * Split a variant key into its component set and its properties.
 *
 * @param key - A variant key, such as `icon-button/variant=ghost,size=icon-xs,state=hover`.
 * @returns The set's key and each property's value, or `UnsupportedVariant` when the key does
 *   not have the `<set>/<name>=<value>,…` shape or names a property twice.
 */
export function parseVariantProperties(
  key: string
): Result.Result<
  { readonly set: string; readonly properties: ReadonlyMap<string, string> },
  UnsupportedVariant
> {
  const slash = key.indexOf("/");
  if (slash <= 0) {
    return Result.fail(new UnsupportedVariant(key, "the key has no component set before a slash"));
  }
  const properties = new Map<string, string>();
  for (const pair of key.slice(slash + 1).split(",")) {
    const equals = pair.indexOf("=");
    if (equals <= 0) {
      return Result.fail(new UnsupportedVariant(key, `the property ${pair} is not a name=value pair`));
    }
    const name = pair.slice(0, equals);
    if (properties.has(name)) {
      return Result.fail(new UnsupportedVariant(key, `the key names ${name} twice`));
    }
    properties.set(name, pair.slice(equals + 1));
  }
  return Result.succeed({ set: key.slice(0, slash), properties });
}

function pick<Value extends string>(
  key: string,
  properties: ReadonlyMap<string, string>,
  name: string,
  accept: (value: string) => Value | undefined
): Result.Result<Value, UnsupportedVariant> {
  const value = properties.get(name);
  if (value === undefined) {
    return Result.fail(new UnsupportedVariant(key, `the key has no ${name}`));
  }
  const accepted = accept(value);
  return accepted === undefined
    ? Result.fail(new UnsupportedVariant(key, `the harness cannot render ${name}=${value}`))
    : Result.succeed(accepted);
}

const among =
  <Value extends string>(values: readonly Value[]) =>
  (value: string): Value | undefined =>
    values.find((candidate) => candidate === value);

/**
 * Parse a kit variant key into the cell it renders.
 *
 * @param key - A variant key from the snapshot.
 * @returns The cell, or `UnsupportedVariant` for a set, axis or value the harness cannot render.
 */
export function parseCell(key: string): Result.Result<Cell, UnsupportedVariant> {
  return Result.gen(function* () {
    const { set, properties } = yield* parseVariantProperties(key);
    if (set !== "button" && set !== "icon-button") {
      return yield* Result.fail(new UnsupportedVariant(key, `the harness renders no component set ${set}`));
    }
    const known: readonly string[] = AXES[set];
    const extra = [...properties.keys()].filter((name) => !known.includes(name));
    if (extra.length > 0) {
      return yield* Result.fail(
        new UnsupportedVariant(key, `the harness cannot render the axis ${extra.join(", ")}`)
      );
    }
    const variant = yield* pick(key, properties, "variant", among(BUTTON_VARIANTS));
    const state = yield* pick(key, properties, "state", among(CELL_STATES));
    if (set === "icon-button") {
      const size = yield* pick(key, properties, "size", among(ICON_SIZES));
      const cell: Cell = { component: "icon-button", variant, size, state };
      return cell;
    }
    const size = yield* pick(key, properties, "size", among(LABEL_SIZES));
    const icon = yield* pick(key, properties, "icon", among(ICON_PLACEMENTS));
    const cell: Cell = { component: "button", variant, size, state, icon };
    return cell;
  });
}

/**
 * The variant key of a cell, in the kit's axis order.
 *
 * @param cell - The cell.
 * @returns The key the kit gives the cell's variant.
 */
export function cellKey(cell: Cell): string {
  return cell.component === "button"
    ? `button/variant=${cell.variant},size=${cell.size},state=${cell.state},icon=${cell.icon}`
    : `icon-button/variant=${cell.variant},size=${cell.size},state=${cell.state}`;
}
