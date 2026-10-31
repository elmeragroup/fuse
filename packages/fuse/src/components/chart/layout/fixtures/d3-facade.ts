/**
 * d3-scale's chainable API over Fuse's scale functions, so d3's own test source runs against Fuse
 * unchanged. Each method stores its option, and every read recomputes the layout through the Fuse
 * function under test. Methods Fuse has no counterpart for, such as `unknown`, throw, and the test
 * lists each such case by line.
 */
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-runtime-typeof, anti-slop/require-safety-comment-for-type-assertion -- this module mirrors d3-scale's untyped chainable API so d3's own test source runs unchanged, and each method takes whatever the upstream test passes */
import { bandScale, pointScale } from "../band-scale";
import { invertValue, linearScale, niceScale, scaleTicks, scaleValue } from "../linear-scale";
import type { LinearScale } from "../linear-scale";

function unsupported(name: string): never {
  throw new Error(`Fuse has no ${name}`);
}

/** d3's ordinal domain keeps the first of equal values, comparing dates by instant. */
function uniqueDomain(values: Iterable<unknown>): unknown[] {
  const seen = new Set<unknown>();
  const kept: unknown[] = [];
  for (const value of values) {
    const key = value instanceof Date ? value.getTime() : value;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(value);
  }
  return kept;
}

type Band = {
  (value: unknown): number | undefined;
  domain(values?: Iterable<unknown>): unknown;
  range(values?: Iterable<number>): unknown;
  rangeRound(values: Iterable<number>): unknown;
  round(value?: boolean): unknown;
  padding(value?: number): unknown;
  paddingInner?: (value?: number) => unknown;
  paddingOuter?: (value?: number) => unknown;
  align(value?: number): unknown;
  bandwidth(): number;
  step(): number;
  copy(): Band;
};

type BandState = {
  domain: unknown[];
  range: [number, number];
  round: boolean;
  paddingInner: number;
  paddingOuter: number;
  align: number;
};

function makeBand(state: BandState, point: boolean): Band {
  const layout = () =>
    point
      ? pointScale({
          count: state.domain.length,
          range: state.range,
          padding: state.paddingOuter,
          align: state.align,
          round: state.round,
        })
      : bandScale({
          count: state.domain.length,
          range: state.range,
          paddingInner: state.paddingInner,
          paddingOuter: state.paddingOuter,
          align: state.align,
          round: state.round,
        });
  const indexOf = (value: unknown): number =>
    state.domain.findIndex((item) =>
      item instanceof Date && value instanceof Date
        ? item.getTime() === value.getTime()
        : Object.is(item, value)
    );
  const scale = ((value: unknown) => {
    const index = indexOf(value);
    return index === -1 ? undefined : layout().starts[index];
  }) as Band;
  scale.domain = (values) => {
    if (values === undefined) return [...state.domain];
    state.domain = uniqueDomain(values);
    return scale;
  };
  scale.range = (values) => {
    if (values === undefined) return [...state.range];
    const [r0 = 0, r1 = 1] = [...values].map(Number);
    state.range = [r0, r1];
    return scale;
  };
  scale.rangeRound = (values) => {
    scale.range(values);
    state.round = true;
    return scale;
  };
  scale.round = (value) => {
    if (value === undefined) return state.round;
    state.round = Boolean(value);
    return scale;
  };
  scale.align = (value) => {
    if (value === undefined) return state.align;
    state.align = Math.max(0, Math.min(1, value));
    return scale;
  };
  if (point) {
    scale.padding = (value) => {
      if (value === undefined) return state.paddingOuter;
      state.paddingOuter = Number(value);
      return scale;
    };
  } else {
    scale.padding = (value) => {
      if (value === undefined) return state.paddingInner;
      state.paddingOuter = Number(value);
      state.paddingInner = Math.min(1, state.paddingOuter);
      return scale;
    };
    scale.paddingInner = (value) => {
      if (value === undefined) return state.paddingInner;
      state.paddingInner = Math.min(1, Number(value));
      return scale;
    };
    scale.paddingOuter = (value) => {
      if (value === undefined) return state.paddingOuter;
      state.paddingOuter = Number(value);
      return scale;
    };
  }
  scale.bandwidth = () => layout().bandwidth;
  scale.step = () => layout().step;
  scale.copy = () => makeBand({ ...state, domain: [...state.domain] }, point);
  return scale;
}

