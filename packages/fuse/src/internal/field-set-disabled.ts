"use client";

// Whether an enclosing `Field.Root` or `Field.Set` disables a part that is not itself a Base UI
// Field. Base UI hands its Fieldset's state only to a Base UI Field inside it and exports no
// context for anything else, so Fuse's `Field.Set` publishes its resolved state here too, for the
// date pickers' Root and `FileUpload.Root`, which distribute it to their parts. It is read during
// render, so the server and the first paint already show the parts disabled. Fuse's public API
// renders a Base UI Fieldset only through `Field.Set`; a Base UI `Fieldset.Root` imported from Base
// UI itself is not covered.

import { createContext, use } from "react";

import { useFieldRootContext } from "@base-ui/react/internals/field-root-context";

export const FieldSetDisabledContext = createContext(false);

/**
 * The one owner of a Root's disabled state: its own `disabled`, an enclosing `Field.Root`'s, or
 * the nearest enclosing `Field.Set`'s (or one around it).
 *
 * @param own - The Root's `disabled` prop.
 * @returns Whether the Root is disabled.
 */
export function useFieldDisabled(own: boolean): boolean {
  const fieldDisabled = useFieldRootContext().disabled === true;
  const fieldSetDisabled = use(FieldSetDisabledContext);
  return own || fieldDisabled || fieldSetDisabled;
}
