import type { VariantProps } from "tailwind-variants";

import { cn } from "../../styles/cn";
import { itemVariants } from "./item-variants";

type ItemRootVariants = VariantProps<typeof itemVariants>;

/**
 * Style inputs shared by the client `Item.Root` and the hook-free root Alert renders.
 * Variant and size are required. Each component defaults them in its own signature,
 * where the API docs read the default.
 */
export type ItemRootStyle = {
  /** The resolved `variant` axis of `itemVariants`. */
  readonly variant: NonNullable<ItemRootVariants["variant"]>;
  /** The resolved `size` axis of `itemVariants`. */
  readonly size: NonNullable<ItemRootVariants["size"]>;
  /** Consumer classes, merged after the recipe so they win Tailwind conflicts. */
  readonly className?: string | undefined;
};

/** Host attributes every Item root carries. */
export type ItemRootProps = {
  readonly "data-slot": "item";
  readonly "data-variant": ItemRootStyle["variant"];
  readonly "data-size": ItemRootStyle["size"];
  readonly className: string;
};

/**
 * Builds the Item root's data attributes and classes. It is pure and has no directive, so the
 * client `Item.Root`, through `useRender`, and the server-safe `ItemRootElement` emit the same
 * markup from one function.
 *
 * @param style - Variant, size and consumer classes.
 * @returns The attributes to put on the root element.
 */
export function itemRootProps({ variant, size, className }: ItemRootStyle): ItemRootProps {
  return {
    "data-slot": "item",
    "data-variant": variant,
    "data-size": size,
    className: cn(itemVariants({ variant, size }), className),
  };
}
