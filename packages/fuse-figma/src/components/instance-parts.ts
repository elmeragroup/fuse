/**
 * Instance parts: a part that renders another kit component, as Alert renders a Button for its
 * action, drawn as an instance of the inner set's variant. The build proves the instance draws what
 * Fuse draws there, so a composite cannot drift from its parts:
 *
 * - It builds the inner definition's root in place, below the outer parts, with the classes the outer
 *   component passes merged in as the inner component merges its `className`, and with the property
 *   values the outer cell gives.
 * - `instance-diff.ts` diffs that root against the inner set's variant, and the instance layer carries
 *   the property values, overrides and sizing the diff finds. A difference no instance field carries
 *   lands in the coverage table as unmapped.
 * - Every declaration names its origin. The inner component's own classes are the inner set's
 *   coverage. The composite owns the classes the outer component passes and those of an outer box that
 *   style the inner root or a layer below it, and the mapper records the spec fields each read of them
 *   fills, so their rows say what the instance does with each: an override where a field they fill
 *   differs and an instance field carries it, unmapped where it differs and none does, and dropped
 *   where the inner variant draws the same. Every read in place that does not map lands too.
 */
import { isDeepStrictEqual } from "node:util";

import { cn } from "@elmeragroup/fuse/recipe-catalog";

import { mapBox } from "./box-mapping";
import type { MapScope, PropertyValues } from "./box-mapping";
import type { Room } from "./box-sizing";
import { splitClasses } from "./cascade";
import type { BoxCascade, Declaration, Feed, FeedTarget, InPlace, Recorder, SpecField } from "./cascade";
import type {
  BuildContext,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  InstanceProperties,
  PartDefinition,
} from "./component-spec";
import type { CoverageRow } from "./coverage";
import { CascadeLogs } from "./coverage-log";
import type { Origin } from "./coverage-log";
import { instancePartsOf, partsOf, rootSlotOf } from "./definition-parts";
import { diffInstance } from "./instance-diff";
import type { InstanceDiff, InstanceDifference } from "./instance-diff";
import type {
  ComponentRootSpec,
  ComponentSetSpec,
  FrameLayerSpec,
  InstanceLayerSpec,
  InstanceOverride,
  InstancePropertiesSpec,
  VariantSpec,
} from "./kit-spec";
import { partsThatScale } from "./placement";
import { PaintedInstances } from "./stacking";
import { makeStateTable } from "./state-table";
import type { StateTable } from "./state-table";

/** A component set the build made before the set that holds an instance of it. */
export type InnerSet = Omit<ComponentSetSpec, "page">;

/** A coverage row before it names its component. */
type Row = Omit<CoverageRow, "component">;

/** What the build keeps for one instance part across the outer set's cells. */
type PartRecord = {
  /** The inner definition's state table, which the inner classes read in place. */
  readonly meaningOf: StateTable;
  /**
   * The logs the inner component's own classes keep in place across the outer cells. Their rows are
   * the inner set's, whose own build finishes its logs, so these never finish.
   */
  readonly logs: CascadeLogs;
  /**
   * The owner of the classes the outer component passes, which records into the coverage of the set
   * or inner component that holds the part, and the logs those classes keep across the outer cells.
   */
  readonly passed: { readonly origin: Origin; readonly logs: CascadeLogs };
  /** The inner definition's parts that draw as a slot around a dot, as its own set draws them. */
  readonly scaling: ReadonlySet<PartDefinition>;
};

/**
 * The spec fields the reads of each declaration fill on an inner root built in place, by
 * {@link declarationKey}, and, for a part nested in another inner root built in place, that root's
 * sink and the instance layer's path there, where a read below the instance fills the instance.
 */
type FeedSink = {
  readonly feeds: Map<string, FeedTarget[]>;
  readonly within: { readonly sink: FeedSink; readonly path: readonly string[] } | undefined;
};

/** One instance part in one outer cell, from its cascade to its coverage. */
type Visit = {
  readonly part: InstanceDefinition;
  /** The inner set's variant the part shows. */
  readonly variant: VariantSpec;
  /** The inner cell. */
  readonly cell: Cell;
  /** The TEXT and INSTANCE_SWAP values the outer cell gives the inner set, which the mapping applies. */
  readonly values: PropertyValues;
  /** The inner definition's parts that draw as a slot around a dot. */
  readonly scaling: ReadonlySet<PartDefinition>;
  /** The outer cell's BOOLEAN values that differ from the inner set's defaults. */
  readonly booleans: Readonly<Record<string, boolean>>;
  /** The rows of the inner component's own declarations, which wait for the cell to settle. */
  readonly innerRows: Row[];
  /** The rows of the composite's declarations on the in-place layers, each with its origin. */
  readonly compositeRows: { readonly row: Row; readonly origin: Origin }[];
  /** The spec fields the reads of each declaration fill on the in-place layers. */
  readonly sink: FeedSink;
  /** The diff of the root built in place, once it maps. */
  readonly diffs: InstanceDiff[];
  /**
   * The instance parts the inner component holds, built in place too. The classes the inner component
   * passes them are its own, which the inner set's coverage holds, so their logs never finish here.
   */
  readonly nested: InstanceParts;
};

