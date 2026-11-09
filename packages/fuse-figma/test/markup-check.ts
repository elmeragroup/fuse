/**
 * The markup check as the kit's tests assert it: `checkMarkup` from `src/compare/markup-check.ts`,
 * failing the test with every rendering's first difference when the markup differs from the
 * definition, as `src/compare/kit-markup.test.ts` runs it on every kit definition.
 */
import { expect } from "vitest";

import { checkMarkup as markupDiagnostics } from "../src/compare/markup-check.ts";

/**
 * Assert that a definition's renderer gives the markup the definition says for each cell.
 *
 * @param args - The definition, the cells and the renderer, as `checkMarkup` takes them.
 * @throws An assertion error that lists each rendering's first difference.
 */
export function checkMarkup(...args: Parameters<typeof markupDiagnostics>): void {
  const diagnostics = markupDiagnostics(...args);
  expect(diagnostics, diagnostics.map(({ message }) => message).join("\n")).toEqual([]);
}
