import { describe, expect, it } from "vitest";

import { RAW_PALETTE_RE } from "../../../test/raw-palette";
import { cn } from "../../styles/cn";
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
  type Slot = keyof ReturnType<typeof cardVariants>;
  it.each<[string, { direction?: "horizontal" }, [Slot, string][], [Slot, string][]]>([
    [
      "default",
      {},
      [
        ["base", "bg-card"],
        ["base", "flex-col"],
        ["cardHeader", "has-data-[slot=card-action]:grid-cols-[1fr_auto]"],
        ["cardHeader", "@container/card-header"],
        ["cardTag", "text-muted-foreground"],
        ["cardTitle", "font-semibold"],
        ["cardDescription", "text-muted-foreground"],
        ["cardAction", "col-start-2"],
        ["cardContent", "p-6"],
        ["cardFooter", "items-center"],
      ],
      [],
    ],
    [
      "horizontal",
      { direction: "horizontal" },
      [
        ["base", "flex-row"],
        ["base", "flex-wrap"],
        ["cardHeader", "grid"],
        ["cardTitle", "text-xl"],
      ],
      [["cardContent", "p-6"]],
    ],
  ])("resolves every slot for the %s direction", (_name, props, present, absent) => {
    const slots = cardVariants(props);
    for (const [slot, token] of present) {
      expect(slots[slot](), slot).toContain(token);
    }
    for (const [slot, token] of absent) {
      expect(cn(slots[slot]()), slot).not.toContain(token);
    }
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

describe("card type-scale recipes", () => {
  it.each([
    ["cardTitleVariants", "text-2xl", cardTitleVariants],
    ["cardDescriptionVariants", "text-sm", cardDescriptionVariants],
  ] as const)("%s defaults to %s", (_name, expected, recipe) => {
    expect(recipe()).toContain(expected);
  });

  it("resolves each type-scale size of both recipes without density control metrics", () => {
    expect(Object.keys(cardTitleVariants.variants.size)).toEqual(TITLE_SIZES);
    for (const size of TITLE_SIZES) {
      expect(cardTitleVariants({ size }), size).toContain(TITLE_SIZE_CLASS[size]);
      expect(cardTitleVariants({ size }), size).not.toContain("--control-");
    }
    expect(Object.keys(cardDescriptionVariants.variants.size)).toEqual(DESCRIPTION_SIZES);
    for (const size of DESCRIPTION_SIZES) {
      expect(cardDescriptionVariants({ size }), size).toContain(DESCRIPTION_SIZE_CLASS[size]);
      expect(cardDescriptionVariants({ size }), size).not.toContain("--control-");
    }
  });
});
