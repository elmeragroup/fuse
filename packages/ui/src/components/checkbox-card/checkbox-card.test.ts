import { createElement } from "react";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { focusRing } from "../../styles/utils";
import { CheckboxCard } from "./checkbox-card";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "checkbox-card.tsx"), "utf8");
const facade = readFileSync(join(here, "..", "..", "checkbox-card.ts"), "utf8");
const focusSelf = focusRing({ target: "self" }).root();

describe("checkbox-card source contract", () => {
  it("is a client surface that keeps the internal render before the primitive spread", () => {
    expect(source).toContain('"use client"');
    expect(source).not.toContain(".ref/");
    expect(source).toContain('from "@base-ui/react/field"');
    expect(source).not.toContain('from "../field/field"');
    expect(source).toContain("<FieldPrimitive.Item>");
    expect(source).not.toContain("<Field.Item>");
    expect(source).toContain("<Card.Root");
    expect(source).toContain("<Card.Content");
    expect(source).toContain("FieldPrimitive.Label");
    expect(source).toContain("CheckboxPrimitive.Root");
    const renderMarker = "render={(props, state) =>";
    const otherMarker = "{...other}";
    expect(source).toContain(renderMarker);
    expect(source).toContain(otherMarker);
    expect(source.indexOf(renderMarker)).toBeLessThan(source.indexOf(otherMarker));
    expect(source).not.toContain("data-slot");
    expect(source).not.toContain("SelectionItem");
    expect(source).not.toContain("CheckboxItem");
    expect(source).toContain('"render" | "disabled" | "title" | "className"');
    expect(source).not.toContain("className?:");
  });

  it("uses the shared self focus ring and icon-crossfade constants", () => {
    expect(source).toContain('focusRing({ target: "self" })');
    expect(source).toContain("iconCrossfadeTransition");
    expect(source).toContain("iconCrossfadeShown");
    expect(source).toContain("iconCrossfadeHidden");
    expect(source).toContain("bg-card");
    expect(source).toContain("bg-muted");
    expect(source).toContain("opacity-75");
    expect(source).toContain("text-success");
    expect(source).not.toContain("ring-brand");
    expect(source.includes(["focus-visible", "ring-ring"].join(":"))).toBe(false);
    for (const token of focusSelf.split(/\s+/).filter(Boolean)) {
      expect(source).not.toContain(`"${token}"`);
    }
  });

  it("uses Phosphor Circle and fill-weight CheckCircle", () => {
    expect(source).toContain('from "../../icons/generated/circle"');
    expect(source).toContain('from "../../icons/generated/check-circle"');
    expect(source).toContain("Circle");
    expect(source).toContain("CheckCircle");
    expect(source).toContain('weight="fill"');
  });

  it("does not keep destructive classes, dark variants, lucide, or raw palette", () => {
    expect(source).not.toMatch(/bg-destructive|text-destructive|border-destructive|ring-destructive/);
    expect(source).not.toContain("dark:");
    expect(source).not.toContain("lucide");
    expect(source).not.toMatch(/\b(?:dense|comfortable):/);
    expect(source).not.toContain("data-density");
    expect(source).not.toMatch(RAW_PALETTE_RE);
  });

  it("keeps checkboxCardStyles module-private on a directive-free facade", () => {
    expect(facade).not.toContain('"use client"');
    expect(facade).toContain("CheckboxCard");
    expect(facade).toContain("CheckboxCardProps");
    expect(facade).not.toContain("checkboxCardStyles");
    expect(facade).not.toContain("checkboxCardVariants");
    expect(facade).not.toContain("render");
  });
});

describe("CheckboxCard Field.Root requirement", () => {
  it("throws without a Field.Root ancestor", () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(CheckboxCard, {
          title: "Insurance",
          description: "Covers everything.",
          value: "insurance",
        })
      )
    ).toThrow();
  });
});
