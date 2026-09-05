import { describe, expect, test } from "vitest";

import { normalizePath } from "../scripts/lib/api-shadow-paths.ts";

describe("api shadow path fingerprints", () => {
  test("folds typescript-go NodeHandle.path case onto the on-disk fileName spelling", () => {
    // Checker walk: NodeHandle.path is lowercased on Darwin.
    // Effect extractor: sourceFile.fileName / compilerSourceFileName keep on-disk case.
    expect(normalizePath("node_modules/react-aria/useFocusable.d.ts")).toBe(
      "node_modules/react-aria/usefocusable.d.ts"
    );
    expect(normalizePath("node_modules/@base-ui/react/checkbox/root/CheckboxRoot.d.mts")).toBe(
      normalizePath("node_modules/@base-ui/react/checkbox/root/checkboxroot.d.mts")
    );
  });
});
