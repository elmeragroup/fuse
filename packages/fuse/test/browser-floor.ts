/**
 * The browser-floor gate over the stylesheets `dist/` ships as built. It reads a sheet with
 * css-tree, which keeps every value, selector and at-rule prelude as written, names each feature
 * a use relies on by its MDN browser-compat-data row, and holds each use above Fuse's browser
 * floor to an approval in `browser-floor-approvals.ts` that pins the use and its fallback. No
 * shipped module imports it, so it lives with the test tooling.
 *
 * Names map to MDN rows two ways. Where the row's key is the CSS name itself, the mapping is
 * mechanical: `css.properties.<property>`, `css.properties.<property>.<keyword>` for any keyword
 * in the value, `css.types.global_keywords.<keyword>` for a CSS-wide keyword such as
 * `revert-rule`, `css.at-rules.<name>`, `css.at-rules.<name>.<descriptor>` and
 * `css.selectors.<name>`; a keyword maps by its lower-case name. Functions, units, media and
 * container features and condition functions map through the reviewed tables below; a name missing
 * from its table fails the gate until someone adds it. MDN is the only source of versions.
 *
 * A vendor-prefixed property, function, pseudo or at-rule counts only when MDN has a row under
 * its prefixed name, such as `-webkit-line-clamp`; any other prefixed spelling is a fallback,
 * which approvals pin by value.
 *
 * Known gaps: a shorthand's keywords map to the shorthand's own rows, so `font: 16px
 * ui-monospace` is not read as `font-family`; and argument-dependent subfeatures are mapped only
 * for relative colours and typed `attr()`, so `rgb(100% 0 0)` reads as plain `rgb()` and a
 * single-stop gradient, `linear-gradient(red)`, as plain `linear-gradient()`. A custom
 * property's keywords carry no property context, so `--tracks: subgrid` read through
 * `grid-template-columns: var(--tracks)` is not dated as `subgrid`. Shorthands come from
 * mdn-data's `computed` lists, so a name mdn-data lacks, such as most prefixed shorthands, sets
 * no longhands, and a longhand mdn-data leaves out of its shorthand's list, such as
 * `-webkit-mask-composite` under `-webkit-mask`, neither resets the shorthand nor is reset by it.
 */
import type { Identifier, SimpleSupportStatement } from "@mdn/browser-compat-data";
// The package's own JSON.parse entry: Node parses the 20 MB data.json natively, where importing it
// as JSON sends it through Vite's transform, about 3 s in each test file that imports the gate.
import bcd from "@mdn/browser-compat-data/forLegacyNode";
import * as csstree from "css-tree";
import type { Atrule, CssNode, Declaration, Rule } from "css-tree";
import { createRequire } from "node:module";

/**
 * Fuse's browser floor, Tailwind v4's, which `src/styles/fuse.css` cites: the oldest release of
 * each engine the shipped CSS must keep working in.
 */
const BROWSER_FLOOR = { chrome: "111", safari: "16.4", firefox: "128" } as const;

type Engine = keyof typeof BROWSER_FLOOR;

const ENGINES = ["chrome", "safari", "firefox"] as const satisfies readonly Engine[];

/** Pairs each name with the MDN row `prefix` + the name. */
function rows(prefix: string, names: readonly string[]): [string, string][] {
  return names.map((name) => [name.toLowerCase(), `${prefix}${name}`]);
}

/** Pairs each name with the one MDN row `row`. */
function same(row: string, names: readonly string[]): [string, string][] {
  return names.map((name) => [name, row]);
}

/** CSS functions by lower-case name, to the MDN row that dates them. */
const FUNCTIONS = new Map<string, string>([
  ...rows("css.types.", [
    "calc",
    "min",
    "max",
    "clamp",
    "round",
    "mod",
    "rem",
    "abs",
    "sign",
    "var",
    "env",
    "attr",
    "url",
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "atan2",
    "pow",
    "sqrt",
    "hypot",
    "log",
    "exp",
  ]),
  ...rows("css.types.color.", [
    "rgb",
    "hsl",
    "hsla",
    "hwb",
    "lab",
    "lch",
    "oklab",
    "oklch",
    "color",
    "color-mix",
    "light-dark",
  ]),
  ["rgba", "css.types.color.rgb"],
  ...rows("css.types.gradient.", [
    "linear-gradient",
    "radial-gradient",
    "conic-gradient",
    "repeating-linear-gradient",
    "repeating-radial-gradient",
    "repeating-conic-gradient",
  ]),
  ...rows("css.types.image.", ["image-set", "cross-fade"]),
  ...rows("css.types.easing-function.", ["cubic-bezier", "steps"]),
  ["linear", "css.types.easing-function.linear-function"],
  ...rows("css.types.transform-function.", [
    "matrix",
    "matrix3d",
    "perspective",
    "rotate",
    "rotate3d",
    "rotateX",
    "rotateY",
    "rotateZ",
    "scale",
    "scale3d",
    "scaleX",
    "scaleY",
    "scaleZ",
    "skew",
    "skewX",
    "skewY",
    "translate",
    "translate3d",
    "translateX",
    "translateY",
    "translateZ",
  ]),
  ...rows("css.types.filter-function.", [
    "blur",
    "brightness",
    "contrast",
    "drop-shadow",
    "grayscale",
    "hue-rotate",
    "invert",
    "opacity",
    "saturate",
    "sepia",
  ]),
  ...rows("css.types.basic-shape.", ["circle", "ellipse", "inset", "path", "polygon", "rect", "xywh"]),
  ...rows("css.properties.grid-template-columns.", ["minmax", "repeat"]),
  ...rows("css.properties.animation-timeline.", ["scroll", "view"]),
  ["type", "css.types.attr.type_function"],
]);

