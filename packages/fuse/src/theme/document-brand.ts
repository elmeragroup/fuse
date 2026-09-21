import type { ThemeAttributes } from "./theme-attributes";
import { isThemeDevelopment } from "./validate-theme";

export type DocumentBrandSnapshot = {
  "data-theme-variant": string | null;
  "data-theme-brand": string | null;
  "data-theme-segment": string | null;
};

export function readDocumentBrandSnapshot(root: Element): DocumentBrandSnapshot {
  return {
    "data-theme-variant": root.getAttribute("data-theme-variant"),
    "data-theme-brand": root.getAttribute("data-theme-brand"),
    "data-theme-segment": root.getAttribute("data-theme-segment"),
  };
}

export function writeDocumentBrandAttributes(root: Element, attributes: ThemeAttributes): void {
  root.setAttribute("data-theme-variant", attributes["data-theme-variant"]);
  root.setAttribute("data-theme-brand", attributes["data-theme-brand"]);
  root.setAttribute("data-theme-segment", attributes["data-theme-segment"]);
}

export function documentBrandDisagrees(found: DocumentBrandSnapshot, expected: ThemeAttributes): boolean {
  if (
    found["data-theme-variant"] === null &&
    found["data-theme-brand"] === null &&
    found["data-theme-segment"] === null
  ) {
    return false;
  }
  return (
    found["data-theme-variant"] !== expected["data-theme-variant"] ||
    found["data-theme-brand"] !== expected["data-theme-brand"] ||
    found["data-theme-segment"] !== expected["data-theme-segment"]
  );
}

export function documentBrandMismatchMessage(
  found: DocumentBrandSnapshot,
  expected: ThemeAttributes
): string {
  return (
    "ThemeProvider controlled theme does not match document brand attributes. " +
    `Expected data-theme-variant="${expected["data-theme-variant"]}" ` +
    `data-theme-brand="${expected["data-theme-brand"]}" ` +
    `data-theme-segment="${expected["data-theme-segment"]}", ` +
    `found data-theme-variant="${found["data-theme-variant"]}" ` +
    `data-theme-brand="${found["data-theme-brand"]}" ` +
    `data-theme-segment="${found["data-theme-segment"]}". ` +
    "Recovering to the validated controlled theme."
  );
}

export function warnDocumentBrandMismatch(found: DocumentBrandSnapshot, expected: ThemeAttributes): void {
  if (!isThemeDevelopment() || !documentBrandDisagrees(found, expected)) {
    return;
  }
  console.warn(documentBrandMismatchMessage(found, expected));
}
