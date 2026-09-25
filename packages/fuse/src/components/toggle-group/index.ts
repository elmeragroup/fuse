/**
 * Server-visible namespace for `ToggleGroup`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { Root, Item } from "./index.parts";

export const ToggleGroup = {
  Root,
  Item,
};

export type { ToggleGroupItemProps, ToggleGroupRootProps } from "./toggle-group";
