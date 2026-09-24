import { createElement } from "react";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "../components/input/input";
import { Textarea } from "../components/textarea/textarea";
import { fieldBox, fieldBoxChromeClass } from "./field-box";
import { selfFocusRingClass } from "./utils";

function tokens(classes: string): string[] {
  return classes.split(/\s+/).filter(Boolean);
}

function renderedClasses(element: ReturnType<typeof createElement>): string[] {
  const match = /class="([^"]*)"/.exec(renderToStaticMarkup(element));
  if (match?.[1] === undefined) {
    throw new Error("rendered markup has no class attribute");
  }
  return tokens(match[1]);
}

describe("fieldBoxChromeClass", () => {
  it("is the one elevation, radius, border, fill and transition every field box shares", () => {
    expect(tokens(fieldBoxChromeClass)).toEqual([
      "shadow-xs",
      "box-border",
      "rounded-md",
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
      "[font-size:var(--control-text)]",
      "[line-height:var(--control-leading)]",
      "placeholder:text-muted-foreground",
      "disabled:bg-input/50",
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
