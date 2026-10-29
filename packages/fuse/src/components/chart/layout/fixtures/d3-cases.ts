/**
 * Runs d3's own test assertions against Fuse's layouts. The JSON files beside this module are the
 * upstream d3 tests, extracted with their hand-written expected values and frozen in the charts
 * ground truth. `.scratch/charts-v1/tools/l05-oracles/trim_d3_cases.py` copies them here. Each case
 * replays its upstream expression against bindings the caller supplies, so a d3-shaped facade over
 * a Fuse function meets d3's expectations unchanged.
 */
/* oxlint-disable anti-slop/no-known-value-widening, anti-slop/no-reflect-get, anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-unsafe-dictionary-type, anti-slop/no-runtime-typeof, typescript/no-implied-eval, typescript/no-unsafe-call -- this module replays d3's own test source, whose expressions and expected values are untyped JSON by nature, so it handles unknown values throughout */

/** One upstream assertion. */
export type D3Case = {
  readonly line: number;
  readonly test: string;
  readonly actual: string;
  readonly expected: unknown;
  readonly literal: boolean;
  readonly compare?: string;
  readonly call?: readonly CallStep[] | null;
  readonly setup?: readonly { readonly line: number; readonly source: string }[];
};

type CallStep =
  | { readonly fn: string; readonly args: readonly unknown[] }
  | { readonly ref: string }
  | { readonly method: string; readonly args: readonly unknown[] }
  | { readonly call: readonly unknown[] }
  | { readonly get: string }
  | { readonly index: number };

/** A case file. */
export type D3CaseFile = { readonly cases: readonly D3Case[] };

/** A case's outcome. */
export type D3Outcome =
  | { readonly kind: "pass" }
  | { readonly kind: "fail"; readonly actual: unknown; readonly expected: unknown }
  | { readonly kind: "unsupported"; readonly reason: string };

/** An expected value JSON cannot hold. */
class Unsupported extends Error {}

function decode(value: unknown, bindings: Readonly<Record<string, unknown>>): unknown {
  if (Array.isArray(value)) return value.map((item) => decode(item, bindings));
  if (value === null || typeof value !== "object") return value;
  if ("$number" in value) {
    const number = value.$number;
    if (number === "NaN") return Number.NaN;
    if (number === "Infinity") return Number.POSITIVE_INFINITY;
    if (number === "-Infinity") return Number.NEGATIVE_INFINITY;
    if (number === "-0") return -0;
    throw new Unsupported(`number ${String(number)}`);
  }
  if ("$undefined" in value) return undefined;
  if ("$date" in value && typeof value.$date === "string") return new Date(value.$date);
  if ("$ref" in value && typeof value.$ref === "string") {
    if (!(value.$ref in bindings)) throw new Unsupported(`ref ${value.$ref}`);
    return bindings[value.$ref];
  }
  for (const marker of ["$set", "$map", "$hole", "$function", "$class", "$array", "$source"]) {
    if (marker in value) throw new Unsupported(marker);
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item, bindings)]));
}

function argumentSource(value: unknown): string {
  if (value !== null && typeof value === "object" && !Array.isArray(value) && "$source" in value) {
    return String(value.$source);
  }
  if (Array.isArray(value)) return `[${value.map(argumentSource).join(", ")}]`;
  if (value !== null && typeof value === "object" && "$number" in value) {
    return String(value.$number);
  }
  if (value !== null && typeof value === "object" && "$date" in value) {
    return `new Date(${JSON.stringify(value.$date)})`;
  }
  if (value !== null && typeof value === "object" && "$undefined" in value) return "undefined";
  if (value !== null && typeof value === "object" && "$function" in value)
    return `(${String(value.$function)})`;
  if (value !== null && typeof value === "object" && "$set" in value)
    return `new Set(${argumentSource(value.$set)})`;
  return JSON.stringify(value);
}

