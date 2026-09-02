import { describe, expect, it } from "vitest";

import type { SemanticType } from "@elmeragroup/api-extractor";

import { renderableExportParts } from "../scripts/lib/api-effect-adapter.ts";

function componentType(): SemanticType {
  return { kind: "component", props: [] };
}

function functionType(): SemanticType {
  return { kind: "function", callSignatures: [] };
}

describe("renderableExportParts", () => {
  it("maps a hook function export to a part of the same name", () => {
    expect(renderableExportParts("useSidebar", functionType(), ["useSidebar"])).toEqual([
      { name: "useSidebar", ownerPath: ["useSidebar"], type: functionType() },
    ]);
  });

  it("maps mixed namespace object members including hooks", () => {
    const type: SemanticType = {
      kind: "object",
      properties: [
        { name: "Provider", type: componentType(), optional: false },
        { name: "useToastManager", type: functionType(), optional: false },
        { name: "createToastManager", type: functionType(), optional: false },
      ],
    };
    expect(renderableExportParts("Toast", type, []).map((part) => part.name)).toEqual([
      "Toast.Provider",
      "Toast.useToastManager",
      "Toast.createToastManager",
    ]);
  });

  it("maps an intrinsic namespace fallback to canonical member names", () => {
    const type: SemanticType = { kind: "intrinsic", intrinsic: "any" };
    expect(
      renderableExportParts("Toast", type, [
        "Toast.Provider",
        "Toast.Viewport",
        "Toast.useToastManager",
        "Toast.createToastManager",
      ]).map((part) => part.name)
    ).toEqual(["Toast.Provider", "Toast.Viewport", "Toast.useToastManager", "Toast.createToastManager"]);
  });

  it("maps an external re-export hook to a single part", () => {
    const type: SemanticType = { kind: "external", typeName: { name: "useFocusable" } };
    expect(renderableExportParts("useFocusable", type, ["Focusable", "useFocusable"])).toEqual([
      { name: "useFocusable", ownerPath: ["useFocusable"], type },
    ]);
  });

  it("still rejects a non-renderable export kind with no canonical parts", () => {
    expect(renderableExportParts("Tokens", { kind: "literal", value: "x" }, [])).toBeUndefined();
  });
});
