import { describe, expect, it } from "vitest";

import { assertExpectedBaseUiDiagnostics } from "../scripts/lib/api-external-diagnostics.ts";

describe("selective Base UI extraction diagnostics", () => {
  it("rejects a missing reviewed diagnostic", () => {
    expect(() => {
      assertExpectedBaseUiDiagnostics([]);
    }).toThrow("accordion|docs-adapter:unsupported-component-shape: expected 1, received 0");
  });

  it("rejects a new diagnostic even when its source and code are already reviewed elsewhere", () => {
    expect(() => {
      assertExpectedBaseUiDiagnostics([
        {
          component: "new-component",
          source: "docs-adapter",
          code: "unsupported-component-shape",
          message: "new gap",
        },
      ]);
    }).toThrow("new-component|docs-adapter:unsupported-component-shape: expected 0, received 1");
  });
});
