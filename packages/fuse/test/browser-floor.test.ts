import { describe, expect, it } from "vitest";

import { browserFloorProblems } from "./browser-floor";
import type { FloorApproval, FloorEquivalence, FloorFallback } from "./browser-floor";

// Unit under test: the browser-floor gate's reading of a sheet and its approvals. Oracle: MDN's
// browser-compat-data rows for each syntax, written out by hand. The real-sheet run in
// src/styles/browser-floor.test.ts proves what the shipped sheets use and that their fallbacks
// hold; these cover the syntax and the failures those sheets cannot show.

function problemTags(
  css: string,
  approvals: readonly FloorApproval[] = [],
  equivalences: readonly FloorEquivalence[] = []
): string[] {
  return browserFloorProblems([{ name: "test.css", css }], approvals, equivalences).map(
    (problem) => problem._tag
  );
}

function unapprovedFeatures(css: string): string[][] {
  return browserFloorProblems([{ name: "test.css", css }], []).map((problem) =>
    problem._tag === "Unapproved" ? [...problem.use.features] : [problem._tag]
  );
}

describe("browser-floor reading", () => {
  it.each([
    {
      syntax: "a round() a parser could resolve",
      css: "a{width:round(10px,3px)}",
      features: ["css.types.round"],
    },
    {
      syntax: "a relative colour a parser could resolve",
      css: "a{color:rgb(from red r g b)}",
      features: ["css.types.color.rgb.relative_syntax"],
    },
    {
      syntax: "an rgba() relative colour by its rgb() row",
      css: "a{color:rgba(from red r g b)}",
      features: ["css.types.color.rgb.relative_syntax"],
    },
    {
      syntax: "an hsla() relative colour by its hsl() row",
      css: "a{color:hsla(from red h s l)}",
      features: ["css.types.color.hsl.relative_syntax"],
    },
    {
      syntax: "an upper-case relative colour",
      css: "a{color:rgb(FROM red r g b)}",
      features: ["css.types.color.rgb.relative_syntax"],
    },
    {
      syntax: "an upper-case keyword",
      css: "a{grid-template-columns:SUBGRID}",
      features: ["css.properties.grid-template-columns.subgrid"],
    },
    {
      syntax: "a CSS-wide keyword",
      css: "a{color:revert-rule}",
      features: ["css.types.global_keywords.revert-rule"],
    },
    {
      syntax: "a CSS-wide keyword in a custom property",
      css: "a{--tone:revert-rule}",
      features: ["css.types.global_keywords.revert-rule"],
    },
    {
      syntax: "linear() by its easing-function row",
      css: "a{transition-timing-function:linear(0,1)}",
      features: ["css.types.easing-function.linear-function"],
    },
    {
      syntax: "a typed attr() with a fallback",
      css: "a{width:attr(data-width px,100px)}",
      features: ["css.types.attr.declaration-value", "css.types.attr.fallback"],
    },
    {
      syntax: "a multi-keyword display",
      css: "a{display:block grid}",
      features: ["css.properties.display.multi-keyword_values"],
    },
    {
      syntax: "a unit inside a media condition",
      css: "@media (width >= 10cap){a{color:red}}",
      features: ["css.types.length.cap"],
    },
    {
      syntax: "a conditional rule nested in a style rule",
      css: "a{color:red;@supports (color:red){color:blue}}",
      features: ["css.selectors.nesting"],
    },
    {
      syntax: "a named container style query",
      css: "@container chart style(--compact: true){a{color:red}}",
      features: ["css.at-rules.container.style_queries_for_custom_properties"],
    },
  ])("names $syntax as written", ({ css, features }) => {
    expect(unapprovedFeatures(css)).toEqual([features]);
  });

  it.each([
    { syntax: "a bare attr()", css: "a::before{content:attr(data-label)}" },
    { syntax: "attr() of an attribute named from", css: "a::before{content:attr(from)}" },
    { syntax: "attr() of an attribute named raw-string", css: "a::before{content:attr(raw-string)}" },
    { syntax: "a conic gradient's start angle", css: "a{background:conic-gradient(from 90deg,red,blue)}" },
  ])("reads $syntax as the floor's own", ({ css }) => {
    expect(problemTags(css)).toEqual([]);
  });

  it("fails a name no table maps, and a name MDN lacks", () => {
    expect(problemTags("a{width:frobnicate(1px)}")).toEqual(["Unmapped"]);
    expect(problemTags("a{width:1zz}")).toEqual(["Unmapped"]);
    expect(problemTags("@frobnicate{a{color:red}}")).toEqual(["UnknownFeature"]);
  });
});

