/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- adversarial handles are opaque test values. */

import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { BackendSymbolHandle, BackendTypeNodeHandle } from "../src/backend/contracts.ts";
import { HandleRegistry } from "../src/backend/handles.ts";
import { openTsgoProject } from "../src/backend/ts7/project.ts";

const fixtureDirectory = resolve(import.meta.dirname, "fixtures/basic");
const tsconfigPath = resolve(fixtureDirectory, "tsconfig.json");
const inputPath = resolve(fixtureDirectory, "input.ts");

const context = {
  operation: "test.handle",
  filePath: "/virtual/input.ts",
  symbolStack: ["Widget", "property: value"],
};

describe("HandleRegistry", () => {
  it("rejects a missing handle with operation breadcrumbs", () => {
    const registry = new HandleRegistry();
    const missing = {
      kind: "symbol",
      id: 999,
      session: registry.session,
    } as BackendSymbolHandle;

    expect(() => registry.get(missing, "symbol", context)).toThrow(
      /Invalid symbol compiler handle in test\.handle/u
    );
    expect(() => registry.get(missing, "symbol", context)).toThrow(
      expect.objectContaining({ filePath: context.filePath, symbolStack: context.symbolStack })
    );
  });

  it("rejects handles from a different extraction session", () => {
    const first = new HandleRegistry();
    const second = new HandleRegistry();
    const handle = first.create("symbol", { name: "Widget" });

    expect(() => second.get(handle, "symbol", context)).toThrow(/Invalid symbol compiler handle/u);
  });

  it("rejects a handle whose runtime kind differs from the operation", () => {
    const registry = new HandleRegistry();
    const symbol = registry.create("symbol", { name: "Widget" });

    const wrongKind = { ...symbol, kind: "type" as const };
    expect(() => registry.get(wrongKind, "type", context)).toThrow(/Invalid type compiler handle/u);
  });

  it("keeps TypeNode handles explicitly distinct from generic node handles", () => {
    const registry = new HandleRegistry();
    const typeNode = {};
    const handle = registry.create("type-node", typeNode);

    expect(registry.get<"type-node", object>(handle, "type-node", context)).toBe(typeNode);
    const wrongKind = { ...handle, kind: "node" as const };
    expect(() => registry.get(wrongKind, "node", context)).toThrow(/Invalid node compiler handle/u);
    // Keep the package-owned type visible to this adversarial test's compile-time seam.
    const typedHandle: BackendTypeNodeHandle = handle;
    expect(typedHandle.kind).toBe("type-node");
  });

  it("rejects every operation after the extraction session is closed", () => {
    const registry = new HandleRegistry();
    const handle = registry.create("symbol", { name: "Widget" });
    registry.clear();

    expect(() => registry.get(handle, "symbol", context)).toThrow(/after the extraction session closed/u);
    expect(() => registry.create("symbol", { name: "Other" })).toThrow(
      /after the extraction session closed/u
    );
  });

  it("allocates an isolated registry for every repeated project extraction", () => {
    const project = openTsgoProject({ tsconfigPath });
    const first = project.openExtraction();
    const firstSymbol = first.readModule(inputPath).exports[0]?.symbol;
    expect(firstSymbol).toBeDefined();
    first.close();

    const second = project.openExtraction();
    expect(second.readModule(inputPath).exports.length).toBeGreaterThan(0);
    if (firstSymbol !== undefined) {
      expect(() => second.compiler.symbolFacts(firstSymbol)).toThrow(/Invalid symbol compiler handle/u);
    }
    second.close();
    project.close();
  });
});