/**
 * The JavaScript a call chain stands for. A `$source` argument that names the case's own scale,
 * the first identifier of its `actual` expression, binds to the chain's root. Any other `$source`
 * names a local the extraction lost, so the case cannot run.
 */
function chainSource(call: readonly CallStep[], own: string): string {
  const [head, ...rest] = call;
  if (head === undefined) return "undefined";
  const sources = new Set<string>();
  const args = (list: readonly unknown[]): string =>
    list
      .map((item) => {
        if (item !== null && typeof item === "object" && "$source" in item) sources.add(String(item.$source));
        return argumentSource(item);
      })
      .join(", ");
  const root = "fn" in head ? `${head.fn}(${args(head.args)})` : "ref" in head ? head.ref : "undefined";
  const tail = rest
    .map((step) => {
      if ("method" in step) return `.${step.method}(${args(step.args)})`;
      if ("call" in step) return `(${args(step.call)})`;
      if ("get" in step) return `.${step.get}`;
      if ("index" in step) return `[${step.index}]`;
      return "";
    })
    .join("");
  for (const name of sources) {
    if (name !== own) throw new Unsupported(`the case reads ${name}, a local the extraction lost`);
  }
  const aliases = [...sources];
  return `(() => { const __root = ${root}; ${aliases.map((name) => `const ${name} = __root;`).join(" ")} return __root${tail}; })()`;
}

function isEqual(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "number" && typeof expected === "number") return Object.is(actual, expected);
  if (actual instanceof Date && expected instanceof Date) return actual.getTime() === expected.getTime();
  if (Array.isArray(actual) && Array.isArray(expected)) {
    return actual.length === expected.length && actual.every((item, index) => isEqual(item, expected[index]));
  }
  if (actual !== null && expected !== null && typeof actual === "object" && typeof expected === "object") {
    const keys = Object.keys(expected);
    return (
      keys.length === Object.keys(actual).length &&
      keys.every((key) => isEqual(Reflect.get(actual, key), Reflect.get(expected, key)))
    );
  }
  return Object.is(actual, expected);
}

/**
 * Replay one case.
 *
 * @param testCase - The upstream assertion.
 * @param bindings - The names its expression reads, such as `scaleBand` or `ticks`.
 * @returns Pass, fail with both values, or unsupported with the reason.
 */
export function runD3Case(testCase: D3Case, bindings: Readonly<Record<string, unknown>>): D3Outcome {
  if (!testCase.literal) return { kind: "unsupported", reason: "the expected value is not a literal" };
  const setup = (testCase.setup ?? [])
    .map(({ source }) => source)
    .filter((source) => !source.trimStart().startsWith("assert"));
  const names = Object.keys(bindings);
  const evaluate = (expression: string): unknown => {
    const run = new Function(...names, `${setup.join("\n")}\nreturn (${expression});`);
    return run(...names.map((name) => bindings[name]));
  };
  try {
    const expected = decode(testCase.expected, bindings);
    let actual: unknown;
    try {
      actual = evaluate(testCase.actual);
    } catch (error) {
      // A case without setup names its scale only in the extracted call chain.
      if (!(error instanceof ReferenceError) || !testCase.call) throw error;
      actual = evaluate(chainSource(testCase.call, /^[A-Za-z_$][\w$]*/u.exec(testCase.actual)?.[0] ?? ""));
    }
    return isEqual(actual, expected) ? { kind: "pass" } : { kind: "fail", actual, expected };
  } catch (error) {
    return { kind: "unsupported", reason: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Replay every case of a file.
 *
 * @param file - The case file.
 * @param bindings - The names the expressions read.
 * @returns Each case's `line` with its outcome.
 */
export function runD3Cases(
  file: D3CaseFile,
  bindings: Readonly<Record<string, unknown>>
): { readonly line: number; readonly test: string; readonly outcome: D3Outcome }[] {
  return file.cases.map((testCase) => ({
    line: testCase.line,
    test: testCase.test,
    outcome: runD3Case(testCase, bindings),
  }));
}
