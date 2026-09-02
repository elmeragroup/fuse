import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { cardVariants } from "./card-variants";

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
    expect(resolved).not.toMatch(RAW_PALETTE_RE);
  });
});
