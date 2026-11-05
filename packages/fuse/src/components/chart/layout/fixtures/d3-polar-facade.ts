/**
 * d3-shape's chainable `arc`, `pie`, `lineRadial` and `areaRadial` over Fuse's polar functions, so
 * d3's own test source runs against Fuse unchanged. d3 works in radians and Fuse in degrees, so
 * each facade turns the test's radians into degrees on the way in and back on the way out, and the
 * replay compares numbers within a relative 1e-12 for that round trip. Fuse has no accessor API, so
 * a getter or an accessor function throws, and the test lists each such case by line. A value Fuse
 * draws no arc for, which section 8.2 rules, throws too.
 */
/* oxlint-disable anti-slop/no-unknown-parameters, anti-slop/no-unknown-returns, anti-slop/no-runtime-typeof, anti-slop/no-unsafe-dictionary-type, anti-slop/require-safety-comment-for-type-assertion -- this module mirrors d3-shape's untyped chainable API so d3's own test source runs unchanged, and each method takes whatever the upstream test passes */
import { arcCentroid, arcPath, radialAreaPath, radialLinePath } from "../arc-path";
import { pieAngles } from "../pie";
import { sweepOf, toDegrees, toRadians } from "../polar-angle";

function unsupported(reason: string): never {
  throw new Error(reason);
}

/** A constant from a setter, which Fuse takes, or anything else, which it does not. */
function constant(value: unknown, name: string): number {
  if (typeof value !== "number") unsupported(`Fuse takes no accessor for ${name}`);
  return value;
}

type ArcField =
  | "innerRadius"
  | "outerRadius"
  | "startAngle"
  | "endAngle"
  | "padAngle"
  | "cornerRadius"
  | "padRadius";

/** d3's `arc()`, drawn through Fuse's `arcPath` and `arcCentroid`. */
export function arc() {
  const set: Partial<Record<ArcField, number>> = {};
  const read = (datum: unknown, field: ArcField): number | undefined => {
    const own = set[field];
    if (own !== undefined) return own;
    if (datum !== null && typeof datum === "object" && field in datum) {
      return Number((datum as Record<string, unknown>)[field]);
    }
    return undefined;
  };
  const spec = (datum: unknown) => {
    const required = (field: ArcField): number =>
      read(datum, field) ?? unsupported(`the case reads d3's default ${field} accessor`);
    const base = {
      innerRadius: required("innerRadius"),
      outerRadius: required("outerRadius"),
      startAngle: toDegrees(required("startAngle")),
      endAngle: toDegrees(required("endAngle")),
      padAngle: toDegrees(read(datum, "padAngle") ?? 0),
      cornerRadius: set.cornerRadius ?? 0,
    };
    if (set.padRadius === undefined) return base;
    return { ...base, padRadius: set.padRadius };
  };
  const generator = (datum?: unknown) => arcPath(spec(datum));
  const fields: readonly ArcField[] = [
    "innerRadius",
    "outerRadius",
    "startAngle",
    "endAngle",
    "padAngle",
    "cornerRadius",
    "padRadius",
  ];
  for (const field of fields) {
    Object.assign(generator, {
      [field]: (...args: unknown[]) => {
        if (args.length === 0) unsupported(`Fuse has no ${field} getter`);
        set[field] = constant(args[0], field);
        return generator;
      },
    });
  }
  Object.assign(generator, {
    centroid: (datum?: unknown) => [...arcCentroid(spec(datum))],
    context: () => unsupported("Fuse draws no canvas context"),
    digits: () => unsupported("Fuse fixes the digits"),
  });
  return generator;
}

type Comparator = (a: unknown, b: unknown) => number;