/**
 * An instance part as {@link InstanceParts.map} draws it: its layer, and what it paints, the inner root
 * built in place as a frame with the layer's key and name, with each instance inside it drawn so in
 * turn.
 */
export type MappedInstance = {
  readonly layer: InstanceLayerSpec;
  readonly painted: FrameLayerSpec;
};

/** An instance part cascaded in place in one outer cell, which {@link InstanceParts.map} maps. */
export type CascadedInstance = {
  readonly kind: "instance";
  /** The instance layer's key, the part's, which tells two instances of one set apart. */
  readonly key: string;
  /** The instance layer's name, the inner root's `data-slot`. */
  readonly name: string;
  /** The inner root's cascade, below its parent box. */
  readonly cascade: BoxCascade;
  /** What the build keeps of the part in the cell, from its cascade to its coverage. */
  readonly visit: Visit;
};

/**
 * The instance parts of one set, or of one inner root built in place: each part's in-place cascade,
 * its mapping and diff, and its coverage.
 */
export class InstanceParts {
  readonly #context: BuildContext;
  readonly #sets: ReadonlyMap<string, InnerSet>;
  readonly #emit: Recorder;
  readonly #owner: FeedSink | undefined;
  readonly #parts = new Map<InstanceDefinition, PartRecord>();
  readonly #visits: Visit[] = [];

  /**
   * @param context - The compiled utilities and the synced variables.
   * @param sets - The sets built so far, by key, which the parts show.
   * @param emit - Adds a row to the coverage table of the set or the inner component that holds the
   *   parts.
   * @param owner - The feeds of the inner root built in place that holds the parts, undefined for a
   *   set's own.
   */
  constructor(context: BuildContext, sets: ReadonlyMap<string, InnerSet>, emit: Recorder, owner?: FeedSink) {
    this.#context = context;
    this.#sets = sets;
    this.#emit = emit;
    this.#owner = owner;
  }