/** The MDN rows of syntax that no name in the sheet spells out. */
const SYNTAX_ROWS = {
  /**
   * A type or unit after `attr()`'s name, as `attr(data-width px)`; only `content` reads more than a
   * bare name at the floor.
   */
  attrTyped: "css.types.attr.declaration-value",
  /** A fallback after a comma in `attr()`, as `attr(data-width px, 100px)`. */
  attrFallback: "css.types.attr.fallback",
  /** The `raw-string` type in `attr()`. */
  attrRawString: "css.types.attr.raw-string",
  /** A `display` value with more than one keyword, as `block grid`. */
  multiKeywordDisplay: "css.properties.display.multi-keyword_values",
  /** A rule nested in a style rule, or `&`. */
  nesting: "css.selectors.nesting",
  /** A media feature written as a range, as `(width >= 40rem)`. */
  mediaRange: "css.at-rules.media.range_syntax",
} as const;

/** Every table entry whose MDN row does not exist, as problems. */
function invalidMappings(): FloorProblem[] {
  return Object.entries({
    FUNCTIONS,
    RELATIVE_COLOURS,
    UNITS,
    QUERY_FEATURES,
    CONDITION_FUNCTIONS,
    SYNTAX_ROWS: new Map(Object.entries(SYNTAX_ROWS)),
  }).flatMap(([table, entries]) =>
    [...entries]
      .filter(([, key]) => !known(key))
      .map(([name, key]): FloorProblem => ({ _tag: "InvalidMapping", table, name, key }))
  );
}

/**
 * Colour functions to the MDN row of their relative syntax, `rgb(from …)`; the `rgba()` and
 * `hsla()` aliases share their base function's row.
 */
const RELATIVE_COLOURS = new Map<string, string>([
  ...["rgb", "hsl", "hwb", "lab", "lch", "oklab", "oklch", "color"].map((name): [string, string] => [
    name,
    `css.types.color.${name}.relative_syntax`,
  ]),
  ["rgba", "css.types.color.rgb.relative_syntax"],
  ["hsla", "css.types.color.hsl.relative_syntax"],
]);

/** Units by lower-case name, to the MDN row that dates them. */
const UNITS = new Map<string, string>([
  ...same("css.types.length", ["px", "cm", "mm", "in", "pt", "pc"]),
  ...rows("css.types.length.", [
    "cap",
    "ch",
    "em",
    "ex",
    "ic",
    "lh",
    "rcap",
    "rch",
    "rem",
    "rex",
    "ric",
    "rlh",
    "vb",
    "vh",
    "vi",
    "vmax",
    "vmin",
    "vw",
    "Q",
  ]),
  ...same("css.types.length.viewport_percentage_units_dynamic", [
    "dvb",
    "dvh",
    "dvi",
    "dvmax",
    "dvmin",
    "dvw",
  ]),
  ...same("css.types.length.viewport_percentage_units_large", ["lvb", "lvh", "lvi", "lvmax", "lvmin", "lvw"]),
  ...same("css.types.length.viewport_percentage_units_small", ["svb", "svh", "svi", "svmax", "svmin", "svw"]),
  ...same("css.types.length.container_query_length_units", ["cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax"]),
  ...rows("css.types.angle.", ["deg", "grad", "rad", "turn"]),
  ...same("css.types.time", ["s", "ms"]),
  ["fr", "css.types.flex"],
  ...rows("css.types.resolution.", ["dpi", "dpcm", "dppx", "x"]),
]);

/** Media and container features by `<kind> <name>`, to the MDN row that dates them. */
const QUERY_FEATURES = new Map<string, string>([
  ...[
    "any-hover",
    "any-pointer",
    "aspect-ratio",
    "color-gamut",
    "forced-colors",
    "height",
    "hover",
    "inverted-colors",
    "orientation",
    "pointer",
    "prefers-color-scheme",
    "prefers-contrast",
    "prefers-reduced-data",
    "prefers-reduced-motion",
    "prefers-reduced-transparency",
    "resolution",
    "scripting",
    "width",
  ].map((name): [string, string] => [`media ${name}`, `css.at-rules.media.${name}`]),
  ...same("css.at-rules.media.width", ["media min-width", "media max-width"]),
  ...same("css.at-rules.media.height", ["media min-height", "media max-height"]),
  ...[
    "width",
    "min-width",
    "max-width",
    "height",
    "min-height",
    "max-height",
    "inline-size",
    "block-size",
    "aspect-ratio",
    "orientation",
  ].map((name): [string, string] => [`container ${name}`, "css.at-rules.container"]),
]);

/** Condition functions by `<at-rule> <name>`, such as `@container style()`, to their MDN row. */
const CONDITION_FUNCTIONS = new Map<string, string>([
  ["container style", "css.at-rules.container.style_queries_for_custom_properties"],
  ["container scroll-state", "css.at-rules.container.scroll-state_queries"],
  ["supports selector", "css.at-rules.supports.selector"],
  ["supports font-tech", "css.at-rules.supports.font-tech"],
  ["supports font-format", "css.at-rules.supports.font-format"],
]);

