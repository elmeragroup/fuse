import preflightCss from "tailwindcss/preflight.css?raw";
import { describe, expect, it } from "vitest";

import { parseScopedBlocks } from "../../test/css-rules";
import fuseCss from "./fuse.css?raw";

// Unit under test: the @layer base preflight mirror in fuse.css. Oracle: tailwindcss/preflight.css.

/** Preflight's document-level rule, which the mirror leaves to the host. */
const DOCUMENT_RULE = "html, :host";

/** The border-role default that precedes the mirror in fuse.css's base layer; it is Fuse's own. */
const BORDER_ROLE_DEFAULT =
  ":where(:not(:is(button, input, select, textarea, meter, progress):not([data-slot]))), ::after, ::before, ::backdrop, :where([data-slot])::file-selector-button";

/** A rule reduced to what the cascade reads: its conditions, its selectors and its declarations. */
type Rule = {
  conditions: readonly string[];
  selectors: readonly string[];
  declarations: readonly string[];
};

/** Collapse whitespace and quote style, which neither sheet's meaning depends on. */
function normalized(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\(\s/g, "(").replace(/\s\)/g, ")").replaceAll("'", '"').trim();
}

/** Split a selector list at its top-level commas, leaving the commas inside `:is()` or `:where()`. */
function selectorList(list: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < list.length; index += 1) {
    const char = list[index];
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      selectors.push(normalized(list.slice(start, index)));
      start = index + 1;
    }
  }
  selectors.push(normalized(list.slice(start)));
  return selectors;
}

/**
 * Preflight's selector scoped to Fuse's own elements: the subject takes `[data-slot]`, the whole
 * weighs nothing inside `:where()`, and a pseudo-element stays outside it, where it must.
 */
function scopedToSlot(selector: string): string {
  const pseudoElement = /::[\w-]+$/.exec(selector)?.[0] ?? "";
  const subject = selector.slice(0, selector.length - pseudoElement.length);
  if (subject === "" || subject === "*") {
    return `:where([data-slot])${pseudoElement}`;
  }
  return `:where(${subject}[data-slot])${pseudoElement}`;
}

/**
 * Preflight's declaration as the mirror must write it. Preflight's `border: 0 solid` also resets
 * the border colour to `currentcolor`, which would undo fuse.css's border-role default in the same
 * layer, so the mirror writes the border's width and style alone.
 */
function mirroredDeclarations(name: string, value: string): string[] {
  if (name === "border") {
    expect(value, "preflight's border reset").toBe("0 solid");
    return ["border-width: 0", "border-style: solid"];
  }
  return [`${name}: ${normalized(value)}`];
}

function styleRules(css: string): Rule[] {
  return parseScopedBlocks(css)
    .filter(({ block }) => !block.prelude.startsWith("@"))
    .map(({ block, ancestors }) => ({
      conditions: ancestors.map(normalized),
      selectors: selectorList(block.prelude),
      declarations: block.declarations.map(({ name, value }) => `${name}: ${normalized(value)}`),
    }));
}

describe("the preflight mirror in fuse.css", () => {
  it("leaves out only preflight's document-level rule", () => {
    // Pins the skip to a rule preflight still has, so a renamed rule cannot drop out unnoticed.
    expect(styleRules(preflightCss).map((rule) => rule.selectors.join(", "))).toContain(DOCUMENT_RULE);
  });

  it("copies every other preflight rule, in order, scoped to [data-slot], with preflight's declarations", () => {
    const expected = parseScopedBlocks(preflightCss)
      .filter(({ block }) => !block.prelude.startsWith("@") && normalized(block.prelude) !== DOCUMENT_RULE)
      .map(({ block, ancestors }) => ({
        conditions: ["@layer base", ...ancestors.map(normalized)],
        selectors: selectorList(block.prelude).map(scopedToSlot),
        declarations: block.declarations.flatMap(({ name, value }) => mirroredDeclarations(name, value)),
      }));
    const mirror = styleRules(fuseCss).filter(
      (rule) => rule.conditions[0] === "@layer base" && rule.selectors.join(", ") !== BORDER_ROLE_DEFAULT
    );
    expect(mirror).toEqual(expected);
  });
});