/** d3's `pie()`, laid out through Fuse's `pieAngles` in the order d3's sort gives. */
export function pie() {
  let value: (datum: unknown, index: number, data: unknown[]) => unknown = (datum) => datum;
  let sortValues: Comparator | null = (a, b) => Number(b) - Number(a);
  let sortData: Comparator | null = null;
  let start = 0;
  let end = 2 * Math.PI;
  let pad = 0;
  const generator = (data: Iterable<unknown>) => {
    const rows = Array.from(data);
    const values = rows.map((datum, index) => Number(value(datum, index, rows)));
    const order = rows.map((_, index) => index);
    if (sortData !== null) {
      const compare = sortData;
      order.sort((a, b) => compare(rows[a], rows[b]));
    } else if (sortValues !== null) {
      const compare = sortValues;
      order.sort((a, b) => compare(values[a], values[b]));
    }
    const slices = pieAngles(
      order.map((index) => values[index] ?? 0),
      sweepOf(toDegrees(start), toDegrees(end)),
      toDegrees(pad)
    );
    const arcs = rows.map(() => ({}));
    order.forEach((index, rank) => {
      const slice = slices[rank];
      if (slice === null || slice === undefined) unsupported("Fuse draws no arc for a value at or below 0");
      arcs[index] = {
        data: rows[index],
        value: values[index],
        index: rank,
        startAngle: toRadians(slice.start),
        endAngle: toRadians(slice.end),
        padAngle: toRadians(slice.pad),
      };
    });
    return arcs;
  };
  Object.assign(generator, {
    value: (...args: unknown[]) => {
      if (typeof args[0] !== "function") unsupported("Fuse has no value getter");
      value = args[0] as typeof value;
      return generator;
    },
    sortValues: (...args: unknown[]) => {
      if (args.length === 0) unsupported("Fuse has no sortValues getter");
      sortValues = (args[0] as Comparator | null) ?? null;
      sortData = null;
      return generator;
    },
    sort: (...args: unknown[]) => {
      if (args.length === 0) unsupported("Fuse has no sort getter");
      sortData = (args[0] as Comparator | null) ?? null;
      sortValues = null;
      return generator;
    },
    startAngle: (...args: unknown[]) => {
      if (args.length === 0) unsupported("Fuse has no startAngle getter");
      start = constant(args[0], "startAngle");
      return generator;
    },
    endAngle: (...args: unknown[]) => {
      if (args.length === 0) unsupported("Fuse has no endAngle getter");
      end = constant(args[0], "endAngle");
      return generator;
    },
    padAngle: (...args: unknown[]) => {
      if (args.length === 0) unsupported("Fuse has no padAngle getter");
      pad = constant(args[0], "padAngle");
      return generator;
    },
  });
  return generator;
}

/** A point of d3's default radial accessors: `[angle, radius]` in radians. */
function vertexOf(point: unknown): readonly [number, number] {
  if (!Array.isArray(point)) unsupported("the case passes a datum d3's default accessors read otherwise");
  return [Number(point[0]), Number(point[1])];
}

/** The chainable members Fuse has no counterpart for. */
function accessors(generator: (data: Iterable<unknown>) => string, names: readonly string[]): void {
  for (const name of names) {
    Object.assign(generator, { [name]: () => unsupported(`Fuse has no ${name} accessor`) });
  }
}

/** d3's `lineRadial()`, drawn through Fuse's `radialLinePath` as an open line. */
export function lineRadial() {
  const generator = (data: Iterable<unknown>) =>
    radialLinePath(
      Array.from(data, (point) => {
        const [angle, radius] = vertexOf(point);
        return { angle: toDegrees(angle), radius };
      }),
      "open"
    );
  accessors(generator, ["angle", "radius", "defined", "curve", "context", "digits"]);
  return generator;
}

/** d3's `areaRadial()`, drawn through Fuse's `radialAreaPath` from radius 0. */
export function areaRadial() {
  const generator = (data: Iterable<unknown>) =>
    radialAreaPath(
      Array.from(data, (point) => {
        const [angle, radius] = vertexOf(point);
        return { angle: toDegrees(angle), inner: 0, outer: radius };
      })
    );
  accessors(generator, [
    "angle",
    "startAngle",
    "endAngle",
    "radius",
    "innerRadius",
    "outerRadius",
    "defined",
    "curve",
    "context",
    "lineStartAngle",
    "lineEndAngle",
    "lineInnerRadius",
    "lineOuterRadius",
    "digits",
  ]);
  return generator;
}