/** The at-rules whose block holds rules; any other at-rule's block holds descriptors. */
const GROUPING_AT_RULES = new Set([
  "media",
  "supports",
  "container",
  "layer",
  "scope",
  "starting-style",
  "keyframes",
]);

/** A built stylesheet, named as `dist/` ships it. */
export type FloorSheet = {
  readonly name: string;
  readonly css: string;
};

/** What keeps an approved use working below the floor. */
export type FloorFallback =
  | {
      /**
       * The value this property takes earlier in the same block where the use drops: the
       * floor-safe declaration of it that wins every longhand it sets, each longhand going to the
       * last declaration that sets it, a shorthand or `all` included, with `!important` beating a
       * normal one.
       */
      readonly kind: "declaration";
      readonly property: string;
      readonly value: string;
    }
  | {
      /**
       * A companion rule in the same sheet, inside the at-rules `within` names, whose effective
       * floor-safe value for this property is this value on each selector of the list `where`
       * names: across every block whose selector list holds that selector there, in source
       * order, with `!important` beating a normal one.
       */
      readonly kind: "rule";
      readonly within?: readonly string[];
      readonly where: string;
      readonly property: string;
      readonly value: string;
    }
  | {
      /**
       * None: below the floor the use drops and degrades safely, or the `@supports` guard that
       * `within` pins keeps it from applying.
       */
      readonly kind: "none";
    };

/**
 * One approved use of features above the floor, pinned as the sheet writes it: a declaration,
 * or a selector or at-rule when `property` is absent. It must match `count` uses exactly.
 */
export type FloorApproval = {
  readonly sheet: string;
  /** The at-rules around the use, outermost first, without `@layer`. */
  readonly within?: readonly string[];
  /** The selector, or the at-rule with its prelude, as css-tree prints it. */
  readonly where: string;
  readonly property?: string;
  readonly value?: string;
  /** The above-floor MDN rows the use relies on. */
  readonly features: readonly string[];
  /** How many times the sheet repeats the use; one when absent. */
  readonly count?: number;
  readonly fallback: FloorFallback;
  /** What renders below the floor, and why that is acceptable. */
  readonly reason: string;
};

/**
 * A selector in a forgiving `:is()` or `:where()` list that relies on a feature above the floor,
 * and the floor-safe selectors that match the same elements. Where a list holds all of them, a
 * browser without the feature still matches through the equivalents, so the branch needs no
 * approval.
 */
export type FloorEquivalence = {
  readonly selector: string;
  readonly equivalents: readonly string[];
  /** Why the equivalents match the same elements. */
  readonly reason: string;
};

/** A use in a sheet, or identical uses, that relies on at least one feature above the floor. */
export type FloorUse = {
  readonly sheet: string;
  readonly within: readonly string[];
  readonly where: string;
  readonly property: string | undefined;
  readonly value: string | undefined;
  readonly features: readonly string[];
  readonly count: number;
  /** Each occurrence's effective values before it in its block. */
  readonly earlier: readonly EffectiveValues[];
  /** Each occurrence's block's final effective values. */
  readonly final: readonly EffectiveValues[];
  /**
   * Whether some floor engine keeps the declaration at parse time and fails it only at
   * substitution: its value is a custom property's, or holds `var()` or `env()`, and the engine
   * knows the property at its floor but lacks another feature of the use. An earlier declaration
   * of the property never takes over from it there.
   */
  readonly substituted: boolean;
};

/** Why a sheet fails the gate. */
export type FloorProblem =
  | { readonly _tag: "Unapproved"; readonly use: FloorUse }
  | { readonly _tag: "CountMismatch"; readonly use: FloorUse; readonly approval: FloorApproval }
  | { readonly _tag: "FallbackMissing"; readonly use: FloorUse; readonly approval: FloorApproval }
  | { readonly _tag: "SubstitutedFallback"; readonly use: FloorUse; readonly approval: FloorApproval }
  | { readonly _tag: "StaleApproval"; readonly approval: FloorApproval }
  | {
      readonly _tag: "UnknownFeature";
      readonly sheet: string;
      readonly where: string;
      readonly feature: string;
    }
  | { readonly _tag: "Unmapped"; readonly sheet: string; readonly where: string; readonly name: string }
  | { readonly _tag: "StaleEquivalence"; readonly equivalence: FloorEquivalence }
  | {
      readonly _tag: "InvalidMapping";
      readonly table: string;
      readonly name: string;
      readonly key: string;
    };

/**
 * The problems that keep `sheets` from passing the browser-floor gate under `approvals`.
 *
 * @param sheets - The built stylesheets to read.
 * @param approvals - The approved above-floor uses.
 * @param equivalences - The selectors whose floor-safe equivalents excuse them in a forgiving list.
 * @returns The problems, empty when the sheets pass.
 */
export function browserFloorProblems(
  sheets: readonly FloorSheet[],
  approvals: readonly FloorApproval[],
  equivalences: readonly FloorEquivalence[] = []
): FloorProblem[] {
  const problems = invalidMappings();
  const matched = new Set<FloorApproval>();
  const forgiving: Forgiving = { equivalences, used: new Set() };
  for (const sheet of sheets) {
    const reading = readSheet(sheet, forgiving);
    problems.push(...reading.problems);
    for (const use of reading.uses) {
      const approval = approvals.find((candidate) => approves(candidate, use));
      if (approval === undefined) {
        problems.push({ _tag: "Unapproved", use });
        continue;
      }
      matched.add(approval);
      if ((approval.count ?? 1) !== use.count) problems.push({ _tag: "CountMismatch", use, approval });
      if (approval.fallback.kind === "declaration" && use.substituted) {
        problems.push({ _tag: "SubstitutedFallback", use, approval });
      } else if (!fallbackHolds(approval.fallback, use, reading.companions)) {
        problems.push({ _tag: "FallbackMissing", use, approval });
      }
    }
  }
  for (const approval of approvals) {
    if (!matched.has(approval)) problems.push({ _tag: "StaleApproval", approval });
  }
  for (const equivalence of equivalences) {
    if (!forgiving.used.has(equivalence)) problems.push({ _tag: "StaleEquivalence", equivalence });
  }
  return problems;
}

