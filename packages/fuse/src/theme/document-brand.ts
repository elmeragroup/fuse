"use client";

import { createContext, useInsertionEffect, useRef } from "react";

import { THEME_ATTRIBUTE_NAMES } from "./theme-attributes";
import type { ThemeAttributeName, ThemeAttributes } from "./theme-attributes";
import { isThemeDevelopment } from "./validate-theme";

type DocumentBrandSnapshot = ReadonlyArray<readonly [ThemeAttributeName, string | null]>;

/** True below the ThemeProvider that owns the document's brand attributes. */
export const DocumentWriterContext = createContext(false);

function readSnapshot(root: Element): DocumentBrandSnapshot {
  return THEME_ATTRIBUTE_NAMES.map((name) => [name, root.getAttribute(name)] as const);
}

function differs(found: DocumentBrandSnapshot, expected: ThemeAttributes): boolean {
  return found.some(([name, value]) => value !== expected[name]);
}

// A document without any brand attribute has no server opinion to disagree with.
function disagrees(found: DocumentBrandSnapshot, expected: ThemeAttributes): boolean {
  if (found.every(([, value]) => value === null)) {
    return false;
  }
  return differs(found, expected);
}

function mismatchMessage(found: DocumentBrandSnapshot, expected: ThemeAttributes): string {
  const expectedList = THEME_ATTRIBUTE_NAMES.map((name) => `${name}="${expected[name]}"`).join(" ");
  const foundList = found.map(([name, value]) => `${name}="${value}"`).join(" ");
  return (
    "ThemeProvider controlled theme does not match document brand attributes. " +
    `Expected ${expectedList}, found ${foundList}. ` +
    "Recovering to the validated controlled theme."
  );
}

function write(root: Element, attributes: ThemeAttributes): void {
  for (const name of THEME_ATTRIBUTE_NAMES) {
    root.setAttribute(name, attributes[name]);
  }
}

/**
 * Keeps the document element's brand attributes on a resolved theme. The first commit warns in
 * development when server-rendered attributes disagree, then writes them. Every later commit
 * restores attributes that differ, so host code that overwrote them is corrected even when
 * only color-scheme props changed; a later commit whose document already matches writes nothing.
 *
 * @param attributes - The validated theme's `data-theme-*` attributes.
 */
export function useDocumentBrand(attributes: ThemeAttributes): void {
  const diagnosed = useRef(false);

  // No dependency list on purpose, like ColorSchemeRoot's configure: every commit compares.
  // Insertion runs before descendant useLayoutEffect so children never measure stale brand.
  useInsertionEffect(() => {
    const root = document.documentElement;
    const found = readSnapshot(root);
    if (!diagnosed.current) {
      diagnosed.current = true;
      if (isThemeDevelopment() && disagrees(found, attributes)) {
        console.warn(mismatchMessage(found, attributes));
      }
      write(root, attributes);
    } else if (differs(found, attributes)) {
      write(root, attributes);
    }
  });
}
