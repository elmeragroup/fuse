import { describe, expect, it } from "vitest";

import { colorRolePaints } from "./class-tokens";

/** The role and paint of each class in `code`, without the class. */
function paints(code: string) {
  return colorRolePaints(code).map(({ role, paint }) => ({ role, paint }));
}

describe("colorRolePaints", () => {
  it("reads the role and paint of named, shorthand and arbitrary color utilities", () => {
    expect(paints("enabled-hover:bg-primary/90")).toEqual([{ role: "primary", paint: "surface" }]);
    expect(paints("aria-invalid:ring-offset-error")).toEqual([{ role: "error", paint: "line" }]);
    expect(paints("border-b-selection-divider")).toEqual([{ role: "selection-divider", paint: "line" }]);
    expect(paints("text-(--muted-foreground)")).toEqual([{ role: "muted-foreground", paint: "ink" }]);
    expect(paints("text-[var(--toast-copy,var(--muted-foreground))]")).toEqual([
      { role: "muted-foreground", paint: "ink" },
    ]);
    expect(
      paints(
        "x:bg-[repeating-linear-gradient(45deg,transparent,--theme(--color-selection-disabled-hatch)_8px)]"
      )
    ).toEqual([{ role: "selection-disabled-hatch", paint: "surface" }]);
    for (const token of ["text-sm", "border-2", "bg-black/10", "[--ring:var(--primary)]"]) {
      expect(paints(token), token).toEqual([]);
    }
  });

  it("reads opacity modifiers, type hints and the logical, inset and native color families", () => {
    expect(paints("text-(--feature-foreground)/50")).toEqual([{ role: "feature-foreground", paint: "ink" }]);
    expect(paints("text-(color:--feature-foreground)")).toEqual([
      { role: "feature-foreground", paint: "ink" },
    ]);
    expect(paints("hover:text-(color:--feature-foreground)/[0.5]")).toEqual([
      { role: "feature-foreground", paint: "ink" },
    ]);
    expect(paints("bg-[color:var(--card)]/75")).toEqual([{ role: "card", paint: "surface" }]);
    expect(paints("bg-primary/(--alpha)")).toEqual([{ role: "primary", paint: "surface" }]);
    expect(paints("border-bs-border")).toEqual([{ role: "border", paint: "line" }]);
    expect(paints("border-be-input/50")).toEqual([{ role: "input", paint: "line" }]);
    expect(paints("inset-ring-ring")).toEqual([{ role: "ring", paint: "line" }]);
    expect(paints("accent-primary")).toEqual([{ role: "primary", paint: "surface" }]);
    expect(paints("scrollbar-thumb-border")).toEqual([{ role: "border", paint: "surface" }]);
    // A hint other than color reads a length or an image, never a color.
    for (const token of ["text-(length:--label-text)/normal", "bg-[image:var(--card)]", "shadow-primary"]) {
      expect(paints(token), token).toEqual([]);
    }
  });

  it("paints a role routed through a local variable wherever the module reads that variable", () => {
    // GridList's checkbox box: the disabled arm routes muted into the variable the box draws with.
    const code =
      '"border-(--checkbox-color) bg-(--checkbox-color) [--checkbox-color:var(--primary)]" "[--checkbox-color:var(--muted)] forced-colors:[--checkbox-color:GrayText]!"';
    expect(paints(code)).toEqual([
      { role: "primary", paint: "line" },
      { role: "muted", paint: "line" },
      { role: "primary", paint: "surface" },
      { role: "muted", paint: "surface" },
    ]);
    // A routed role counts through a named utility on the routed role, and through a fallback.
    expect(paints('"[--ring:var(--info-soft-foreground)] focus-visible:ring-ring"')).toEqual([
      { role: "ring", paint: "line" },
      { role: "info-soft-foreground", paint: "line" },
    ]);
    expect(
      paints('"[--toast-copy:var(--error-soft-foreground)] text-[var(--toast-copy,var(--muted-foreground))]"')
    ).toEqual([
      { role: "error-soft-foreground", paint: "ink" },
      { role: "muted-foreground", paint: "ink" },
    ]);
    // A route counts through the shorthand's modifier and type hint too.
    expect(paints('"[--x:var(--feature-foreground)] text-(color:--x)/50"')).toEqual([
      { role: "feature-foreground", paint: "ink" },
    ]);
    // A variable the module assigns but never reads paints nothing.
    expect(paints('"[--checkbox-color:var(--muted)]"')).toEqual([]);
  });
});