/**
 * A one-line account of `problem` that names the sheet and the use, and for an unapproved use
 * the fields its approval needs and each feature's first versions.
 *
 * @param problem - A problem `browserFloorProblems` returned.
 * @returns The message a failing gate prints.
 */
export function describeFloorProblem(problem: FloorProblem): string {
  switch (problem._tag) {
    case "Unapproved":
      return `${problem.use.sheet} relies on ${featureList(problem.use.features)} above the floor. Approve it in browser-floor-approvals.ts: ${skeleton(problem.use)}`;
    case "CountMismatch":
      return `${problem.use.sheet} repeats ${identity(problem.use)} ${String(problem.use.count)} times, but its approval counts ${String(problem.approval.count ?? 1)}`;
    case "FallbackMissing":
      return `${problem.use.sheet} ${identity(problem.use)} lacks its approved fallback ${JSON.stringify(problem.approval.fallback)}`;
    case "SubstitutedFallback":
      return `${problem.use.sheet} ${identity(problem.use)} cannot fall back to an earlier declaration: a browser keeps a custom property, var() or env() value at parse time and drops it only at substitution, so the property becomes unset; use a rule companion, or none with an @supports guard in within or a reason it degrades safely`;
    case "StaleApproval":
      return `${problem.approval.sheet}: the approval for ${identity(problem.approval)} matches no use`;
    case "UnknownFeature":
      return `${problem.sheet} ${problem.where}: browser-compat-data has no ${problem.feature}`;
    case "Unmapped":
      return `${problem.sheet} ${problem.where}: ${problem.name} maps to no MDN row; add it to that table in test/browser-floor.ts`;
    case "StaleEquivalence":
      return `the selector equivalence for ${problem.equivalence.selector} matches no forgiving list`;
    case "InvalidMapping":
      return `${problem.table} in test/browser-floor.ts maps ${problem.name} to ${problem.key}, which browser-compat-data lacks`;
  }
}

type Identified = Pick<FloorApproval, "within" | "where" | "property" | "value" | "features">;

/** The fields that identify a use, as an approval spells them. */
function identityFields(use: Identified): Identified {
  return {
    within: use.within?.length === 0 ? undefined : use.within,
    where: use.where,
    property: use.property,
    value: use.value,
    features: use.features,
  };
}

/** The fields that identify a use, as JSON. */
function identity(use: Identified): string {
  return JSON.stringify(identityFields(use));
}

/** A use as a ready-to-paste approval, with placeholders for the fallback and the reason. */
function skeleton(use: FloorUse): string {
  return JSON.stringify({
    sheet: use.sheet,
    ...identityFields(use),
    count: use.count === 1 ? undefined : use.count,
    fallback: "<{ kind: declaration | rule | none, … }>",
    reason: "<what renders below the floor>",
  });
}

function approves(approval: FloorApproval, use: FloorUse): boolean {
  return (
    approval.sheet === use.sheet &&
    identity({ ...approval, features: approval.features.toSorted() }) === identity(use)
  );
}

/** Whether `values` gives `property` this floor-safe `value`. */
function holds(values: EffectiveValues | undefined, property: string, value: string): boolean {
  const entry = inEffect(values, property);
  return entry?.safe === true && entry.value === value;
}

function fallbackHolds(
  fallback: FloorFallback,
  use: FloorUse,
  companions: SheetReading["companions"]
): boolean {
  switch (fallback.kind) {
    case "declaration":
      return [...use.earlier, ...use.final].every((values) =>
        holds(values, fallback.property, fallback.value)
      );
    case "rule":
      return selectorBranches(csstree.parse(fallback.where, { context: "selectorList" })).every((branch) =>
        holds(companions.get(companionId(fallback.within ?? [], branch)), fallback.property, fallback.value)
      );
    case "none":
      return true;
  }
}

/** Each top-level selector of a selector list, as css-tree prints it. */
function selectorBranches(selector: CssNode): string[] {
  return selector.type === "SelectorList"
    ? selector.children.toArray().map((branch) => csstree.generate(branch))
    : [csstree.generate(selector)];
}

function featureList(features: readonly string[]): string {
  return features
    .map((feature) => {
      const versions = firstVersions(feature);
      return `${feature} (${ENGINES.map((engine) => `${engine} ${versions[engine] ?? "none"}`).join(", ")})`;
    })
    .join("; ");
}

function identifierAt(key: string): Identifier | undefined {
  let node: Identifier | undefined = bcd.css;
  for (const part of key.split(".").slice(1)) {
    node = node?.[part];
  }
  return node?.__compat === undefined ? undefined : node;
}

/** Whether MDN has a row for `key`, such as `css.properties.text-wrap.pretty`. */
function known(key: string): boolean {
  return identifierAt(key) !== undefined;
}

