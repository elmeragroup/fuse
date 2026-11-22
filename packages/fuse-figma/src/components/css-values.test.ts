import { describe, expect, it } from "vitest";

import {
  canonicalCss,
  sameCssValue,
  evaluateLength,
  evaluateNumber,
  evaluatePercentage,
  inFont,
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

describe("inFont", () => {
  it("takes an em as the font size, inside max() and beside px", () => {
    expect(evaluateLength(inFont("0.2em", 16))).toBeCloseTo(3.2);
    expect(evaluateLength(inFont("max(1px, 0.0625em)", 10))).toBe(1);
    expect(evaluateLength(inFont("max(1px,0.0625em)", 32))).toBe(2);
    expect(evaluateLength(inFont("calc(0.5em + 2px)", 20))).toBe(12);
  });

  it("leaves rem at the 16px root and px as they are", () => {
    expect(evaluateLength(inFont("0.5rem", 40))).toBe(8);
    expect(evaluateLength(inFont("3px", 40))).toBe(3);
  });

  it("evaluates no percentage or keyword", () => {
    expect(evaluateLength(inFont("10%", 16))).toBeUndefined();
    expect(evaluateLength(inFont("auto", 16))).toBeUndefined();
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

  // Oracle: CSS Color 4 §9.2 and §9.3, where an `oklab()` or `oklch()` lightness of 100% is 1, so
  // lightness 0 is black and 1 is white, and the alpha after the slash is the color's alpha. Tailwind
  // compiles Frame's `shadow-[…_black]/5` to `oklab(0% 0 0 / .05)`. A number may take an exponent
  // (CSS Syntax 3 §4.3.12): Chromium computes `oklab(1e2% 0 0 / 50%)` as `oklab(1 0 0 / 0.5)`.
  it.each([
    ["oklab(0% 0 0 / .05)", { r: 0, g: 0, b: 0, a: 0.05 }],
    ["oklab(100% 0 0)", { r: 1, g: 1, b: 1, a: 1 }],
    ["oklch(0% 0 0 / 50%)", { r: 0, g: 0, b: 0, a: 0.5 }],
    ["oklab(1e2% 0 0 / 50%)", { r: 1, g: 1, b: 1, a: 0.5 }],
  ])("reads %s, whose lightness is a percentage", (value, color) => {
    const read = readColor(value, index);
    expect(read?.kind).toBe("literal");
    if (read?.kind !== "literal") {
      return;
    }
    for (const channel of ["r", "g", "b", "a"] as const) {
      expect(read.color[channel], channel).toBeCloseTo(color[channel], 6);
    }
  });

  // Oracle: Chromium, which computes `oklab(1e400% 0 0)` as `oklab(1 0 0)`, clamping the lightness to
  // 100% (CSS Color 4 §9.2), and refuses `oklab(1.% 0 0)`, since a CSS number's fraction needs a digit
  // after the point (CSS Syntax 3 §4.3.12).
  it("clamps a percentage lightness past 100% to white", () => {
    const read = readColor("oklab(1e400% 0 0)", index);
    const channels = read?.kind === "literal" ? read.color : undefined;
    expect(
      channels === undefined ? channels : Object.values(channels).map((channel) => channel.toFixed(6))
    ).toEqual(["1.000000", "1.000000", "1.000000", "1.000000"]);
  });

  it("leaves a lightness with no digit after its point unmapped", () => {
    expect(readColor("oklab(1.% 0 0)", index)).toBeUndefined();
  });

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

describe("canonicalCss", () => {
  it("spells notation-only differences alike, as a minifier rewrites them", () => {
    expect(canonicalCss("0.25rem")).toBe("0.25rem");
    expect(canonicalCss(".25rem")).toBe("0.25rem");
    expect(canonicalCss("200ms")).toBe("0.2s");
    expect(canonicalCss(".2s")).toBe("0.2s");
    expect(canonicalCss("0px")).toBe("0");
    expect(canonicalCss("calc( 0.5 * 100% )")).toBe("calc(0.5 * 100%)");
    expect(canonicalCss("translate(-.5rem,0px)")).toBe("translate(-0.5rem,0)");
  });

  it("keeps values apart that differ in meaning", () => {
    expect(canonicalCss("1rem")).toBe("1rem");
    expect(canonicalCss("0%")).toBe("0%");
    expect(canonicalCss("#0000000d")).toBe("#0000000d");
    expect(canonicalCss("var(--spacing-04)")).toBe("var(--spacing-04)");
    expect(canonicalCss("2ms")).toBe("0.002s");
  });

  // CSS Values 4 §10.1: a `calc()` filling a math function's argument reads as parentheses, and a
  // zero length added or taken last leaves a length sum as it is. So the gutter Frame's bar inset,
  // its text inset less a 0px overhang, is the text inset a framed Table's edge head pads with.
  it("spells a length sum alike with a zero length taken from it", () => {
    const inset = { collection: "Fuse density", name: "frame-bar-inset" } as const;
    const frame = makeVariableIndex([
      { ref: inset, webSyntax: "calc(calc(1px + var(--surface-pad-lg)) - 0px)" },
    ]);
    expect(frame.lookup("calc(1px + var(--surface-pad-lg))")).toEqual(inset);
    expect(frame.lookup("calc(1px + var(--surface-pad-lg) - 1px)")).toBeUndefined();
    expect(canonicalCss("calc(4px * 0)")).toBe("calc(4px * 0)");
  });

  // Chromium rejects a sum of a length and a unitless number, so `padding-left:
  // calc(1px + var(--surface-pad-lg) + 0)` computes to 0px, not to the 17px the bar inset holds.
  it("keeps a unitless zero, or a zero length beside a number, in its sum", () => {
    const inset = { collection: "Fuse density", name: "frame-bar-inset" } as const;
    const frame = makeVariableIndex([
      { ref: inset, webSyntax: "calc(calc(1px + var(--surface-pad-lg)) - 0px)" },
    ]);
    expect(frame.lookup("calc(1px + var(--surface-pad-lg) + 0)")).toBeUndefined();
    expect(canonicalCss("calc(4px + 0)")).toBe("calc(4px + 0)");
    expect(canonicalCss("calc(2 + 0px)")).not.toBe("calc(2)");
    expect(canonicalCss("calc(4px + 0deg)")).toBe("calc(4px + 0deg)");
  });

  // Chromium type-checks a math function (CSS Values 4 §10.9). With --radius 16px and
  // --surface-pad-md 4px, `max(0, calc(<radius> - <pad>))` mixes a number with a length and computes
  // to 0px, not the 12px the corner holds. `max(calc(0px, <radius> - <pad>))` holds a `calc()` of two
  // arguments, which is invalid. `opacity: calc(min(0.4, 0.5) + 0px)` adds a length to a number and
  // computes to 1, not to the 0.4 its sum would without the zero.
  const innerCorner = { collection: "Fuse density", name: "radius-inner/lg-pad-md" } as const;
  const corners = makeVariableIndex([
    { ref: innerCorner, webSyntax: "max(0px, var(--radius) - var(--surface-pad-md))" },
  ]);

  it("binds a corner whose `calc()` fills a `max()` argument", () => {
    expect(corners.lookup("max(0px, calc(var(--radius) - var(--surface-pad-md)))")).toEqual(innerCorner);
  });

  it.each([
    ["a unitless zero beside a length", "max(0, calc(var(--radius) - var(--surface-pad-md)))"],
    ["a `calc()` of two arguments", "max(calc(0px, var(--radius) - var(--surface-pad-md)))"],
  ])("binds no corner through %s", (_case, value) => {
    expect(corners.lookup(value)).toBeUndefined();
  });

  it("keeps a zero length added to a number", () => {
    expect(canonicalCss("calc(min(0.4, 0.5) + 0px)")).not.toBe(canonicalCss("calc(min(0.4, 0.5))"));
  });

  // Chromium accepts `width: clamp(none, 10px, 20px)`, whose `none` lifts the lower bound, and rejects
  // `width: clamp(calc(none), 10px, 20px)`: `none` is no term of a `calc()` sum.
  it("keeps a `calc()` that holds no numeric expression", () => {
    expect(canonicalCss("clamp(calc(none), 10px, 20px)")).not.toBe(canonicalCss("clamp(none, 10px, 20px)"));
  });

  // With `--bound: none`, Chromium gives `width: clamp(var(--bound), 10px, 20px)` 10px and
  // `width: clamp(calc(var(--bound)), 10px, 20px)` the available width: the `calc()` turns the
  // substituted `none` invalid at computed-value time.
  it("keeps a `calc()` that holds only a `var()`", () => {
    expect(canonicalCss("clamp(calc(var(--bound)), 10px, 20px)")).not.toBe(
      canonicalCss("clamp(var(--bound), 10px, 20px)")
    );
  });
});

describe("sameCssValue", () => {
  it("reads values that evaluate alike as the same", () => {
    expect(sameCssValue("width", "calc(0.25rem * 4)", "1rem")).toBe(true);
    expect(sameCssValue("border-color", "transparent", "#0000")).toBe(true);
    expect(sameCssValue("opacity", "50%", ".5")).toBe(true);
    expect(sameCssValue("top", "calc(1 / 2 * 100%)", "50%")).toBe(true);
  });

  it("keeps values apart that differ in meaning", () => {
    expect(sameCssValue("width", "calc(0.25rem * 4)", "15px")).toBe(false);
    expect(sameCssValue("color", "rgb(0 0 0 / 0.05)", "#0000000d")).toBe(false);
    expect(sameCssValue("width", "50%", ".5")).toBe(false);
  });
});
