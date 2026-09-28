"use client";

import { createContext } from "react";

import { THEME_ATTRIBUTE_NAMES } from "./theme-attributes";
import type { ThemeAttributeName, ThemeAttributes } from "./theme-attributes";
import { isThemeDevelopment } from "./validate-theme";

type DocumentBrandSnapshot = ReadonlyArray<readonly [ThemeAttributeName, string | null]>;

/** True below the ThemeProvider that owns the document's brand attributes. */
export const DocumentWriterContext = createContext(false);

function readSnapshot(root: Element): DocumentBrandSnapshot {
  return THEME_ATTRIBUTE_NAMES.map((name) => [name, root.getAttribute(name)] as const);
}

// A document without any brand attribute has no server opinion to disagree with.
function disagrees(found: DocumentBrandSnapshot, expected: ThemeAttributes): boolean {
  if (found.every(([, value]) => value === null)) {
    return false;
  }
  return found.some(([name, value]) => value !== expected[name]);
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
 * Writes a resolved theme's brand attributes to the document element. With `diagnose`, it
 * first warns in development when server-rendered attributes disagree with them.
 *
 * @param attributes - The validated theme's `data-theme-*` attributes.
 * @param options - `diagnose` compares the existing document attributes before writing.
 */
export function syncDocumentBrand(attributes: ThemeAttributes, options: { diagnose: boolean }): void {
  const root = document.documentElement;
  if (options.diagnose && isThemeDevelopment()) {
    const found = readSnapshot(root);
    if (disagrees(found, attributes)) {
      console.warn(mismatchMessage(found, attributes));
    }
  }
  write(root, attributes);
}
