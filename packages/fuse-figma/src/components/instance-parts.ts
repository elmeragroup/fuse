/**
 * Instance parts: a part that renders another kit component, as Alert renders a Button for its
 * action, drawn as an instance of the inner set's variant. The build proves the instance draws what
 * Fuse draws there, so a composite cannot drift from its parts:
 *
 * - It builds the inner definition's root in place, below the outer parts, from the composite's
 *   capture, which holds the classes the outer component passes, and with the property values the
 *   outer cell gives.
 * - `instance-diff.ts` diffs that root against the inner set's variant, and the instance layer carries
 *   the property values, overrides and sizing the diff finds. A difference no instance field carries
 *   lands in the coverage table as unmapped.
 * - Every declaration names its origin. A declaration the inner set claims on the same box, host or
 *   pseudo-element, of the element's twin is the inner set's coverage, and where instances nest the
 *   innermost set that claims it owns it, as `capture/instance-twin.ts` decides. The composite owns
 *   every other: a class the outer component passes, a variant of an inner class that only the
 *   composite's markup turns on, and the classes of an outer box that style the inner root or a layer
 *   below it. The mapper records the spec fields each read of them fills, so their rows say what the
 *   instance does with each: an override where a field they fill differs and an instance field
 *   carries it, unmapped where it differs and none does, and dropped where the inner variant draws
 *   the same. Every read in place that does not map lands too.
 */
import { isDeepStrictEqual } from "node:util";

import { partsThatScaleIn } from "../capture/capture-cascade";
import type { SetCapture } from "../capture/capture-format";
import type { BoxCascade } from "./box-cascade";
import { mapBox } from "./box-mapping";
import type { MapScope, PropertyValues } from "./box-mapping";
import type { Room } from "./box-sizing";
import { KitUnmappable } from "./build-errors";
import type {
  BuildContext,
  Cell,
  ComponentDefinition,
  InstanceDefinition,
  InstanceProperties,
  NestedProperties,
  PartDefinition,
} from "./component-spec";
import type { RecordedRow } from "./coverage";
import type { Origin } from "./coverage-log";
import { instancePartsOf, instanceRootSlotOf } from "./definition-parts";
import { diffInstance, kindsAndKeys } from "./instance-diff";
import type { InstanceDiff, InstanceDifference } from "./instance-diff";
import { layerAt } from "./kit-spec";
import type {
  BoxSpec,
  ComponentRootSpec,
  ComponentSetSpec,
  FrameLayerSpec,
  InstanceLayerSpec,
  InstanceOverride,
  InstancePropertiesSpec,
  VariantSpec,
} from "./kit-spec";
import type { Declaration, Feed, FeedTarget, InPlace, Recorder, SpecField } from "./layer-style";
import { prepareParts } from "./part-preparation";
import { PaintedInstances } from "./stacking";

/** A component set the build made before the set that holds an instance of it. */
export type InnerSet = Omit<ComponentSetSpec, "page">;

/** A coverage row before it names its component. */
type Row = RecordedRow;

/** What the build keeps for one instance part across the outer set's cells. */
type PartRecord = {
  /**
   * The owner of the classes the outer component passes, which records into the coverage of the set
   * or inner component that holds the part.
   */
  readonly passed: { readonly origin: Origin };
  /** The inner definition's parts that draw as a slot around a dot, as its own set draws them. */
  readonly scaling: ReadonlySet<PartDefinition>;
};

/**
 * The spec fields the reads of each declaration fill on an inner root built in place, by
 * {@link declarationKey}, and, for a part nested in another inner root built in place, that root's
 * sink and the instance layer's path there, where a read below the instance fills the instance.
 * `reads` holds the fields of each read a row names, which a relocation moves with the rest.
 */
type FeedSink = {
  readonly feeds: Map<string, FeedTarget[]>;
  readonly reads: FedRead[];
  readonly within: { readonly sink: FeedSink; readonly path: readonly string[] } | undefined;
};

/** The fields one read fills on one inner root built in place, which a relocation moves. */
type FedRead = { targets: readonly FeedTarget[] };

/** The inner root built in place that holds a set of instance parts: its feeds and its part. */
type Holder = { readonly sink: FeedSink; readonly visit: () => Visit };