/** The first version of a feature in each engine, or `undefined` where it has not shipped. */
type FirstVersions = Readonly<Record<Engine, string | undefined>>;

const versionCache = new Map<string, FirstVersions>();

/**
 * The first release of each engine that ships `key` unprefixed, under its own name, without a
 * flag and in full. A partial implementation does not count: MDN marks `mask` in Chrome before
 * 120 partial because it does nothing outside SVG, and nesting in Chrome 112 to 119 partial
 * because it drops a nested rule that starts with a type selector.
 */
function firstVersions(key: string): FirstVersions {
  const cached = versionCache.get(key);
  if (cached !== undefined) return cached;
  const support = identifierAt(key)?.__compat?.support;
  const first = (engine: Engine): string | undefined => {
    const statement = support?.[engine];
    const statements: readonly SimpleSupportStatement[] =
      statement === undefined ? [] : Array.isArray(statement) ? statement : [statement];
    return statements
      .filter(
        (entry) =>
          entry.prefix === undefined &&
          entry.alternative_name === undefined &&
          entry.flags === undefined &&
          entry.partial_implementation === undefined &&
          entry.version_removed === undefined
      )
      .flatMap((entry) => (entry.version_added === false ? [] : [entry.version_added]))
      .filter((version) => version !== "preview")
      .map((version) => version.replace(/^≤/u, ""))
      .toSorted(compareVersions)[0];
  };
  const versions = { chrome: first("chrome"), safari: first("safari"), firefox: first("firefox") };
  versionCache.set(key, versions);
  return versions;
}

function compareVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** Whether `engine` at its floor lacks `key`. */
function lacksAt(key: string, engine: Engine): boolean {
  const version = firstVersions(key)[engine];
  return version === undefined || compareVersions(version, BROWSER_FLOOR[engine]) > 0;
}

/** Whether some engine at the floor lacks `key`. */
function aboveFloor(key: string): boolean {
  return ENGINES.some((engine) => lacksAt(key, engine));
}

const VENDOR_PREFIX = /^-(?:webkit|moz|ms|o)-/u;

/** Whether `name` is vendor-specific, such as `-webkit-mask` or `-webkit-scrollbar`. */
function vendorPrefixed(name: string): boolean {
  return VENDOR_PREFIX.test(name);
}

/** The MDN rows a use relies on, and the names no table maps. */
type Reading = {
  readonly keys: Set<string>;
  readonly unmapped: Set<string>;
};

function emptyReading(): Reading {
  return { keys: new Set(), unmapped: new Set() };
}

function merge(into: Reading, from: Reading): void {
  for (const key of from.keys) into.keys.add(key);
  for (const name of from.unmapped) into.unmapped.add(name);
}

/** Whether a reading relies on nothing above the floor, unknown or unmapped. */
function floorSafe(reading: Reading): boolean {
  return reading.unmapped.size === 0 && [...reading.keys].every((key) => known(key) && !aboveFloor(key));
}

/** Adds `key` unless `name` is a prefixed spelling MDN has no row for. */
function addNamed(reading: Reading, name: string, key: string): void {
  if (!vendorPrefixed(name) || known(key)) reading.keys.add(key);
}

function addMapped(reading: Reading, table: ReadonlyMap<string, string>, name: string, label: string): void {
  const key = table.get(name);
  if (key === undefined) reading.unmapped.add(label);
  else reading.keys.add(key);
}

/**
 * What a value relies on as written: each function and unit, a relative colour's syntax, each
 * CSS-wide keyword and, for a property, each keyword MDN has a row for under it.
 */
function readValue(value: CssNode, property: string | undefined, reading: Reading): void {
  csstree.walk(value, (node) => {
    if (node.type === "Raw") reading.unmapped.add(`the unparsed value ${node.value}`);
    if (node.type === "Function") {
      const name = node.name.toLowerCase();
      if (vendorPrefixed(name)) return;
      addMapped(reading, FUNCTIONS, name, `the function ${name}() in FUNCTIONS`);
      if (name === "attr") readAttr(node.children.toArray(), reading);
      const relative = RELATIVE_COLOURS.get(name);
      const first = node.children.first;
      if (relative !== undefined && first?.type === "Identifier" && first.name.toLowerCase() === "from") {
        reading.keys.add(relative);
      }
    }
    if (node.type === "Dimension") {
      const unit = node.unit.toLowerCase();
      addMapped(reading, UNITS, unit, `the unit ${unit} in UNITS`);
    }
    if (node.type === "Identifier") {
      const keyword = node.name.toLowerCase();
      for (const key of [
        `css.types.global_keywords.${keyword}`,
        ...(property === undefined ? [] : [`css.properties.${property}.${keyword}`]),
      ]) {
        if (known(key)) reading.keys.add(key);
      }
    }
  });
}

/**
 * What `attr()` relies on beyond its first argument, the attribute name: a type, a fallback, a raw
 * string.
 */
function readAttr([, ...rest]: readonly CssNode[], reading: Reading): void {
  if (rest.length > 0) reading.keys.add(SYNTAX_ROWS.attrTyped);
  if (rest.some((arg) => arg.type === "Operator" && arg.value === ",")) {
    reading.keys.add(SYNTAX_ROWS.attrFallback);
  }
  if (rest.some((arg) => arg.type === "Identifier" && arg.name.toLowerCase() === "raw-string")) {
    reading.keys.add(SYNTAX_ROWS.attrRawString);
  }
}

