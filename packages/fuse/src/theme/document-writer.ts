"use client";

import { createContext } from "react";

import {
  readDocumentBrandSnapshot,
  warnDocumentBrandMismatch,
  writeDocumentBrandAttributes,
} from "./document-brand";
import type { ThemeAttributes } from "./theme-attributes";

export const DocumentWriterContext = createContext(false);

export function echoDocumentBrandAttributes(attributes: ThemeAttributes, diagnose: boolean): void {
  try {
    const root = document.documentElement;
    if (diagnose) {
      warnDocumentBrandMismatch(readDocumentBrandSnapshot(root), attributes);
    }
    writeDocumentBrandAttributes(root, attributes);
  } catch {
    // document unavailable
  }
}
