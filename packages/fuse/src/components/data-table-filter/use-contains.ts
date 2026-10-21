"use client";

import { useCallback } from "react";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";

/**
 * The locale's matcher: case-, accent- and punctuation-insensitive "contains", as Base UI's lists
 * match. The add menu and the chip's option editor share it, so both lists match the same rows.
 *
 * @param locale - The filter's locale.
 * @returns Whether a text contains a query.
 */
export function useContains(locale: string): (text: string, query: string) => boolean {
  const { contains } = ComboboxPrimitive.useFilter({ locale, multiple: true });
  return useCallback((text: string, query: string) => contains(text, query), [contains]);
}
