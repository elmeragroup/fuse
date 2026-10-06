import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "../components/input/input";
import { Textarea } from "../components/textarea/textarea";
import { cn } from "./cn";
import {
  fieldBox,
  fieldBoxChromeClass,
  inputGroupRootClass,
  readOnlyFillCancelClass,
  readOnlyFillClass,
} from "./field-box";
import { selfFocusRingClass } from "./utils";

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

/** The entities React writes into an attribute value, such as the `&` of `[&[readonly]]:`. */
const ATTRIBUTE_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
};

function renderedClasses(element: ReturnType<typeof createElement>): string[] {
  const match = /class="([^"]*)"/.exec(renderToStaticMarkup(element));
  if (match?.[1] === undefined) {
    throw new Error("rendered markup has no class attribute");
  }
  return tokens(
    match[1].replaceAll(/&(?:amp|lt|gt|quot|#x27);/g, (entity) => ATTRIBUTE_ENTITIES[entity] ?? entity)
  );
}

describe("fieldBoxChromeClass", () => {
  it("is the one elevation, radius, border, fill and transition every field box shares", () => {
    expect(tokens(fieldBoxChromeClass)).toEqual([
      "shadow-xs",
      "box-border",
      // The field corner, declared for the parts inside the box: --radius-field at the external
      // 2px step, --radius at the internal 0px.
      "rounded-(--field-corner)",
      "[--field-corner:clamp(var(--radius)-1000*var(--radius-step,0px),var(--radius-field,var(--radius)),var(--radius)+1000*var(--radius-step,0px))]",
      "border",
      "border-input",
      "bg-card",
      "transition-[color,border-color,box-shadow]",
    ]);
  });
});

describe("fieldBox recipe", () => {
  it("owns shared chrome and one transition list", () => {
    const classes = tokens(fieldBox());
    for (const token of [
      "bg-card",
      "border-input",
      "h-(--control-h-md)",
      "px-(--control-px-md)",
      "text-(length:--control-text)",
      "leading-(--control-leading)",
      "placeholder:text-muted-foreground",
      "disabled:bg-input/50",
      // The read-only fill keys off the attribute: `:read-only` also matches disabled and file inputs.
      "[&[readonly]:not(:disabled)]:bg-muted",
      "transition-[color,border-color,box-shadow]",
    ]) {
      expect(classes).toContain(token);
    }
    expect(classes).not.toContain("transition-[color,box-shadow,border-color]");
    // Oracle: the shared focus recipe, which utils.test.ts pins by hand.
    for (const token of selfFocusRingClass.split(" ")) {
      expect(classes).toContain(token);
    }
  });

  it("pins the control rung by default and swaps to content sizing on the box axis", () => {
    const control = tokens(fieldBox());
    expect(control).toContain("h-(--control-h-md)");
    expect(control).not.toContain("min-h-16");
    expect(control).not.toContain("py-2");

    const content = tokens(fieldBox({ box: "content" }));
    expect(content).toContain("min-h-16");
    expect(content).toContain("py-2");
    expect(content).not.toContain("h-(--control-h-md)");
    expect(content).not.toContain("h-auto");
  });

  it("spells the read-only predicate once across the fill, its cancel and InputGroup's root", () => {
    // Unit: the three literals Tailwind must find as written. Oracle: the attribute predicate the
    // fill documents. tailwind-merge only replaces the fill with its cancel when the two share
    // one variant, and the root only reads its control when it uses the same predicate.
    const predicate = "[readonly]:not(:disabled)";
    expect(readOnlyFillClass).toBe(`[&${predicate}]:bg-muted`);
    expect(readOnlyFillCancelClass).toBe(`[&${predicate}]:bg-transparent`);
    expect(tokens(inputGroupRootClass)).toContain(`has-[>[data-focus-ring-control]${predicate}]:bg-muted`);
    expect(tokens(cn(fieldBox(), readOnlyFillCancelClass))).not.toContain(readOnlyFillClass);
  });

  it("survives both hosts uncancelled: every recipe class reaches the DOM", () => {
    const input = renderedClasses(createElement(Input));
    for (const token of tokens(fieldBox())) {
      expect(input, "Input").toContain(token);
    }

    const textarea = renderedClasses(createElement(Textarea));
    for (const token of tokens(fieldBox({ box: "content" }))) {
      expect(textarea, "Textarea").toContain(token);
    }
  });
});
