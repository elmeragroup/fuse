"use client";

// Whether an enclosing `Field.Set` is disabled. Base UI hands its Fieldset's state only to a Base UI
// Field inside it and exports no context for anything else, so Fuse's `Field.Set` publishes its
// resolved state here too, for parts that disable themselves without being a Field: the date
// pickers' group, trigger, calendar and presets. It is read during render, so the server and the
// first paint already show the parts disabled. Fuse's public API renders a Base UI Fieldset only
// through `Field.Set`; a Base UI `Fieldset.Root` imported from Base UI itself is not covered.

import { createContext, use } from "react";

export const FieldSetDisabledContext = createContext(false);

/**
 * Whether the nearest enclosing `Field.Set`, or one around it, is disabled.
 *
 * @returns `true` inside a disabled `Field.Set`.
 */
export function useFieldSetDisabled(): boolean {
  return use(FieldSetDisabledContext);
}