/**
 * The MDN row of a declaration's property, or its at-rule's descriptor: none for a custom
 * property, or a prefixed spelling MDN has no row for.
 */
function propertyRow(property: string, descriptorOf: string | undefined): string | undefined {
  if (property.startsWith("--")) return undefined;
  const key =
    descriptorOf === undefined ? `css.properties.${property}` : `css.at-rules.${descriptorOf}.${property}`;
  return vendorPrefixed(property) && !known(key) ? undefined : key;
}

/** What a declaration relies on: its property, or its at-rule's descriptor, and its value. */
function readDeclaration(declaration: Declaration, descriptorOf: string | undefined): Reading {
  const reading = emptyReading();
  const property = declaration.property.toLowerCase();
  const row = propertyRow(property, descriptorOf);
  if (row !== undefined) reading.keys.add(row);
  const valueProperty = property.startsWith("--") || descriptorOf !== undefined ? undefined : property;
  readValue(declaration.value, valueProperty, reading);
  if (
    valueProperty === "display" &&
    childrenOf(declaration.value).filter((node) => node.type === "Identifier").length > 1
  ) {
    reading.keys.add(SYNTAX_ROWS.multiKeywordDisplay);
  }
  return reading;
}

/** The selector equivalences a gate run may apply, and those it has applied. */
type Forgiving = {
  readonly equivalences: readonly FloorEquivalence[];
  readonly used: Set<FloorEquivalence>;
};

/**
 * What a selector relies on: each pseudo-class and pseudo-element, and `&`. In the forgiving
 * list of `:is()` or `:where()` an unreadable selector drops alone, so an above-floor branch is
 * excused when the same list holds the floor-safe equivalents a `FloorEquivalence` names.
 */
function readSelector(selector: CssNode, reading: Reading, forgiving: Forgiving): void {
  csstree.walk(selector, (node) => {
    if (node.type === "Raw") reading.unmapped.add(`the unparsed selector ${node.value}`);
    if (node.type === "NestingSelector") reading.keys.add(SYNTAX_ROWS.nesting);
    if (node.type !== "PseudoClassSelector" && node.type !== "PseudoElementSelector") return undefined;
    const name = node.name.toLowerCase();
    addNamed(reading, name, `css.selectors.${name}`);
    const list = node.children?.first;
    if (
      node.type !== "PseudoClassSelector" ||
      (name !== "is" && name !== "where") ||
      list?.type !== "SelectorList"
    ) {
      return undefined;
    }
    const branches = list.children.toArray().map((branch) => {
      const branchReading = emptyReading();
      readSelector(branch, branchReading, forgiving);
      return { text: csstree.generate(branch), reading: branchReading };
    });
    const safe = new Set(branches.filter((branch) => floorSafe(branch.reading)).map((branch) => branch.text));
    for (const branch of branches) {
      const equivalence = forgiving.equivalences.find(
        (candidate) =>
          candidate.selector === branch.text && candidate.equivalents.every((text) => safe.has(text))
      );
      if (equivalence === undefined) merge(reading, branch.reading);
      else forgiving.used.add(equivalence);
    }
    return csstree.walk.skip;
  });
}

/** What an at-rule's prelude relies on, as written: its features, condition functions and tests. */
function readPrelude(prelude: CssNode, reading: Reading, forgiving: Forgiving): void {
  const feature = (kind: string, name: string): void =>
    addMapped(reading, QUERY_FEATURES, `${kind} ${name}`, `the ${kind} feature ${name} in QUERY_FEATURES`);
  csstree.walk(prelude, (node) => {
    if (node.type === "Raw") reading.unmapped.add(`the unparsed prelude ${node.value}`);
    if (node.type === "Feature") feature(node.kind, node.name);
    if (node.type === "FeatureRange") {
      if (node.kind === "media") reading.keys.add(SYNTAX_ROWS.mediaRange);
      for (const side of [node.left, node.middle]) {
        if (side.type === "Identifier") feature(node.kind, side.name);
      }
    }
    if (node.type === "FeatureFunction") {
      const name = `${node.kind} ${node.feature}`;
      addMapped(
        reading,
        CONDITION_FUNCTIONS,
        name,
        `${node.feature}() in @${node.kind}, in CONDITION_FUNCTIONS`
      );
      if (node.value.type === "Selector") readSelector(node.value, reading, forgiving);
      return csstree.walk.skip;
    }
    if (node.type === "SupportsDeclaration") {
      merge(reading, readDeclaration(node.declaration, undefined));
      return csstree.walk.skip;
    }
    if (node.type === "Function" || node.type === "Dimension") {
      readValue(node, undefined, reading);
      return csstree.walk.skip;
    }
    return undefined;
  });
}

function childrenOf(node: CssNode | null): CssNode[] {
  return node !== null && "children" in node && node.children !== null ? node.children.toArray() : [];
}

/** A sheet's above-floor uses, its unknown and unmapped names, and its companions. */
type SheetReading = {
  readonly uses: readonly FloorUse[];
  readonly problems: readonly FloorProblem[];
  /** The effective values of each selector's blocks in the sheet, by `companionId`. */
  readonly companions: ReadonlyMap<string, EffectiveValues>;
};

/** A style rule's selector list as written, and each of its selectors. */
type StyleRule = { readonly where: string; readonly branches: readonly string[] };

/** Where a node sits: the at-rules around it, the style rule it nests in, its descriptor owner. */
type Scope = {
  readonly within: readonly string[];
  readonly styleRule: StyleRule | undefined;
  readonly descriptorOf: string | undefined;
};

