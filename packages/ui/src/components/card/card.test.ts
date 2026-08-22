import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { cn } from "../../styles/cn";
import { cardVariants } from "./card-variants";

const here = dirname(fileURLToPath(import.meta.url));

describe("cardVariants", () => {
  it("resolves every slot for the default direction", () => {
    const slots = cardVariants();
    expect(slots.base()).toContain("bg-card");
    expect(slots.base()).toContain("flex-col");
    expect(slots.cardHeader()).toContain("has-data-[slot=card-action]:grid-cols-[1fr_auto]");
    expect(slots.cardHeader()).toContain("@container/card-header");
    expect(slots.cardTag()).toContain("text-muted-foreground");
    expect(slots.cardTitle()).toContain("font-semibold");
    expect(slots.cardDescription()).toContain("text-muted-foreground");
    expect(slots.cardAction()).toContain("col-start-2");
    expect(slots.cardContent()).toContain("p-6");
    expect(slots.cardFooter()).toContain("items-center");
  });

  it("resolves every slot for the horizontal direction", () => {
    const slots = cardVariants({ direction: "horizontal" });
    expect(slots.base()).toContain("flex-row");
    expect(slots.base()).toContain("space-x-6");
    expect(slots.cardHeader()).toContain("space-y-1.5");
    expect(slots.cardTitle()).toContain("text-xl");
    expect(cn(slots.cardContent())).not.toContain("p-6");
  });

  it("carries no destructive, raw palette, or dark classes", () => {
    const slots = cardVariants({ direction: "horizontal" });
    const resolved = [
      slots.base(),
      slots.cardHeader(),
      slots.cardTag(),
      slots.cardTitle(),
      slots.cardDescription(),
      slots.cardAction(),
      slots.cardContent(),
      slots.cardFooter(),
    ].join(" ");
    expect(resolved).not.toContain("dark:");
    expect(resolved).not.toContain("destructive");
    expect(resolved).not.toMatch(/\b(?:bg|text|border)-(?:white|black|gray|zinc|slate|neutral)\b/);
  });
});

describe("card source contract", () => {
  it("ships every spec §10 demo as a runnable file", () => {
    for (const demo of [
      "card-basic.tsx",
      "card-with-action.tsx",
      "card-tag.tsx",
      "card-horizontal.tsx",
      "card-item-rows.tsx",
    ]) {
      expect(existsSync(join(here, "demos", demo)), demo).toBe(true);
    }
  });

  it("stays a server surface that emits data-slot before the props spread", () => {
    const source = readFileSync(join(here, "card.tsx"), "utf8");
    expect(source).not.toContain("use client");
    expect(source).not.toContain(".ref/");
    expect(source).not.toContain("dark:");
    for (const slot of [
      "card",
      "card-header",
      "card-tag",
      "card-title",
      "card-description",
      "card-action",
      "card-content",
      "card-footer",
    ]) {
      const marker = `data-slot="${slot}"`;
      expect(source, marker).toContain(marker);
      expect(source.indexOf(marker), marker).toBeLessThan(
        source.indexOf("{...props}", source.indexOf(marker))
      );
    }
  });

  it("keeps the de-RAC'd parts on plain elements", () => {
    const source = readFileSync(join(here, "card.tsx"), "utf8");
    expect(source).not.toContain("react-aria");
    expect(source).not.toContain("useRender");
    expect(source).toContain("`h${level}`");
  });
});