  /**
   * Cascade an instance part's inner root directly below its parent box in an outer cell: the inner
   * definition's classes for the inner cell, with the classes the outer component passes merged after
   * them by `cn`, as the inner component merges its `className`. The inner component owns its own
   * classes, and the composite the passed ones.
   *
   * @param part - The instance part.
   * @param parent - The cascade of the box that holds the part.
   * @param outer - The outer cell.
   * @returns The cascaded part.
   * @throws When the part shows a set built after the one that holds it or not at all, a cell its set
   *   lacks, or a property its set does not define.
   */
  cascade(part: InstanceDefinition, parent: BoxCascade, outer: Cell): CascadedInstance {
    const { of } = part;
    const set = this.#sets.get(of.key);
    if (set === undefined) {
      throw new Error(
        `${part.key} shows ${of.name}, whose set the build has not made yet, so build ${of.name} before the set that holds it`
      );
    }
    const cell = part.cell(outer);
    const variant = set.variants.find((candidate) =>
      of.axes.every((axis) => candidate.properties[axis.name] === cell[axis.name])
    );
    if (variant === undefined) {
      throw new Error(`${part.key} shows ${of.name} at ${JSON.stringify(cell)}, a cell its set lacks`);
    }
    const record = this.#recordOf(part, set);
    const given = new Set(splitClasses(part.classesFor?.(outer) ?? ""));
    const merged = splitClasses(cn(of.classesFor(cell), [...given].join(" ")));
    const values = part.properties?.(outer) ?? {};
    const innerRows: Row[] = [];
    const compositeRows: Visit["compositeRows"] = [];
    const inner: Origin = {
      record: (row) => {
        innerRows.push(row);
      },
    };
    const sink: FeedSink = {
      feeds: new Map(),
      within: this.#owner === undefined ? undefined : { sink: this.#owner, path: [...parent.path, part.key] },
    };
    const visit: Visit = {
      part,
      variant,
      cell,
      values: valuesOf(values, set, part.key),
      scaling: record.scaling,
      booleans: booleansOf(values, set, part.key),
      innerRows,
      compositeRows,
      sink,
      diffs: [],
      nested: new InstanceParts(this.#context, this.#sets, inner.record, sink),
    };
    const inPlace: InPlace = {
      inner,
      composite: (row, origin) => {
        compositeRows.push({ row, origin });
      },
      fed: (declaration, feed) => {
        fedInto(sink, declaration, feed);
      },
      relocate: (path, into, keep) => {
        relocate(sink.feeds, path, into, keep);
      },
    };
    this.#visits.push(visit);
    const cascade = parent.instance(
      {
        own: merged.filter((className) => !given.has(className)).join(" "),
        passed: merged.filter((className) => given.has(className)).join(" "),
      },
      of.slot,
      { slot: rootSlotOf(of, cell), tag: of.element?.tag },
      of.elementDefaults ?? [],
      { meaningOf: record.meaningOf, cell, logs: record.logs, inPlace, passed: record.passed }
    );
    return { kind: "instance", key: part.key, name: of.slot, cascade, visit };
  }

  /**
   * Map a cascaded part's inner root in the room its parent gives it, as its own set maps it, and
   * diff it against the inner variant.
   *
   * @param cascaded - The part, as {@link cascade} left it.
   * @param room - What the part's parent gives it on each axis.
   * @returns The instance layer, and what it paints.
   */
  map(cascaded: CascadedInstance, room: Room): MappedInstance {
    const { visit, cascade } = cascaded;
    const { part, variant } = visit;
    const scope: MapScope = {
      variant: variant.key,
      cell: visit.cell,
      context: this.#context,
      scaling: visit.scaling,
      instances: visit.nested,
      values: visit.values,
      painted: new PaintedInstances(),
    };
    const root: ComponentRootSpec = {
      name: part.of.slot,
      ...mapBox(part.of, cascade, scope, room),
      clips: true,
    };
    const diff = diffInstance(root, variant.root);
    visit.diffs.push(diff);
    const properties = propertiesOf(diff, visit.booleans);
    const plain: InstanceLayerSpec = {
      kind: "instance",
      key: part.key,
      name: part.of.slot,
      componentSet: part.of.key,
      variant: variant.key,
      sizing: diff.sizing,
    };
    const set = properties === undefined ? plain : { ...plain, properties };
    const overridden = diff.overrides.length === 0 ? set : { ...set, overrides: diff.overrides };
    const exposed = part.exposed === undefined ? overridden : { ...overridden, exposed: part.exposed };
    const layer = part.optional === undefined ? exposed : { ...exposed, visibleProperty: part.optional.name };
    const painted: FrameLayerSpec = {
      ...scope.painted.resolveBox(root),
      kind: "frame",
      key: layer.key,
      name: layer.name,
    };
    return { layer, painted };
  }

  /**
   * Give the coverage rows of the parts the cell built in place, once the cell has settled. Each row
   * of a composite's declaration goes to its origin as {@link classified} says. The inner component's
   * own rows that map belong to the inner set's coverage, and each that does not map, and each
   * difference no instance field carries, goes to the set or inner component that holds the part.
   * Call it after each cell settles.
   */
  settle(): void {
    for (const visit of this.#visits.splice(0)) {
      visit.nested.settle();
      for (const { row, origin } of visit.compositeRows) {
        origin.record(classified(row, visit));
      }
      for (const row of visit.innerRows) {
        if (row.outcome === "unmapped") {
          this.#emit({ ...row, detail: `in the ${visit.part.key} instance, ${row.detail}` });
        }
      }
      for (const difference of visit.diffs.flatMap((diff) => diff.unmapped)) {
        this.#emit({
          part: visit.part.of.slot,
          className: "",
          property: difference.field,
          value: difference.inPlace,
          outcome: "unmapped",
          detail: differenceDetail(visit, difference),
        });
      }
    }
  }

  /**
   * Give the rows the logs of the classes the outer component passes leave, as
   * {@link CascadeLogs.finish} says, to the coverage of the set or inner component that holds the
   * part: a passed class whose variants never hold in an inner cell lands there. The inner
   * component's own classes leave theirs to the inner set. Call it after every cell.
   */
  finish(): void {
    for (const { passed } of this.#parts.values()) {
      passed.logs.finish(passed.origin.record);
    }
  }

  #recordOf(part: InstanceDefinition, set: InnerSet): PartRecord {
    const known = this.#parts.get(part);
    if (known !== undefined) {
      return known;
    }
    const made: PartRecord = {
      meaningOf: makeStateTable(part.of),
      logs: new CascadeLogs(),
      passed: { origin: { record: this.#emit }, logs: new CascadeLogs() },
      scaling: partsThatScale(
        partsOf(part.of),
        set.variants.map((variant) => variant.properties),
        this.#context.compiled
      ),
    };
    this.#parts.set(part, made);
    return made;
  }
}

