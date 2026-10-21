/**
 * The specificity of the selectors Tailwind compiles the kit's recipe classes to. The unit under
 * test is `specificityOf`. The oracle is CSS Selectors Level 4, section 17, computed by hand: an
 * ID counts in A; a class, an attribute or a pseudo-class counts in B; a type selector or a
 * pseudo-element counts in C. `:where()` counts nothing, and `:is()`, `:not()` and `:has()` count
 * their most specific argument.
 */
import { describe, expect, it } from "vitest";

import { specificityOf } from "./specificity";

describe("specificityOf", () => {
  it.each([
    // A plain utility.
    [".border-input", [0, 1, 0]],
    // An escaped class name stays one class.
    [".bg-primary\\/80", [0, 1, 0]],
    [".size-\\[max\\(var\\(--control-h-xs\\)\\,24px\\)\\]", [0, 1, 0]],
    // Tailwind's `aria-*:` and `data-*:` variants add one attribute each.
    ['.aria-invalid\\:border-error[aria-invalid="true"]', [0, 2, 0]],
    ['.aria-invalid\\:aria-checked\\:border-primary[aria-invalid="true"][aria-checked="true"]', [0, 3, 0]],
    [".data-invalid\\:border-error[data-invalid]", [0, 2, 0]],
    // fuse.css's `data-checked:` wraps its attribute in `:where()`.
    ['.data-checked\\:border-primary:where([data-checked]:not([data-checked="false"]))', [0, 1, 0]],
    // `focus-visible:` and `disabled:` from the React Aria plugin: `:is()` counts its most
    // specific argument, here (0,1,0) on either side.
    [
      ".focus-visible\\:ring-2:is(:where([data-rac])[data-focus-visible], :where(:not([data-rac])):focus-visible)",
      [0, 2, 0],
    ],
    [
      '.aria-invalid\\:focus-visible\\:ring-3[aria-invalid="true"]:is(:where([data-rac])[data-focus-visible], :where(:not([data-rac])):focus-visible)',
      [0, 3, 0],
    ],
    // fuse.css's `enabled-hover:` puts all of its arguments in `:where()`, inside or outside `:not()`.
    [
      '.enabled-hover\\:bg-muted:not(:where([data-disabled]:not([data-disabled="false"]), :disabled, [aria-disabled="true"])):where([data-rac][data-hovered], :not([data-rac]):hover)',
      [0, 1, 0],
    ],
    ['.has-data-\\[icon\\=inline-start\\]\\:pl-2:has([data-icon="inline-start"])', [0, 2, 0]],
    // A child selector adds the type selector and the `:not()` argument's attribute.
    [".\\[\\&_svg\\:not\\(\\[class\\*\\=\\'size-\\'\\]\\)\\]\\:size-4 svg:not([class*='size-'])", [0, 2, 1]],
    // A pseudo-element counts in C, an ID in A.
    ["#a .b::before", [1, 1, 1]],
  ])("reads %s as %j", (selector, expected) => {
    expect(specificityOf(selector)).toEqual(expected);
  });

  it("takes the highest alternative of a selector list", () => {
    expect(specificityOf(".a:where([data-state]), .a[data-checked], .a")).toEqual([0, 2, 0]);
  });
});
