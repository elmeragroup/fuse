import { describe, expect, it } from "vitest";

import {
  evaluateNumber,
  evaluatePercentage,
  makeVariableIndex,
  readColor,
  readNumber,
  readShadows,
  substituteVars,
} from "./css-values";

const primary = { collection: "Fuse tokens", name: "primary" };
const ring = { collection: "Fuse tokens", name: "ring" };
const outlineWidth = { collection: "Fuse tokens", name: "button-outline-width" };
const radiusMd = { collection: "Fuse tokens", name: "radius-md" };
const primary80 = { collection: "Fuse tokens", name: "primary/80" };
const index = makeVariableIndex([
  { ref: primary, webSyntax: "var(--primary)" },
  { ref: primary80, webSyntax: "color-mix(in oklab, var(--primary) 80%, transparent)" },
  { ref: ring, webSyntax: "var(--ring)" },
  { ref: outlineWidth, webSyntax: "var(--button-outline-width)" },
  { ref: radiusMd, webSyntax: "calc(var(--radius) - var(--radius-step, 0px))" },
]);

describe("makeVariableIndex", () => {
  it("finds a variable by its code syntax, ignoring whitespace and a var() fallback", () => {
    expect(index.lookup("var(--primary)")).toEqual(primary);
    expect(index.lookup("var(--button-outline-width,1px)")).toEqual(outlineWidth);
    expect(index.lookup("calc(var(--radius) - var(--radius-step,0px))")).toEqual(radiusMd);
    expect(index.lookup("var(--muted)")).toBeUndefined();
    expect(index.owns("--primary")).toBe(true);
    expect(index.owns("--tw-ring-color")).toBe(false);
  });
});

describe("substituteVars", () => {
  const values = new Map([
    ["--tw-ring-color", "var(--ring)"],
    ["--tw-ring-offset-width", "0px"],
  ]);

  it("replaces known variables, keeps synced ones and falls back for unset ones", () => {
    const read = new Set<string>();
    const ringShadow =
      "var(--tw-ring-inset,) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor)";
    const declared = (name: string) => {
      const value = values.get(name);
      return value === undefined ? undefined : { value, computed: false };
    };
    expect(substituteVars(ringShadow, declared, index.owns, read)).toBe(" 0 0 0 calc(2px + 0px) var(--ring)");
    expect([...read]).toEqual(["--tw-ring-offset-width", "--tw-ring-color"]);
  });

  it("reports a variable with no value and no fallback", () => {
    expect(substituteVars("var(--unset)", () => undefined, index.owns, new Set())).toBeUndefined();
  });

  it.each([false, true] as const)(
    "reads a variable set to initial as guaranteed-invalid and takes the fallback (computed: %s)",
    (computed) => {
      const initial = () => ({ value: " initial", computed });
      expect(substituteVars("var(--field-h,2.25rem)", initial, index.owns, new Set())).toBe("2.25rem");
      expect(substituteVars("var(--field-h)", initial, index.owns, new Set())).toBeUndefined();
    }
  );
});

describe("evaluateNumber", () => {
  it("evaluates lengths in pixels at a 16px root", () => {
    expect(evaluateNumber("0px")).toBe(0);
    expect(evaluateNumber("0.875rem")).toBe(14);
    expect(evaluateNumber("calc(0.25rem * 4)")).toBe(16);
    expect(evaluateNumber("calc(2px + 0px)")).toBe(2);
    expect(evaluateNumber("max(0px, 4px - 2px)")).toBe(2);
    expect(evaluateNumber("calc(1.25 / 0.875)")).toBeCloseTo(1.428_571, 5);
    expect(evaluateNumber("50%")).toBe(0.5);
    expect(evaluateNumber("500")).toBe(500);
  });

  it("refuses anything that still references a variable", () => {
    expect(evaluateNumber("calc(2px - var(--x))")).toBeUndefined();
    expect(evaluateNumber("auto")).toBeUndefined();
  });
});

describe("readNumber", () => {
  it("binds a synced variable and evaluates a literal", () => {
    expect(readNumber("var(--button-outline-width,1px)", index)).toEqual({
      kind: "variable",
      variable: outlineWidth,
    });
    expect(readNumber("calc(0.25rem * 4)", index)).toEqual({ kind: "literal", value: 16 });
    expect(readNumber("max(0px, 4px - 2 * var(--button-outline-width, 1px))", index)).toBeUndefined();
  });
});

describe("readNumber with a target floor", () => {
  const controlHXs = { collection: "Fuse density", name: "control-h-xs" };
  const indexWithMinimum = (minimum: number) =>
    makeVariableIndex([{ ref: controlHXs, webSyntax: "var(--control-h-xs)", minimum }]);

  it("binds the variable when it never falls below the floor in any mode", () => {
    expect(readNumber("max(var(--control-h-xs), 24px)", indexWithMinimum(24))).toEqual({
      kind: "variable",
      variable: controlHXs,
    });
    expect(readNumber("max(24px,var(--control-h-xs))", indexWithMinimum(32))).toEqual({
      kind: "variable",
      variable: controlHXs,
    });
  });

  it("leaves the max() unmapped when some mode falls below the floor", () => {
    expect(readNumber("max(var(--control-h-xs), 24px)", indexWithMinimum(20))).toBeUndefined();
  });

  // Oracle: CSS Values 4, where a percentage resolves against the containing block, so a floor of
  // `100%` is not a length the variable can be compared with.
  it("leaves a percentage floor unmapped", () => {
    expect(readNumber("max(var(--control-h-xs), 100%)", indexWithMinimum(24))).toBeUndefined();
  });
});