/**
 * A declaration as a use identifies it, its property's MDN row, and whether its value waits for
 * substitution.
 */
type Written = {
  readonly property: string;
  readonly value: string;
  /** The row `propertyRow` names, absent where it names none. */
  readonly row: string | undefined;
  readonly substitutes: boolean;
};

/**
 * The rows of the substitution functions, `var()` and `env()`, whose declaration a browser
 * validates only once it substitutes the value.
 */
const SUBSTITUTION_ROWS: ReadonlySet<string> = new Set(
  ["var", "env"].flatMap((name) => FUNCTIONS.get(name) ?? [])
);

/**
 * Whether some floor engine knows the property `row` dates, as every engine knows a custom or
 * unlisted prefixed one, but lacks another of `features`: that engine keeps a substituting
 * declaration at parse time and fails it only at substitution. An engine that lacks the property
 * drops it at parse time anyway.
 */
function failsAtSubstitution(row: string | undefined, features: readonly string[]): boolean {
  return ENGINES.some(
    (engine) =>
      (row === undefined || !lacksAt(row, engine)) &&
      features.some((feature) => feature !== row && lacksAt(feature, engine))
  );
}

/**
 * The one field the gate reads from a property in mdn-data's `css/properties.json`: a shorthand's
 * `computed` lists the properties it sets, and any other property's names how it computes.
 */
type MdnProperty = { readonly computed: string | string[] };

/**
 * Each shorthand's longhands, through any shorthand it sets, from mdn-data's `computed` lists:
 * `border` sets `border-width` and, through it, `border-top-width`. Loaded through Node's
 * `require`, as css-tree loads the same file, so Vite does not transform the JSON.
 */
function shorthandTable(): ReadonlyMap<string, ReadonlySet<string>> {
  const parsed: unknown = createRequire(import.meta.url)("mdn-data/css/properties.json");
  // SAFETY: the pinned mdn-data release is the I/O boundary, and its schema defines this shape.
  const properties = parsed as Readonly<Record<string, MdnProperty>>;
  const direct = new Map(
    Object.entries(properties).flatMap(([name, { computed }]): [string, readonly string[]][] =>
      Array.isArray(computed) ? [[name, computed]] : []
    )
  );
  const longhands = (name: string): string[] => direct.get(name)?.flatMap(longhands) ?? [name];
  return new Map([...direct.keys()].map((name) => [name, new Set(longhands(name))]));
}

const LONGHANDS = shorthandTable();

/**
 * The longhands a declaration of `property` sets: a shorthand's, or the property itself. No
 * at-rule descriptor mdn-data lists is a shorthand, and `all` is read apart.
 */
function longhandsOf(property: string): ReadonlySet<string> {
  return LONGHANDS.get(property) ?? new Set([property]);
}

/** Whether `all` sets `longhand`: every one but custom properties, `direction` and `unicode-bidi`. */
function resetByAll(longhand: string): boolean {
  return !longhand.startsWith("--") && longhand !== "direction" && longhand !== "unicode-bidi";
}

/** A declaration the cascade reads, by identity, and whether its value is floor-safe. */
type Effective = {
  readonly property: string;
  readonly value: string;
  readonly important: boolean;
  readonly safe: boolean;
};

/**
 * The cascade in a block, or across a selector's blocks: the declaration that wins each longhand
 * a declaration has set, and the `all` declaration that wins every other longhand it sets.
 */
type EffectiveValues = {
  readonly winners: ReadonlyMap<string, Effective>;
  readonly all: Effective | undefined;
};

type Cascade = { readonly winners: Map<string, Effective>; all: Effective | undefined };

function emptyCascade(): Cascade {
  return { winners: new Map(), all: undefined };
}

/** The declaration that wins `longhand`. */
function winnerOf(values: EffectiveValues, longhand: string): Effective | undefined {
  return values.winners.get(longhand) ?? (resetByAll(longhand) ? values.all : undefined);
}

/**
 * The declaration of `property` whose value is in effect: the one that wins every longhand it
 * sets. A shorthand another declaration overrides in part, or that outranks it on one longhand,
 * has no value in effect.
 */
function inEffect(values: EffectiveValues | undefined, property: string): Effective | undefined {
  if (values === undefined) return undefined;
  const winning =
    property === "all"
      ? [
          values.all,
          ...[...values.winners].flatMap(([longhand, winner]) => (resetByAll(longhand) ? [winner] : [])),
        ]
      : [...longhandsOf(property)].map((longhand) => winnerOf(values, longhand));
  const [first] = winning;
  return first?.property === property && winning.every((winner) => winner === first) ? first : undefined;
}

/**
 * Applies a declaration to the cascade before it, in source order: it wins each longhand it sets
 * from the declaration that won it, unless that one is `!important` and it is not.
 */
function takeEffect(values: Cascade, entry: Effective): void {
  const outranks = (current: Effective | undefined): boolean =>
    current === undefined || entry.important || !current.important;
  if (entry.property === "all") {
    if (outranks(values.all)) values.all = entry;
    for (const [longhand, current] of values.winners) {
      if (resetByAll(longhand) && outranks(current)) values.winners.set(longhand, entry);
    }
    return;
  }
  for (const longhand of longhandsOf(entry.property)) {
    if (outranks(winnerOf(values, longhand))) values.winners.set(longhand, entry);
  }
}