/** `scaleBand` over Fuse's band scale. */
export function scaleBand(...args: unknown[]): Band {
  const scale = makeBand(
    { domain: [], range: [0, 1], round: false, paddingInner: 0, paddingOuter: 0, align: 0.5 },
    false
  );
  if (args.length === 1) scale.range(args[0] as Iterable<number>);
  if (args.length >= 2) {
    scale.domain(args[0] as Iterable<unknown>);
    scale.range(args[1] as Iterable<number>);
  }
  return scale;
}

/** `scalePoint` over Fuse's point scale. */
export function scalePoint(...args: unknown[]): Band {
  const scale = makeBand(
    { domain: [], range: [0, 1], round: false, paddingInner: 1, paddingOuter: 0, align: 0.5 },
    true
  );
  if (args.length === 1) scale.range(args[0] as Iterable<number>);
  if (args.length >= 2) {
    scale.domain(args[0] as Iterable<unknown>);
    scale.range(args[1] as Iterable<number>);
  }
  return scale;
}

type Linear = {
  (value: unknown): number;
  domain(values?: Iterable<unknown>): unknown;
  range(values?: Iterable<unknown>): unknown;
  clamp(value?: boolean): unknown;
  invert(value: unknown): number;
  nice(count?: number): Linear;
  ticks(count?: number): number[];
  copy(): Linear;
  unknown(): never;
  interpolate(): never;
  rangeRound(): never;
  tickFormat(): never;
};

function pair(values: Iterable<unknown>, name: string): [number, number] {
  const list = [...values];
  if (list.length !== 2) unsupported(`${name} with ${String(list.length)} values`);
  const [a, b] = list;
  if (typeof a !== "number" && !(a instanceof Date) && typeof a !== "string")
    unsupported(`${name} of ${typeof a}`);
  if (typeof b !== "number" && !(b instanceof Date) && typeof b !== "string")
    unsupported(`${name} of ${typeof b}`);
  const numbers: [number, number] = [Number(a), Number(b)];
  if (typeof a === "string" && Number.isNaN(numbers[0])) unsupported(`${name} of colour strings`);
  return numbers;
}

function makeLinear(start: LinearScale): Linear {
  let state = start;
  const scale = ((value: unknown) => scaleValue(state, Number(value))) as Linear;
  scale.domain = (values) => {
    if (values === undefined) return [...state.domain];
    state = { ...state, domain: pair(values, "domain") };
    return scale;
  };
  scale.range = (values) => {
    if (values === undefined) return [...state.range];
    state = { ...state, range: pair(values, "range") };
    return scale;
  };
  scale.clamp = (value) => {
    if (value === undefined) return state.clamp;
    state = { ...state, clamp: Boolean(value) };
    return scale;
  };
  scale.invert = (value) => invertValue(state, Number(value));
  scale.nice = (count) => {
    state = niceScale(state, count ?? 10);
    return scale;
  };
  scale.ticks = (count) => scaleTicks(state, count ?? 10);
  scale.copy = () => makeLinear(state);
  scale.unknown = () => unsupported("unknown");
  scale.interpolate = () => unsupported("interpolate");
  scale.rangeRound = () => unsupported("rangeRound");
  scale.tickFormat = () => unsupported("tickFormat");
  return scale;
}

/** `scaleLinear` over Fuse's linear scale. */
export function scaleLinear(...args: unknown[]): Linear {
  const scale = makeLinear(linearScale([0, 1], [0, 1]));
  if (args.length === 1) scale.range(args[0] as Iterable<unknown>);
  if (args.length >= 2) {
    scale.domain(args[0] as Iterable<unknown>);
    scale.range(args[1] as Iterable<unknown>);
  }
  return scale;
}