describe("browser-floor forgiving selector lists", () => {
  const rtl: FloorEquivalence = {
    selector: ":dir(rtl)",
    equivalents: ['[dir="rtl"]', '[dir="rtl"] *'],
    reason: "test",
  };
  const tailwindRtl = 'a:where(:dir(rtl),[dir="rtl"],[dir="rtl"] *){color:red}';

  it.each([
    { name: "with no equivalence listed", css: tailwindRtl, tags: ["Unapproved"], equivalences: [] },
    {
      name: "beside a sibling that is not its equivalent",
      css: "a:is(:dir(rtl),:focus){color:red}",
      tags: ["Unapproved", "StaleEquivalence"],
      equivalences: [rtl],
    },
    {
      name: "beside part of its equivalents",
      css: 'a:is(:dir(rtl),[dir="rtl"]){color:red}',
      tags: ["Unapproved", "StaleEquivalence"],
      equivalences: [rtl],
    },
  ])("needs an approval $name", ({ css, tags, equivalences }) => {
    expect(problemTags(css, [], equivalences)).toEqual(tags);
  });
});

describe("browser-floor approvals", () => {
  const fade = "linear-gradient(red,transparent)";
  const approve = (
    use: Pick<FloorApproval, "property" | "value" | "features" | "fallback"> &
      Partial<Pick<FloorApproval, "where">>
  ): FloorApproval => ({
    sheet: "test.css",
    where: "a",
    ...use,
    reason: "test",
  });
  const maskImage = (fallback: FloorFallback): FloorApproval =>
    approve({ property: "mask-image", value: fade, features: ["css.properties.mask-image"], fallback });
  const webkitFirst = maskImage({ kind: "declaration", property: "-webkit-mask-image", value: fade });

  it.each([
    { name: "fails without its fallback", css: `a{mask-image:${fade}}`, tags: ["FallbackMissing"] },
    {
      name: "fails when the fallback's value changes",
      css: `a{-webkit-mask-image:banana;mask-image:${fade}}`,
      tags: ["FallbackMissing"],
    },
    {
      name: "fails when a later declaration overrides the fallback",
      css: `a{-webkit-mask-image:${fade};-webkit-mask-image:none;mask-image:${fade}}`,
      tags: ["FallbackMissing"],
    },
    {
      name: "fails when a declaration after the use overrides the fallback",
      css: `a{-webkit-mask-image:${fade};mask-image:${fade};-webkit-mask-image:none}`,
      tags: ["FallbackMissing"],
    },
    {
      name: "fails when an earlier !important declaration beats the fallback",
      css: `a{-webkit-mask-image:none !important;-webkit-mask-image:${fade};mask-image:${fade}}`,
      tags: ["FallbackMissing"],
    },
    {
      name: "fails when a later shorthand resets the fallback",
      css: `a{-webkit-mask-image:${fade};mask-image:${fade};-webkit-mask:none}`,
      tags: ["FallbackMissing"],
    },
    {
      name: "fails when an !important shorthand keeps the fallback's longhand past a partial override",
      css: `a{-webkit-mask:none!important;-webkit-mask-repeat:no-repeat!important;-webkit-mask-image:${fade};mask-image:${fade}}`,
      tags: ["FallbackMissing"],
    },
    {
      name: "fails with its fallback after it",
      css: `a{mask-image:${fade};-webkit-mask-image:${fade}}`,
      tags: ["FallbackMissing"],
    },
    {
      name: "fails when the use's value changes",
      css: `a{-webkit-mask-image:${fade};mask-image:linear-gradient(blue,transparent)}`,
      tags: ["Unapproved", "StaleApproval"],
    },
    {
      name: "fails when the sheet repeats the use",
      css: `a{-webkit-mask-image:${fade};mask-image:${fade}}a{-webkit-mask-image:${fade};mask-image:${fade}}`,
      tags: ["CountMismatch"],
    },
    {
      name: "fails when a guard moves the use",
      css: `@supports (display:grid){a{-webkit-mask-image:${fade};mask-image:${fade}}}`,
      tags: ["Unapproved", "StaleApproval"],
    },
    { name: "is stale once its use is gone", css: "a{color:red}", tags: ["StaleApproval"] },
  ])("a declaration fallback $name", ({ css, tags }) => {
    expect(problemTags(css, [webkitFirst])).toEqual(tags);
  });

  it.each([
    {
      name: "a var() value",
      css: "a{width:10px;width:round(var(--size),1px)}",
      property: "width",
      value: "round(var(--size),1px)",
    },
    {
      name: "an env() value",
      css: "a{width:10px;width:round(max(10px,env(safe-area-inset-bottom)),1px)}",
      property: "width",
      value: "round(max(10px,env(safe-area-inset-bottom)),1px)",
    },
    {
      name: "a custom property",
      css: "a{--size:10px;--size:round(10px,1px)}",
      property: "--size",
      value: "round(10px,1px)",
    },
  ])(
    "rejects a declaration fallback for $name, which a browser keeps until substitution",
    ({ css, property, value }) => {
      const approval = approve({
        property,
        value,
        features: ["css.types.round"],
        fallback: { kind: "declaration", property, value: "10px" },
      });
      expect(problemTags(css, [approval])).toEqual(["SubstitutedFallback"]);
    }
  );

  it.each([
    { name: "a var()", substitution: "var(--tone,red)" },
    { name: "a known env()", substitution: "env(safe-area-inset-top)" },
    { name: "an unknown env() with a fallback", substitution: "env(unknown,red)" },
  ])(
    "rejects a declaration fallback for $name where one engine knows the property but not the value",
    ({ substitution }) => {
      // Safari 16.4 knows unprefixed mask-image but not light-dark(), so it keeps the use until
      // substitution, though Chrome 111, which lacks mask-image, drops it at parse time.
      const value = `linear-gradient(${substitution},light-dark(black,white))`;
      const approval = approve({
        property: "mask-image",
        value,
        features: ["css.properties.mask-image", "css.types.color.light-dark"],
        fallback: { kind: "declaration", property: "-webkit-mask-image", value: fade },
      });
      expect(problemTags(`a{-webkit-mask-image:${fade};mask-image:${value}}`, [approval])).toEqual([
        "SubstitutedFallback",
      ]);
    }
  );

  it.each([
    { name: "all", property: "width", css: "a{width:10px;width:round(20px,1px);all:unset}" },
    { name: "gap", property: "row-gap", css: "a{row-gap:10px;row-gap:round(20px,1px);gap:0}" },
    {
      name: "font",
      property: "line-height",
      css: "a{line-height:10px;line-height:round(20px,1px);font:16px serif}",
    },
    {
      name: "grid",
      property: "grid-template",
      css: "a{grid-template:10px/1fr;grid-template:round(20px,1px)/1fr;grid:none}",
      value: "round(20px,1px)/1fr",
      fallback: "10px/1fr",
    },
    {
      name: "border-top",
      property: "border-width",
      css: "a{border-width:10px;border-width:round(20px,1px);border-top:0}",
    },
  ])(
    "fails a declaration fallback that a later $name resets",
    ({ property, css, value = "round(20px,1px)", fallback = "10px" }) => {
      const approval = approve({
        property,
        value,
        features: ["css.types.round"],
        fallback: { kind: "declaration", property, value: fallback },
      });
      expect(problemTags(css, [approval])).toEqual(["FallbackMissing"]);
    }
  );

  it("fails a shorthand declaration fallback that a later longhand overrides in part", () => {
    const approval = maskImage({ kind: "declaration", property: "-webkit-mask", value: fade });
    expect(
      problemTags(`a{-webkit-mask:${fade};mask-image:${fade};-webkit-mask-image:none}`, [approval])
    ).toEqual(["FallbackMissing"]);
  });

  it("fails a fallback that relies on the floor's lacks itself", () => {
    const tinted = "linear-gradient(light-dark(red,blue),transparent)";
    const approval = maskImage({ kind: "declaration", property: "-webkit-mask-image", value: tinted });
    expect(problemTags(`a{-webkit-mask-image:${tinted};mask-image:${fade}}`, [approval])).toEqual([
      "Unapproved",
      "FallbackMissing",
    ]);
  });

  it.each([
    { name: "declares another value", css: `b{display:block}a{mask-image:${fade}}` },
    { name: "is overridden in its own block", css: `b{display:none;display:block}a{mask-image:${fade}}` },
    { name: "is overridden by a later block", css: `b{display:none}a{mask-image:${fade}}b{display:block}` },
    { name: "sits inside a condition", css: `@media (width < 1px){b{display:none}}a{mask-image:${fade}}` },
    {
      name: "is reset by a later block's shorthand",
      css: `b{top:0}a{mask-image:${fade}}b{inset:auto}`,
      property: "top",
      value: "0",
    },
    {
      name: "is reset in part by a later block's overlapping shorthand",
      css: `b{grid-area:1/1}a{mask-image:${fade}}b{grid-row:2}`,
      property: "grid-area",
      value: "1/1",
    },
    {
      name: "is overridden by a later block that lists its selectors in reverse",
      css: `b,c{display:none}a{mask-image:${fade}}c,b{display:block}`,
      where: "b,c",
    },
    {
      name: "is overridden by a later block for one of its selectors",
      css: `b,c{display:none}a{mask-image:${fade}}c{display:block}`,
      where: "b,c",
    },
  ])(
    "fails a companion rule fallback whose rule $name",
    ({ css, where = "b", property = "display", value = "none" }) => {
      const companion = maskImage({ kind: "rule", where, property, value });
      expect(problemTags(css, [companion])).toEqual(["FallbackMissing"]);
    }
  );

  it("fails a companion rule fallback whose substituted value is itself above the floor", () => {
    const value = "light-dark(red,blue)";
    const own = approve({
      where: "b",
      property: "--x",
      value,
      features: ["css.types.color.light-dark"],
      fallback: { kind: "none" },
    });
    const companion = maskImage({ kind: "rule", where: "b", property: "--x", value });
    expect(problemTags(`b{--x:${value}}a{mask-image:${fade}}`, [own, companion])).toEqual([
      "FallbackMissing",
    ]);
  });
});