/** A companion's identity: the at-rules around its block and its selector. */
function companionId(within: readonly string[], where: string): string {
  return JSON.stringify([within, where]);
}

function readSheet(sheet: FloorSheet, forgiving: Forgiving): SheetReading {
  const problems: FloorProblem[] = [];
  const uses = new Map<string, FloorUse>();
  const companions = new Map<string, Cascade>();

  const record = (
    scope: Scope,
    where: string,
    written: Written | undefined,
    reading: Reading,
    /** The block's cascade so far, which is its final cascade once the block ends. */
    values: EffectiveValues
  ): void => {
    for (const name of reading.unmapped) problems.push({ _tag: "Unmapped", sheet: sheet.name, where, name });
    const features: string[] = [];
    for (const key of reading.keys) {
      if (!known(key)) problems.push({ _tag: "UnknownFeature", sheet: sheet.name, where, feature: key });
      else if (aboveFloor(key)) features.push(key);
    }
    if (features.length === 0) return;
    const use = {
      sheet: sheet.name,
      within: scope.within,
      where,
      property: written?.property,
      value: written?.value,
      features: features.toSorted(),
    };
    const id = identity(use);
    const repeated = uses.get(id);
    const occurrences = [...(repeated?.earlier ?? []), { winners: new Map(values.winners), all: values.all }];
    uses.set(id, {
      ...use,
      count: occurrences.length,
      earlier: occurrences,
      final: [...(repeated?.final ?? []), values],
      // Per engine: one that lacks the property drops the declaration at parse time anyway, so
      // its earlier declaration holds there, but one that knows it keeps it until substitution.
      substituted: written?.substitutes === true && failsAtSubstitution(written.row, features),
    });
  };

  /** Reads a block: its declarations belong to the scope's style rule, or else to `name`. */
  const readBlock = (scope: Scope, name: string, children: readonly CssNode[]): void => {
    const where = scope.styleRule?.where ?? name;
    // Below the floor a browser drops each declaration it cannot read, so a property takes the
    // last floor-safe declaration of it, and an `!important` one over any normal one. It keeps a
    // custom property or a var() or env() value whatever it holds, which fails only at
    // substitution.
    const effective = emptyCascade();
    // A companion's value cascades across every block whose selector list holds its selector, in
    // the same at-rules.
    const cascaded = (scope.styleRule?.branches ?? []).map((branch) => {
      const id = companionId(scope.within, branch);
      const found = companions.get(id) ?? emptyCascade();
      companions.set(id, found);
      return found;
    });
    for (const child of children) {
      if (child.type === "Declaration") {
        const reading = readDeclaration(child, scope.descriptorOf);
        const value = csstree.generate(child.value);
        const important = child.important !== false;
        const property = child.property.toLowerCase();
        const written = {
          property,
          value: important ? `${value} !important` : value,
          row: propertyRow(property, scope.descriptorOf),
          substitutes:
            property.startsWith("--") || [...reading.keys].some((key) => SUBSTITUTION_ROWS.has(key)),
        };
        record(scope, where, written, reading, effective);
        const safe = floorSafe(reading);
        // A shorthand or `all` that fails at substitution resets what it sets too, to unset values.
        if (safe || written.substitutes) {
          const entry = { property, value: written.value, important, safe };
          for (const values of [effective, ...cascaded]) takeEffect(values, entry);
        }
      } else if (child.type === "Rule") {
        readRule(scope, child);
      } else if (child.type === "Atrule") {
        readAtrule(scope, child);
      }
    }
  };

  const readRule = (scope: Scope, rule: Rule): void => {
    const where = csstree.generate(rule.prelude);
    const reading = emptyReading();
    readSelector(rule.prelude, reading, forgiving);
    const children = childrenOf(rule.block);
    // A rule nested in a style rule, a style rule or a conditional such as `@supports`, is nesting.
    if (children.some((child) => child.type === "Rule" || child.type === "Atrule")) {
      reading.keys.add(SYNTAX_ROWS.nesting);
    }
    record(scope, where, undefined, reading, emptyCascade());
    const styleRule = { where, branches: selectorBranches(rule.prelude) };
    readBlock({ ...scope, styleRule, descriptorOf: undefined }, where, children);
  };

  const readAtrule = (scope: Scope, atrule: Atrule): void => {
    const name = atrule.name.toLowerCase();
    const where = `@${atrule.name}${atrule.prelude === null ? "" : ` ${csstree.generate(atrule.prelude)}`}`;
    const reading = emptyReading();
    addNamed(reading, name, `css.at-rules.${name}`);
    if (atrule.prelude !== null) readPrelude(atrule.prelude, reading, forgiving);
    record(scope, where, undefined, reading, emptyCascade());
    const children = childrenOf(atrule.block);
    if (GROUPING_AT_RULES.has(name.replace(VENDOR_PREFIX, ""))) {
      // A layer changes no engine's support; a conditional rule nested in a style rule holds that
      // rule's declarations.
      const within = name === "layer" ? scope.within : [...scope.within, where];
      readBlock({ ...scope, within }, where, children);
    } else {
      readBlock({ within: scope.within, styleRule: undefined, descriptorOf: name }, where, children);
    }
  };

  readBlock(
    { within: [], styleRule: undefined, descriptorOf: undefined },
    "(top level)",
    childrenOf(csstree.parse(sheet.css, { parseCustomProperty: true }))
  );
  return { uses: [...uses.values()], problems, companions };
}
