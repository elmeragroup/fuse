/**
 * Server-visible namespace for `ToggleGroup`.
 * The implementation stays a client module; this file has no directive,
 * so a server component can read each part instead of dotting into a client reference.
 */
import { ToggleGroupRoot, ToggleGroupItem } from "./toggle-group";

export const ToggleGroup = {
  Root: ToggleGroupRoot,
  Item: ToggleGroupItem,
};
