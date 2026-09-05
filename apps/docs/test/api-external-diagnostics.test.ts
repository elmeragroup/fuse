import { describe, expect, it } from "vitest";

import { assertKnownBaseUiDiagnostics } from "../scripts/lib/api-external-diagnostics.ts";

describe("selective Base UI extraction diagnostics", () => {
  it("accepts any number of diagnostics from reviewed categories", () => {
    expect(() => {
      assertKnownBaseUiDiagnostics([
        { component: "a", source: "docs-adapter", code: "missing-description", message: "x" },
        { component: "a", source: "effect-extractor", code: "unsupported-type-fallback", message: "y" },
        { component: "b", source: "effect-extractor", code: "unsupported-type-fallback", message: "z" },
      ]);
    }).not.toThrow();
  });

  it("rejects a diagnostic category nobody has reviewed", () => {
    expect(() => {
      assertKnownBaseUiDiagnostics([
        {
          component: "new-component",
          source: "effect-extractor",
          code: "omitted-index-signature",
          message: "gap",
        },
      ]);
    }).toThrow("new-component|effect-extractor:omitted-index-signature: gap");
  });
});
