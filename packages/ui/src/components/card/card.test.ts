import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { cardDescriptionVariants, cardTitleVariants, cardVariants } from "./card-variants";

const TITLE_SIZES = ["default", "sm", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"] as const;
const DESCRIPTION_SIZES = ["xs", "sm", "default", "lg", "xl", "2xl"] as const;

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

describe("cardTitleVariants", () => {
  it("defaults to 2xl", () => {
    expect(cardTitleVariants()).toBe(cardTitleVariants({ size: "2xl" }));
    expect(cardTitleVariants()).toContain("text-2xl");
  });

  it("resolves each type-scale size without density control metrics", () => {
    expect(cardTitleVariants({ size: "default" })).toContain("text-base");
    expect(cardTitleVariants({ size: "sm" })).toContain("text-sm");
    expect(cardTitleVariants({ size: "lg" })).toContain("text-lg");
    expect(cardTitleVariants({ size: "xl" })).toContain("text-xl");
    expect(cardTitleVariants({ size: "2xl" })).toContain("text-2xl");
    expect(cardTitleVariants({ size: "3xl" })).toContain("text-3xl");
    expect(cardTitleVariants({ size: "4xl" })).toContain("text-4xl");
    expect(cardTitleVariants({ size: "5xl" })).toContain("text-5xl");
    expect(cardTitleVariants({ size: "6xl" })).toContain("text-6xl");
    for (const size of TITLE_SIZES) {
      expect(cardTitleVariants({ size }), size).not.toContain("--control-");
    }
    expect(TITLE_SIZES).toHaveLength(9);
  });
});

describe("cardDescriptionVariants", () => {
  it("defaults to sm", () => {
    expect(cardDescriptionVariants()).toBe(cardDescriptionVariants({ size: "sm" }));
    expect(cardDescriptionVariants()).toContain("text-sm");
  });

  it("resolves each type-scale size without density control metrics", () => {
    expect(cardDescriptionVariants({ size: "xs" })).toContain("text-xs");
    expect(cardDescriptionVariants({ size: "sm" })).toContain("text-sm");
    expect(cardDescriptionVariants({ size: "default" })).toContain("text-base");
    expect(cardDescriptionVariants({ size: "lg" })).toContain("text-lg");
    expect(cardDescriptionVariants({ size: "xl" })).toContain("text-xl");
    expect(cardDescriptionVariants({ size: "2xl" })).toContain("text-2xl");
    for (const size of DESCRIPTION_SIZES) {
      expect(cardDescriptionVariants({ size }), size).not.toContain("--control-");
    }
    expect(DESCRIPTION_SIZES).toHaveLength(6);
  });
});