/**
 * The row of a composite's declaration on the in-place layers, with its origin. A row a read gives
 * names the fields the read fills there, and those it fills on the inner root built in place that
 * holds the instance, if any, as `placing`.
 */
type CompositeRow = {
  readonly row: Row;
  readonly origin: Origin;
  readonly read: { readonly fed: FedRead; readonly placing: FedRead | undefined } | undefined;
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
  /** The rows of the composite's declarations on the in-place layers, which wait for the cell to settle. */
  readonly compositeRows: CompositeRow[];
  /** Adds a row to the coverage table of the set or inner component that holds the part. */
  readonly emit: Recorder;
  /** The spec fields the reads of each declaration fill on the in-place layers. */
  readonly sink: FeedSink;
  /**
   * The part built in place whose inner root holds this one, if any, and the fields this instance
   * fills there as a whole.
   */
  readonly holder: { readonly visit: () => Visit; readonly whole: FedRead } | undefined;
  /** The root built in place and its diff, once it maps. */
  readonly mapped: { readonly root: ComponentRootSpec; readonly diff: InstanceDiff }[];
  /** The instance parts the inner component holds, built in place too. */
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
  readonly #captureOf: (key: string) => SetCapture | undefined;
  readonly #emit: Recorder;
  readonly #owner: Holder | undefined;
  readonly #given: readonly NestedProperties[];
  readonly #parts = new Map<InstanceDefinition, PartRecord>();
  readonly #visits: Visit[] = [];

  /**
   * @param context - The compiled utilities and the synced variables.
   * @param sets - The sets built so far, by key, which the parts show.
   * @param captureOf - The capture each of those sets was built from, by key, which says which of
   *   its parts win a `scale`.
   * @param emit - Adds a row to the coverage table of the set or the inner component that holds the
   *   parts.
   * @param owner - The inner root built in place that holds the parts, undefined for a set's own.
   * @param given - The TEXT values an outer composite gives instances at or below these parts, at the
   *   keys from here down, none for a set's own.
   */
  constructor(
    context: BuildContext,
    sets: ReadonlyMap<string, InnerSet>,
    captureOf: (key: string) => SetCapture | undefined,
    emit: Recorder,
    owner?: Holder,
    given: readonly NestedProperties[] = []
  ) {
    this.#context = context;
    this.#sets = sets;
    this.#captureOf = captureOf;
    this.#emit = emit;
    this.#owner = owner;
    this.#given = given;
  }

  /**
   * Cascade an instance part's inner root directly below its parent box in an outer cell. The inner
   * component owns the declarations it claims on the same box of each element's twin, and the
   * composite every other, as `capture/instance-twin.ts` decides.
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
      throw new KitUnmappable({
        message: `${part.key} shows ${of.name}, whose set the build has not made yet, so build ${of.name} before the set that holds it`,
      });
    }
    const cell = part.cell(outer);
    const variant = set.variants.find((candidate) =>
      of.axes.every((axis) => candidate.properties[axis.name] === cell[axis.name])
    );
    if (variant === undefined) {
      throw new KitUnmappable({
        message: `${part.key} shows ${of.name} at ${JSON.stringify(cell)}, a cell its set lacks`,
      });
    }
    const record = this.#recordOf(part);
    const values = withGiven(part.properties?.(outer) ?? {}, this.#given, part.key);
    checkNested(values.nested ?? [], part.of, part.key);
    const innerRows: Row[] = [];
    const compositeRows: CompositeRow[] = [];
    const inner: Origin = {
      record: (row) => {
        innerRows.push(row);
      },
    };
    const owner = this.#owner;
    const path = [...parent.path, part.key];
    const sink: FeedSink = {
      feeds: new Map(),
      reads: [],
      within: owner === undefined ? undefined : { sink: owner.sink, path },
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
      emit: this.#emit,
      sink,
      holder:
        owner === undefined
          ? undefined
          : { visit: owner.visit, whole: fedRead(owner.sink, [{ path, field: "instance" }]) },
      mapped: [],
      nested: new InstanceParts(
        this.#context,
        this.#sets,
        this.#captureOf,
        inner.record,
        { sink, visit: () => visit },
        values.nested
      ),
    };
    const inPlace: InPlace = {
      inner,
      composite: (row, origin, read) => {
        compositeRows.push({
          row,
          origin,
          read:
            read === undefined
              ? undefined
              : {
                  fed: fedRead(sink, read.feed),
                  placing:
                    owner === undefined || read.placing.length === 0
                      ? undefined
                      : fedRead(owner.sink, read.placing),
                },
        });
      },
      fed: (declaration, feed) => {
        fedInto(sink, declaration, feed);
      },
      relocate: (move) => {
        relocate(sink, move);
      },
    };
    this.#visits.push(visit);
    const cascade = parent.instance(
      of.slot,
      part.after === undefined
        ? { slot: instanceRootSlotOf(part, cell), set: of.key }
        : { slot: instanceRootSlotOf(part, cell), set: of.key, after: part.after },
      { cell, inPlace, passed: record.passed }
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
      translates: new WeakMap(),
      main: variant.root,
    };
    const root: ComponentRootSpec = {
      name: part.of.slot,
      ...mapBox(part.of, cascade, scope, room, prepareParts(part.of, cascade, scope)),
      // The inner root clips in place as its own set draws it.
      clips: variant.root.clips,
    };
    const diff = diffInstance(root, variant.root);
    visit.mapped.push({ root, diff });
    const properties = propertiesOf(diff, visit.booleans);
    const plain: InstanceLayerSpec = {
      kind: "instance",
      key: part.key,
      name: part.of.slot,
      componentSet: part.of.key,
      variant: variant.key,
      sizing: diff.sizing,
    };
    const floored = diff.minWidth === undefined ? plain : { ...plain, minWidth: diff.minWidth };
    const set = properties === undefined ? floored : { ...floored, properties };
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
   * Give the coverage rows of the parts the cell built in place, at every depth, once the cell has
   * settled. Each read of a composite's declaration gets one decision, as {@link decided} says, and
   * each declaration's rows then follow its worst read, as {@link merged} says. A row goes to its
   * origin before the part that owns the origin gives its own rows, so a declaration of an inner
   * component whose read an outer instance decides lands with that component's rows. The inner
   * component's own rows that map belong to the inner set's coverage, and each that does not map,
   * and each difference no instance field carries, goes to the set or inner component that holds the
   * part. Call it on a set's own parts after each cell settles.
   */
  settle(): void {
    const visits = this.#drained();
    const reads = new Map(
      visits.map((visit) => [
        visit,
        visit.compositeRows.map(({ row, origin, read }) => ({
          row,
          origin,
          decision: decided(
            row,
            visit,
            read?.fed.targets ?? visit.sink.feeds.get(declarationKey(row)) ?? [],
            read?.placing
          ),
        })),
      ])
    );
    const rows = merged([...reads.values()].flat());
    for (const visit of visits) {
      for (const read of reads.get(visit) ?? []) {
        const row = rows.get(read);
        if (row !== undefined) {
          read.origin.record(row);
        }
      }
      for (const row of visit.innerRows) {
        if (row.outcome === "unmapped") {
          visit.emit({ ...row, detail: `in the ${visit.part.key} instance, ${row.detail}` });
        }
      }
      for (const difference of visit.mapped.flatMap(({ diff }) => diff.unmapped)) {
        visit.emit({
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

  /** Take the parts the cell built in place, each after the parts its inner root holds. */
  #drained(): Visit[] {
    return this.#visits.splice(0).flatMap((visit) => [...visit.nested.#drained(), visit]);
  }

  #recordOf(part: InstanceDefinition): PartRecord {
    const known = this.#parts.get(part);
    if (known !== undefined) {
      return known;
    }
    // The inner set's own capture says which of its parts win a `scale`, as its own build reads it.
    const inner = this.#captureOf(part.of.key);
    const made: PartRecord = {
      passed: { origin: { record: this.#emit } },
      scaling: inner === undefined ? new Set() : partsThatScaleIn(inner, part.of.parts ?? []),
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

/** Move each feed to the targets `move` gives it, where the mapping draws its field instead. */
function relocate(sink: FeedSink, move: (feed: FeedTarget) => readonly FeedTarget[]): void {
  for (const [key, fed] of sink.feeds) {
    sink.feeds.set(key, fed.flatMap(move));
  }
  for (const read of sink.reads) {
    read.targets = read.targets.flatMap(move);
  }
}

/** Keep the fields one read fills on an inner root built in place, where relocations move them. */
function fedRead(sink: FeedSink, targets: Feed): FedRead {
  const read: FedRead = { targets };
  sink.reads.push(read);
  return read;
}

/** The spec field each instance override carries, as a read's feed names it. */
const OVERRIDDEN_FIELD = {
  fill: "fill",
  strokeColor: "stroke",
  strokeSides: "stroke",
  cornerRadius: "cornerRadius",
  effects: "shadows",
  textColor: "color",
  textAlign: "align",
  glyph: "color",
  primaryAlign: "primaryAlign",
} as const satisfies Record<InstanceOverride["field"], SpecField>;

/** Whether a feed's target is a spec field at a path. */
function fills(feed: FeedTarget, path: readonly string[], field: string): boolean {
  return feed.field === field && isDeepStrictEqual(feed.path, path);
}

/**
 * What the instances do with one read of a composite's declaration: keep its row, with another
 * detail where the instance swaps a glyph to its mirror, leave it unmapped, or drop it as repeating
 * the variant. A row that is no read the instances decide settles `asIs`.
 */
type Decision =
  | { readonly _tag: "asIs" }
  | { readonly _tag: "kept"; readonly row: Row }
  | { readonly _tag: "unmapped"; readonly row: Row }
  | { readonly _tag: "dropped"; readonly row: Row };

/** A read of a composite's declaration, its row as the read gave it, and its decision. */
type DecidedRead = { readonly row: Row; readonly origin: Origin; readonly decision: Decision };

/**
 * Decide a read of a composite's declaration that fills `fed` on the inner root built in place of
 * `visit`, and `placing` on the inner root that holds it, if any. A row the mapper already left
 * unmapped stays so. Where the composite draws the read around the instance, as a frame for its
 * margins, the holding row's alignment for an auto margin or an `align-self`, or the column's
 * paddings for a translate, the read keeps its outcome, bound or literal, unless an inner root built
 * in place draws that, whose diff decides the `placing` fields in turn. Where the read fills a field
 * the instance draws another way than the variant and no instance field carries, it is unmapped with
 * that difference. Where an override, the instance's own sizing or minimum, or a swap to a glyph's
 * half-turn mirror carries the read, the inner root built in place that holds the instance, if any, must carry
 * the instance as a whole, so its diff decides in turn. A read the mirror carries keeps its outcome
 * with a detail that names the mirror. One whose fields the variant draws the same drops.
 */
function decided(row: Row, visit: Visit, fed: readonly FeedTarget[], placing: FedRead | undefined): Decision {
  const [mapped] = visit.mapped;
  if (row.outcome === "unmapped") {
    return { _tag: "unmapped", row };
  }
  if (mapped === undefined || (row.outcome !== "bound" && row.outcome !== "literal")) {
    return { _tag: "asIs" };
  }
  const { holder } = visit;
  const { diff, root } = mapped;
  if (fed.some((feed) => feed.field === "around")) {
    return placing === undefined || holder === undefined
      ? { _tag: "kept", row }
      : decided(row, holder.visit(), placing.targets, undefined);
  }
  const unmapped = diff.unmapped.find((difference) =>
    fed.some((feed) => differs(feed, difference, root, visit.variant.root))
  );
  if (unmapped !== undefined) {
    return {
      _tag: "unmapped",
      row: { ...row, outcome: "unmapped", detail: differenceDetail(visit, unmapped) },
    };
  }
  const mirrored = diff.mirrored.find(({ path }) => fed.some((feed) => fills(feed, path, "rotation")));
  const carried = [
    ...diff.overrides.map((override) => ({ path: override.path, field: OVERRIDDEN_FIELD[override.field] })),
    ...(isDeepStrictEqual(diff.sizing, visit.variant.root.sizing) ? [] : [{ path: [], field: "sizing" }]),
    ...(diff.minWidth === undefined ? [] : [{ path: [], field: "limits" }]),
  ];
  if (
    mirrored !== undefined ||
    fed.some((feed) => carried.some(({ path, field }) => fills(feed, path, field)))
  ) {
    const kept =
      mirrored === undefined
        ? row
        : {
            ...row,
            detail: `the instance swaps the glyph to ${mirrored.icon}, its half-turn mirror, since Figma turns no layer inside an instance (PT)`,
          };
    return holder === undefined
      ? { _tag: "kept", row: kept }
      : decided(kept, holder.visit(), holder.whole.targets, undefined);
  }
  return {
    _tag: "dropped",
    row: {
      ...row,
      outcome: "dropped",
      detail: `the instance's variant ${visit.variant.key} draws the same, so the class repeats it`,
    },
  };
}

/**
 * Whether a feed fills a field a difference names. Where a box's layers differ, the diff compares
 * none of the layers below it, so a feed below that box fills the difference where its own field of
 * the layer at its key path differs, the whole layer for a nested instance. A frame the variant
 * draws the same then says nothing of a frame beside it that the variant lacks.
 */
function differs(
  feed: FeedTarget,
  difference: InstanceDifference,
  inPlace: ComponentRootSpec,
  variant: ComponentRootSpec
): boolean {
  const below =
    difference.field === "layers" &&
    feed.path.length > difference.path.length &&
    difference.path.every((key, index) => feed.path[index] === key);
  return below ? !drawSame(inPlace, variant, feed) : fills(feed, difference.path, difference.field);
}

/**
 * Whether two boxes draw the same for a feed: the feed's field of the layer at its path, the whole
 * nested instance there, or, for `layers`, the kinds and keys of the layers it holds, as the diff
 * compares them. A box that holds no such layer draws nothing.
 */
function drawSame(inPlace: BoxSpec, variant: BoxSpec, feed: FeedTarget): boolean {
  const drawn = (box: BoxSpec) => {
    const layer = layerAt(box, feed.path);
    if (feed.field === "instance" || layer === undefined) {
      return layer;
    }
    if (feed.field === "layers") {
      return "children" in layer ? kindsAndKeys(layer.children) : [];
    }
    return new Map<string, unknown>(Object.entries(layer)).get(feed.field);
  };
  return isDeepStrictEqual(drawn(inPlace), drawn(variant));
}

/**
 * The row each read of a composite's declaration gives, by its read. The reads of one declaration
 * share its origin, its row's names and the captured declarations the row accounts for, so two
 * captured declarations of one class stay apart. A declaration reaches Figma only where the
 * instances carry each of its reads, so its rows follow its worst read: one with an unmapped read
 * gives one unmapped row, at its first read, and one with a read an instance keeps keeps every
 * read's own outcome, so it drops only where every read drops. A read that settles `asIs` gives its
 * row as it is, unless another read of its declaration is unmapped.
 */
function merged(reads: readonly DecidedRead[]): ReadonlyMap<DecidedRead, Row | undefined> {
  const groups = new Map<Origin, Map<string, DecidedRead[]>>();
  for (const read of reads) {
    const byKey = groups.get(read.origin) ?? new Map<string, DecidedRead[]>();
    groups.set(read.origin, byKey);
    const key = JSON.stringify([declarationKey(read.row), read.row.at ?? []]);
    byKey.set(key, [...(byKey.get(key) ?? []), read]);
  }
  return new Map(
    [...groups.values()].flatMap((byKey) =>
      [...byKey.values()].flatMap((group) => {
        const unmapped = group.find((read) => read.decision._tag === "unmapped");
        const keeps = group.some((read) => read.decision._tag === "kept");
        return group.map((read): [DecidedRead, Row | undefined] => {
          const { decision } = read;
          if (unmapped?.decision._tag === "unmapped") {
            return [read, group[0] === read ? unmapped.decision.row : undefined];
          }
          if (decision._tag === "asIs" || (decision._tag === "dropped" && keeps)) {
            return [read, read.row];
          }
          return [read, decision.row];
        });
      })
    )
  );
}

/**
 * Why a difference stays unmapped: the field, the two values, the inner variant, what an instance
 * carries of that field and the fix. The root's alignment along its direction is the one field an
 * instance carries only in some shapes, as `diffInstance` in `instance-diff.ts` says, so its
 * difference names those shapes.
 */
function differenceDetail(visit: Visit, difference: InstanceDifference): string {
  const root = difference.path.length === 0;
  const layer = root ? "the root" : difference.path.join(" / ");
  const carries =
    root && difference.field === "primaryAlign"
      ? "an instance carries its root's alignment only where it fills its parent along the root's direction and no other difference stays unmapped"
      : "an instance carries only property values, paints, solid stroke weights, corners, shadows, text alignments and its own sizing";
  return `${layer} draws ${difference.field} ${difference.inPlace} where the composite holds it and ${difference.variant} in ${visit.variant.key}, and ${carries}, so give ${visit.part.of.name} an axis that draws it, or draw the part as a frame`;
}

/** The property values an instance layer gives the inner set, undefined where none differs from its default. */
function propertiesOf(
  diff: InstanceDiff,
  booleans: Readonly<Record<string, boolean>>
): InstancePropertiesSpec | undefined {
  const text: InstancePropertiesSpec = Object.keys(diff.text).length === 0 ? {} : { text: diff.text };
  const boolean = Object.keys(booleans).length === 0 ? text : { ...text, boolean: booleans };
  const swap = Object.keys(diff.swap).length === 0 ? boolean : { ...boolean, swap: diff.swap };
  const nested = diff.nested.length === 0 ? swap : { ...swap, nested: diff.nested };
  return Object.keys(nested).length === 0 ? undefined : nested;
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
    throw new KitUnmappable({
      message: `${where} gives ${set.name} the ${type} property ${unknown}, which ${set.name} does not define`,
    });
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
 * the inner root's labels and icons in place, leaving the inner definition as it is. The diff then finds them as property values
 * and overrides, or leaves unmapped what they change beside the characters, the icon and its paint.
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
 * An instance part's own property values with the TEXT values an outer composite gives it: those at
 * its key alone join its text, and those below it join the values it gives the instances inside.
 */
function withGiven(
  values: InstanceProperties,
  given: readonly NestedProperties[],
  key: string
): InstanceProperties {
  const at = given.filter(({ path }) => path[0] === key);
  if (at.length === 0) {
    return values;
  }
  const own = at.filter(({ path }) => path.length === 1).map(({ text }) => text);
  const below = at
    .filter(({ path }) => path.length > 1)
    .map(({ path, text }) => ({ path: path.slice(1), text }));
  return {
    ...values,
    text: Object.fromEntries([
      ...Object.entries(values.text ?? {}),
      ...own.flatMap((text) => Object.entries(text)),
    ]),
    nested: [...(values.nested ?? []), ...below],
  };
}

/**
 * Refuse nested TEXT values at a path whose keys do not name an instance part at each level down from
 * the inner definition. The inner set at the path's end refuses a property it does not define.
 *
 * @throws When a key names no instance part of the definition the path has reached.
 */
function checkNested(nested: readonly NestedProperties[], of: ComponentDefinition, where: string): void {
  for (const { path } of nested) {
    let at = of;
    for (const key of path) {
      const part = instancePartsOf(at).find((candidate) => candidate.key === key);
      if (part === undefined) {
        throw new KitUnmappable({
          message: `${where} gives a nested value at ${path.join(" / ")}, and ${at.name} holds no instance part ${key}`,
        });
      }
      at = part.of;
    }
  }
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
      throw new KitUnmappable({
        message: `the instance parts form a cycle, ${holds.join(", ")}, so none of their sets can build first`,
      });
    }
  }
  const order = new Map(definitions.map((definition, index) => [definition.key, index]));
  definitions.forEach((definition, index) => {
    for (const part of instancePartsOf(definition)) {
      const at = order.get(part.of.key);
      if (at === undefined) {
        throw new KitUnmappable({
          message: `${definition.name} holds ${part.of.name} as ${part.key}, whose set the build does not make`,
        });
      }
      if (at > index) {
        throw new KitUnmappable({
          message: `${definition.name} holds ${part.of.name} as ${part.key}, whose set the build makes after it, so list ${part.of.name} first`,
        });
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