/** The key of a declaration's feeds: its part, class, property and value, as its row names them. */
function declarationKey({ part, className, property, value }: Declaration): string {
  return JSON.stringify([part, className, property, value]);
}

/**
 * Note the spec fields a read of a declaration fills, and, for a part nested in another inner root
 * built in place, that the declaration fills the nested instance there as a whole, up to the outermost
 * root.
 */
function fedInto(sink: FeedSink, declaration: Declaration, feed: Feed): void {
  if (feed.length === 0) {
    return;
  }
  const key = declarationKey(declaration);
  sink.feeds.set(key, [...(sink.feeds.get(key) ?? []), ...feed]);
  if (sink.within !== undefined) {
    fedInto(sink.within.sink, declaration, [{ path: sink.within.path, field: "instance" }]);
  }
}

/**
 * Move the feeds at or below a layer's path into the layer the mapping puts in its place, as a scaled
 * part's dot or a part's box inside its margins, keeping the fields of `keep` on the layer itself.
 */
function relocate(
  feeds: Map<string, FeedTarget[]>,
  path: readonly string[],
  into: string,
  keep: ReadonlySet<SpecField>
): void {
  const below = (feed: FeedTarget) => path.every((key, index) => feed.path[index] === key);
  for (const [key, fed] of feeds) {
    feeds.set(
      key,
      fed.map((feed) =>
        below(feed) && (feed.path.length > path.length || !keep.has(feed.field))
          ? { ...feed, path: [...path, into, ...feed.path.slice(path.length)] }
          : feed
      )
    );
  }
}

/** The spec field each instance override carries, as a read's feed names it. */
const OVERRIDDEN_FIELD = {
  fill: "fill",
  strokeColor: "stroke",
  cornerRadius: "cornerRadius",
  effects: "shadows",
  textColor: "color",
  textAlign: "align",
  glyph: "color",
} as const satisfies Record<InstanceOverride["field"], SpecField>;

/** Whether a feed's target is a spec field at a path. */
function fills(feed: FeedTarget, path: readonly string[], field: string): boolean {
  return feed.field === field && isDeepStrictEqual(feed.path, path);
}

/**
 * A row of a composite's declaration on the in-place layers, by what the instance does with the
 * fields the declaration's reads fill. A read that fills a field the instance draws another way than
 * the variant, where no instance field carries it, is unmapped with that difference. One that fills a
 * field an override or the instance's own sizing carries keeps its outcome, bound or literal. One whose
 * fields the variant draws the same repeats it and drops. A row that is no read keeps its outcome.
 */
function classified(row: Row, visit: Visit): Row {
  const [diff] = visit.diffs;
  if (diff === undefined || (row.outcome !== "bound" && row.outcome !== "literal")) {
    return row;
  }
  const fed = visit.sink.feeds.get(declarationKey(row)) ?? [];
  const unmapped = diff.unmapped.find((difference) =>
    fed.some((feed) => fills(feed, difference.path, difference.field))
  );
  if (unmapped !== undefined) {
    return { ...row, outcome: "unmapped", detail: differenceDetail(visit, unmapped) };
  }
  const carried = [
    ...diff.overrides.map((override) => ({ path: override.path, field: OVERRIDDEN_FIELD[override.field] })),
    ...(isDeepStrictEqual(diff.sizing, visit.variant.root.sizing) ? [] : [{ path: [], field: "sizing" }]),
  ];
  if (fed.some((feed) => carried.some(({ path, field }) => fills(feed, path, field)))) {
    return row;
  }
  return {
    ...row,
    outcome: "dropped",
    detail: `the instance's variant ${visit.variant.key} draws the same, so the class repeats it`,
  };
}

/** Why a difference stays unmapped: the field, the two values, the inner variant and the fix. */
function differenceDetail(visit: Visit, difference: InstanceDifference): string {
  const layer = difference.path.length === 0 ? "the root" : difference.path.join(" / ");
  return `${layer} draws ${difference.field} ${difference.inPlace} where the composite holds it and ${difference.variant} in ${visit.variant.key}, and an instance carries only property values, paints, corners, shadows, text alignments and its own sizing, so give ${visit.part.of.name} an axis that draws it, or draw the part as a frame`;
}

