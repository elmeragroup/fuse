import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
import { Card } from "./card";
import { cardDescriptionVariants, cardTitleVariants, cardVariants } from "./card-variants";

const TITLE_SIZE_CLASS = {
  default: "text-base",
  sm: "text-sm",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
  "4xl": "text-4xl",
  "5xl": "text-5xl",
  "6xl": "text-6xl",
} as const;
const DESCRIPTION_SIZE_CLASS = {
  xs: "text-xs",
  sm: "text-sm",
  default: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
} as const;
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
    expect(slots.base()).toContain("flex-wrap");
    expect(slots.cardHeader()).toContain("grid");
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

describe("card title icon", () => {
  it("puts the title in a flex row with the icon gap", () => {
    const html = renderToStaticMarkup(
      createElement(Card.Title, { icon: createElement("svg") }, "March usage")
    );
    expect(html).toContain("gap-x-1.5");
    expect(html).toContain("flex");
    expect(html).toContain("items-center");
  });
});

describe("cardTitleVariants", () => {
  it("defaults to 2xl", () => {
    expect(cardTitleVariants()).toContain("text-2xl");
  });

  it("resolves each type-scale size without density control metrics", () => {
    expect(Object.keys(cardTitleVariants.variants.size)).toEqual(TITLE_SIZES);
    for (const size of TITLE_SIZES) {
      expect(cardTitleVariants({ size }), size).toContain(TITLE_SIZE_CLASS[size]);
      expect(cardTitleVariants({ size }), size).not.toContain("--control-");
    }
  });
});

describe("cardDescriptionVariants", () => {
  it("defaults to sm", () => {
    expect(cardDescriptionVariants()).toContain("text-sm");
  });

  it("resolves each type-scale size without density control metrics", () => {
    expect(Object.keys(cardDescriptionVariants.variants.size)).toEqual(DESCRIPTION_SIZES);
    for (const size of DESCRIPTION_SIZES) {
      expect(cardDescriptionVariants({ size }), size).toContain(DESCRIPTION_SIZE_CLASS[size]);
      expect(cardDescriptionVariants({ size }), size).not.toContain("--control-");
    }
  });
});