// Oracle: CSS Values 4 "mixing percentages", under which a sum, product, `min()` or `max()` with a
// percentage operand depends on the containing block whatever the operand order, which a Figma
// number field cannot hold.
describe("readNumber over a percentage", () => {
  it.each(["100%", "calc(4px + 100%)", "calc(100% + 4px)", "min(100%, 4px)", "max(4px, 100%)"])(
    "refuses %s",
    (value) => {
      expect(readNumber(value, index)).toBeUndefined();
    }
  );
});

// Oracle: CSS Values 4. `calc(1 / 2 * 100%)`, which `top-1/2` compiles to, is half the containing
// block, and multiplying it by -1 negates the share. A sum with a length, such as
// `calc(-100% + 0.5px)`, is no share of the block, though its numbers add up to -0.5.
describe("evaluatePercentage", () => {
  it.each([
    ["50%", 0.5],
    ["calc(1 / 2 * 100%)", 0.5],
    ["calc(calc(1 / 2 * 100%) * -1)", -0.5],
  ])("reads %s as %d", (value, share) => {
    expect(evaluatePercentage(value)).toBe(share);
  });

  it.each(["calc(-100% + 0.5px)", "8px", "0.5"])("refuses %s", (value) => {
    expect(evaluatePercentage(value)).toBeUndefined();
  });
});

describe("readColor", () => {
  it("binds a variable or a role tint, reads literals, and leaves a mix without a tint unmapped", () => {
    expect(readColor("var(--primary)", index)).toEqual({ kind: "variable", variable: primary });
    expect(readColor("color-mix(in oklab,var(--primary) 80%,transparent)", index)).toEqual({
      kind: "variable",
      variable: primary80,
    });
    expect(readColor("transparent", index)).toEqual({ kind: "literal", color: { r: 0, g: 0, b: 0, a: 0 } });
    expect(readColor("#ff0000", index)).toEqual({ kind: "literal", color: { r: 1, g: 0, b: 0, a: 1 } });
    expect(readColor("color-mix(in oklab, var(--muted) 50%, transparent)", index)).toBeUndefined();
  });

  // Oracle: CSS Color 5 §2.4, where a mix interpolates premultiplied colors, so a mix toward
  // `transparent`, all zeros premultiplied, keeps the color's channels in any space and scales its
  // alpha, as `outline-black/10` paints black at 10%.
  it.each(["color-mix(in oklab, #000 10%, transparent)", "color-mix(in srgb,#000000 10%,transparent)"])(
    "reads %s as the color at that share of its alpha",
    (value) => {
      expect(readColor(value, index)).toEqual({ kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.1 } });
    }
  );

  // Oracle: CSS Color 5 §2.1, whose `color-mix()` grammar takes a percentage from 0% to 100%, so a
  // share past 100% is no color, and no paint takes an alpha above 1.
  it("leaves a mix whose share lies outside 0% to 100% unmapped", () => {
    expect(readColor("color-mix(in oklab, #000 200%, transparent)", index)).toBeUndefined();
  });
});

describe("readShadows", () => {
  it("drops Tailwind's empty layers and reads a ring as a spread shadow", () => {
    expect(readShadows("0 0 #0000, 0 0 #0000, 0 0 0 calc(2px + 0px) var(--ring), 0 0 #0000", index)).toEqual([
      {
        color: { kind: "variable", variable: ring },
        offsetX: 0,
        offsetY: 0,
        radius: { kind: "literal", value: 0 },
        spread: { kind: "literal", value: 2 },
      },
    ]);
    expect(readShadows("0 1px 2px 0 rgba(0, 0, 0, 0.05)", index)).toEqual([
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.05 } },
        offsetX: 0,
        offsetY: 1,
        radius: { kind: "literal", value: 2 },
        spread: { kind: "literal", value: 0 },
      },
    ]);
  });

  it("binds a blur and spread that spell a synced length's code syntax", () => {
    const blur = { collection: "Fuse tokens", name: "button-outline-shadow-blur" };
    const spread = { collection: "Fuse tokens", name: "button-outline-shadow-spread" };
    const withLengths = makeVariableIndex([
      { ref: outlineWidth, webSyntax: "var(--button-outline-width)" },
      { ref: blur, webSyntax: "max(0px, 4px - 2 * var(--button-outline-width, 1px))" },
      { ref: spread, webSyntax: "min(0px, 2px - 2 * var(--button-outline-width, 1px))" },
    ]);
    // Tailwind's compiled outline shadow once its own variables are substituted, which drops the
    // fallback of the synced `--button-outline-width`.
    expect(
      readShadows(
        "0 1px max(0px, 4px - 2 * var(--button-outline-width)) min(0px, 2px - 2 * var(--button-outline-width)) rgb(0 0 0/0.05)",
        withLengths
      )
    ).toEqual([
      {
        color: { kind: "literal", color: { r: 0, g: 0, b: 0, a: 0.05 } },
        offsetX: 0,
        offsetY: 1,
        radius: { kind: "variable", variable: blur },
        spread: { kind: "variable", variable: spread },
      },
    ]);
  });

  it("refuses inset shadows", () => {
    expect(readShadows("inset 0 0 0 1px var(--ring)", index)).toBeUndefined();
  });
});