/** The property values an instance layer gives the inner set, undefined where none differs from its default. */
function propertiesOf(
  diff: InstanceDiff,
  booleans: Readonly<Record<string, boolean>>
): InstancePropertiesSpec | undefined {
  const text: InstancePropertiesSpec = Object.keys(diff.text).length === 0 ? {} : { text: diff.text };
  const boolean = Object.keys(booleans).length === 0 ? text : { ...text, boolean: booleans };
  const swap = Object.keys(diff.swap).length === 0 ? boolean : { ...boolean, swap: diff.swap };
  return Object.keys(swap).length === 0 ? undefined : swap;
}

/**
 * Refuse a property name the inner set does not define as a property of the given type.
 *
 * @throws When a name is not among `defined`.
 */
function refuseUndefined(
  where: string,
  set: InnerSet,
  type: string,
  given: readonly string[],
  defined: readonly string[]
): void {
  const unknown = given.find((name) => !defined.includes(name));
  if (unknown !== undefined) {
    throw new Error(
      `${where} gives ${set.name} the ${type} property ${unknown}, which ${set.name} does not define`
    );
  }
}

/**
 * The BOOLEAN values an outer cell gives the inner set that differ from the set's defaults. A value
 * shows or hides the part the property links, as the inner set's own property does, so the inner root
 * builds in place with every part its variant holds.
 *
 * @throws When a value names a property the inner set does not define as a BOOLEAN.
 */
function booleansOf(
  values: InstanceProperties,
  set: InnerSet,
  where: string
): Readonly<Record<string, boolean>> {
  const given = values.boolean ?? {};
  const defaults = new Map(
    (set.booleanProperties ?? []).map((property) => [property.name, property.defaultValue])
  );
  refuseUndefined(where, set, "BOOLEAN", Object.keys(given), [...defaults.keys()]);
  return Object.fromEntries(Object.entries(given).filter(([name, value]) => defaults.get(name) !== value));
}

/**
 * The TEXT and INSTANCE_SWAP values an outer cell gives the inner set, which the mapping applies to
 * the inner root's labels and icons in place, leaving the inner definition as it is. The diff then
 * finds them as property values, or leaves unmapped what they change beside the characters and the
 * icon.
 *
 * @throws When a value names a property the inner set does not define as that type.
 */
function valuesOf(values: InstanceProperties, set: InnerSet, where: string): PropertyValues {
  const text = values.text ?? {};
  const swap = values.swap ?? {};
  refuseUndefined(
    where,
    set,
    "TEXT",
    Object.keys(text),
    set.textProperties.map(({ name }) => name)
  );
  refuseUndefined(
    where,
    set,
    "INSTANCE_SWAP",
    Object.keys(swap),
    set.swapProperties.map(({ name }) => name)
  );
  return { text, swap };
}

/**
 * Refuse a list of definitions the build cannot build bottom-up: one whose instance parts form a
 * cycle, so no set of them can build first, and one whose instance part shows a definition the list
 * puts after it or leaves out, since a set's instances read the inner set's variants.
 *
 * @param definitions - The definitions, in the order the build makes their sets.
 * @throws When the instance parts form a cycle, naming it, or show a later or missing definition.
 */
export function checkInstanceOrder(definitions: readonly ComponentDefinition[]): void {
  for (const definition of definitions) {
    const cycle = cycleFrom([definition]);
    if (cycle !== undefined) {
      const holds = cycle.slice(1).map((inner, index) => `${cycle[index]?.name ?? ""} holds ${inner.name}`);
      throw new Error(
        `the instance parts form a cycle, ${holds.join(", ")}, so none of their sets can build first`
      );
    }
  }
  const order = new Map(definitions.map((definition, index) => [definition.key, index]));
  definitions.forEach((definition, index) => {
    for (const part of instancePartsOf(definition)) {
      const at = order.get(part.of.key);
      if (at === undefined) {
        throw new Error(
          `${definition.name} holds ${part.of.name} as ${part.key}, whose set the build does not make`
        );
      }
      if (at > index) {
        throw new Error(
          `${definition.name} holds ${part.of.name} as ${part.key}, whose set the build makes after it, so list ${part.of.name} first`
        );
      }
    }
  });
}

/** The first cycle the instance parts below the path's last definition close, from where it starts. */
function cycleFrom(path: readonly ComponentDefinition[]): readonly ComponentDefinition[] | undefined {
  const last = path.at(-1);
  for (const { of } of last === undefined ? [] : instancePartsOf(last)) {
    const at = path.findIndex(({ key }) => key === of.key);
    const cycle = at === -1 ? cycleFrom([...path, of]) : [...path.slice(at), of];
    if (cycle !== undefined) {
      return cycle;
    }
  }
  return undefined;
}
