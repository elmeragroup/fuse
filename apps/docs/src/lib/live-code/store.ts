import { attributeText } from "./edits";
import type { FrameEdits, PropValue, SiteEdits } from "./edits";
import type { PartSchema } from "./schema";

/** What a site renders one settable prop with: one value across its instances, or several. */
export type SiteValue =
  | { readonly kind: "one"; readonly value: PropValue | undefined }
  | { readonly kind: "mixed" };

/** One mounted instance of a lensed part, as it registers on each commit. */
type LensInstance = {
  readonly loc: string;
  readonly part: string;
  readonly schema: PartSchema;
  /** The settable values the demo's own props give the instance, before any edit. */
  readonly values: ReadonlyMap<string, PropValue | undefined>;
};

/**
 * One site the stage rendered: the part written there, the props the stage editor can set on it,
 * the values it renders them with, and the elements its mounted instances put their `ref` on, in
 * mount order. The values are the
 * site's baseline, what its instances render with before any edit, with the committed edits laid
 * over it. A site whose instances all unmounted, such as an item of a closed menu, stays with the
 * baseline they last rendered and no instances, so its props stay editable and an edit applies
 * when it renders again.
 */
export type LiveSite = {
  readonly loc: string;
  readonly part: string;
  readonly schema: PartSchema;
  readonly values: ReadonlyMap<string, SiteValue>;
  readonly elements: readonly Element[];
};

/** A value the stage shows for one prop of one site without committing it. */
export type Preview = { readonly loc: string; readonly prop: string; readonly value: PropValue };

/**
 * What the store keeps of one site whatever its instances do. It holds no element, so a site whose
 * instances unmounted keeps no detached DOM alive.
 */
type SiteRecord = {
  readonly part: string;
  readonly schema: PartSchema;
  /** The unedited values, folded over the instances mounted when one last registered or left. */
  readonly baseline: ReadonlyMap<string, SiteValue>;
};

/** Folds instances' values into one per prop, or `mixed` where they differ. */
function foldValues(schema: PartSchema, instances: readonly LensInstance[]): ReadonlyMap<string, SiteValue> {
  return new Map(
    schema.map((spec) => {
      const seen = new Set(instances.map((instance) => instance.values.get(spec.name)));
      const [only] = seen;
      return [spec.name, seen.size === 1 ? { kind: "one", value: only } : { kind: "mixed" }] as const;
    })
  );
}

/** A site's values: its baseline with its committed edits laid over it. */
function effectiveValues(record: SiteRecord, edits: SiteEdits | undefined): ReadonlyMap<string, SiteValue> {
  return new Map(
    record.schema.map((spec) => {
      const edited = edits?.get(spec.name);
      const value: SiteValue =
        edited === undefined
          ? (record.baseline.get(spec.name) ?? { kind: "one", value: undefined })
          : { kind: "one", value: edited };
      return [spec.name, value] as const;
    })
  );
}

/** Whether an instance records what it recorded before, so registering it again changes nothing. */
function sameInstance(held: LensInstance | undefined, next: LensInstance): boolean {
  if (held === undefined) return false;
  if (held.loc !== next.loc || held.part !== next.part || held.schema !== next.schema) return false;
  if (held.values.size !== next.values.size) return false;
  for (const [name, value] of next.values) {
    if (!held.values.has(name) || held.values.get(name) !== value) return false;
  }
  return true;
}

/** What the stage has not yet committed: the last edit or the shown preview. A throw reverts it. */
type Unsettled =
  | {
      readonly kind: "edit";
      readonly loc: string;
      readonly prop: string;
      readonly previous: PropValue | undefined;
      readonly value: PropValue;
    }
  | { readonly kind: "preview"; readonly prop: string; readonly value: PropValue };

const NO_EDITS: SiteEdits = new Map();
const NO_FRAME_EDITS: FrameEdits = new Map();

/**
 * One demo frame's Live code state: the sites its stage rendered, the reader's committed edits,
 * and the one value the stage editor previews.
 *
 * The sites and the edits are separate snapshots with separate listeners. A part that renders
 * registers its instance without re-rendering the other parts, and the store keeps a record of
 * each site as instances register and leave. `getSites` projects the records, the mounted
 * instances and the edits only when the stage editor reads them. An edit or a preview re-renders
 * only the parts at its site, which read their own slice.
 */
export class LiveCodeStore {
  #edits: FrameEdits = NO_FRAME_EDITS;
  #preview: Preview | null = null;
  /** The projected sites, or `null` once a record, an instance, an element or an edit changed. */
  #sites: ReadonlyMap<string, LiveSite> | null = null;
  /** Every site that has registered, by `loc`, in first-registration order. */
  readonly #records = new Map<string, SiteRecord>();
  /** Every mounted instance, by instance id. A site inside a map has several. */
  readonly #instances = new Map<symbol, LensInstance>();
  /**
   * The element each instance's part put its `ref` on. React attaches refs before the layout
   * effects that register, so the two arrive apart.
   */
  readonly #elements = new Map<symbol, Element>();
  readonly #listeners = new Set<() => void>();
  readonly #siteListeners = new Set<() => void>();
  #sitesPending = false;
  /** The last edit or the preview, until a commit shows the stage rendered it. */
  #unsettled: Unsettled | null = null;
  #notice: string | null = null;
  #generation = 0;

  /** Adds a listener for edits, the preview, the notice and resets; returns its removal. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Adds a listener for the rendered sites; returns its removal. */
  subscribeSites = (listener: () => void): (() => void) => {
    this.#siteListeners.add(listener);
    return () => {
      this.#siteListeners.delete(listener);
    };
  };

  /** The reader's committed edits, keyed by site `loc`. */
  getEdits = (): FrameEdits => this.#edits;

  /** The sites the stage rendered, keyed by `loc`; the same object until one of them changes. */
  getSites = (): ReadonlyMap<string, LiveSite> => {
    if (this.#sites !== null) return this.#sites;
    const mounted = Map.groupBy(this.#instances, ([, instance]) => instance.loc);
    this.#sites = new Map(
      [...this.#records].map(([loc, record]) => [
        loc,
        {
          loc,
          part: record.part,
          schema: record.schema,
          values: effectiveValues(record, this.#edits.get(loc)),
          elements: (mounted.get(loc) ?? []).flatMap(([id]) => {
            const element = this.#elements.get(id);
            return element === undefined ? [] : [element];
          }),
        },
      ])
    );
    return this.#sites;
  };

  /** What the last rejected edit or preview was, such as `granularity="hour" doesn't render in this example.` */
  getNotice = (): string | null => this.#notice;

  /** Counts resets, so the frame can remount its stage and drop any error it latched. */
  getGeneration = (): number => this.#generation;

  /** Whether the last edit or the preview has not committed yet, so a throw now is its doing. */
  hasUnsettled(): boolean {
    return this.#unsettled !== null;
  }

  /** Records that the stage committed with the edits, so a later throw is not the last edit's. */
  settle(): void {
    this.#unsettled = null;
  }

  /**
   * Reverts the last edit, or drops the preview, when the stage threw before rendering it, and
   * records a notice naming the rejected value.
   *
   * @returns Whether there was a value to revert. Without one, the throw is the demo's own.
   */
  rejectUnsettled(): boolean {
    const unsettled = this.#unsettled;
    if (unsettled === null) return false;
    this.#unsettled = null;
    if (unsettled.kind === "edit") this.#write(unsettled.loc, unsettled.prop, unsettled.previous);
    else this.#preview = null;
    this.#notice = `${attributeText(unsettled.prop, unsettled.value)} doesn't render in this example.`;
    this.#notify();
    return true;
  }

  /** One site's committed edits; the same object until that site changes. */
  editsAt(loc: string): SiteEdits {
    return this.#edits.get(loc) ?? NO_EDITS;
  }

  /** The preview when it is at `loc`, else `null`; the same object until the preview changes. */
  previewAt(loc: string): Preview | null {
    return this.#preview?.loc === loc ? this.#preview : null;
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }

  /**
   * Marks the sites stale. Registrations land during commit, so one microtask tells the site
   * listeners once per commit; with none listening, the next read projects them.
   */
  #invalidateSites(): void {
    this.#sites = null;
    if (this.#sitesPending || this.#siteListeners.size === 0) return;
    this.#sitesPending = true;
    queueMicrotask(() => {
      this.#sitesPending = false;
      for (const listener of this.#siteListeners) listener();
    });
  }

  /** The instances of one site mounted now. */
  #mountedAt(loc: string): readonly LensInstance[] {
    return [...this.#instances.values()].filter((instance) => instance.loc === loc);
  }

  /**
   * Records what an instance renders, replacing what it recorded before, and its site's record: its
   * baseline over the mounted instances. An equal record is a no-op.
   */
  register(instance: symbol, rendered: LensInstance): void {
    if (sameInstance(this.#instances.get(instance), rendered)) return;
    this.#instances.set(instance, rendered);
    this.#records.set(rendered.loc, {
      part: rendered.part,
      schema: rendered.schema,
      baseline: foldValues(rendered.schema, this.#mountedAt(rendered.loc)),
    });
    this.#invalidateSites();
  }

  /**
   * Records the element an instance's part renders, or that it renders none any more.
   *
   * @param instance - The instance's id.
   * @param element - The element its ref received, or `null` once the ref let it go.
   */
  attach(instance: symbol, element: Element | null): void {
    if ((this.#elements.get(instance) ?? null) === element) return;
    if (element === null) this.#elements.delete(instance);
    else this.#elements.set(instance, element);
    if (this.#instances.has(instance)) this.#invalidateSites();
  }

  /**
   * Forgets an unmounted instance. Its site's record stays; with other instances still mounted,
   * its baseline folds over them, and with none, it keeps the baseline they last rendered.
   */
  unregister(instance: symbol): void {
    this.#elements.delete(instance);
    const held = this.#instances.get(instance);
    if (held === undefined) return;
    this.#instances.delete(instance);
    const record = this.#records.get(held.loc);
    const remaining = this.#mountedAt(held.loc);
    if (record !== undefined && remaining.length > 0) {
      this.#records.set(held.loc, { ...record, baseline: foldValues(record.schema, remaining) });
    }
    this.#invalidateSites();
  }

  /**
   * Commits one prop at one site in one step: the edit is written, a preview at the site gives way
   * to it, the edit becomes the one a throw reverts, and listeners hear one change.
   *
   * @param loc - The site's `loc`.
   * @param prop - The prop name.
   * @param value - The value.
   */
  set(loc: string, prop: string, value: PropValue): void {
    this.#unsettled = { kind: "edit", loc, prop, previous: this.editsAt(loc).get(prop), value };
    this.#notice = null;
    if (this.#preview?.loc === loc) this.#preview = null;
    this.#write(loc, prop, value);
    this.#notify();
  }

  /**
   * Shows a value on the stage without committing it, or drops the preview with `null`. Copy, the
   * Code view and the editor's own rows keep the committed edits.
   *
   * @param next - The value to show, or `null`.
   */
  preview(next: Preview | null): void {
    const held = this.#preview;
    if (held === next) return;
    const same = held !== null && next !== null && held.loc === next.loc && held.prop === next.prop;
    if (same && held.value === next.value) return;
    this.#preview = next;
    this.#unsettled = next === null ? null : { kind: "preview", prop: next.prop, value: next.value };
    this.#notify();
  }

  /**
   * Drops every edit, as the stage editor's Reset does, and keeps the stage mounted. The demo's
   * own source renders, so nothing is left to settle.
   */
  clear(): void {
    if (this.#edits.size === 0) return;
    this.#edits = NO_FRAME_EDITS;
    this.#invalidateSites();
    this.#unsettled = null;
    this.#notice = null;
    this.#notify();
  }

  /** Writes one prop's edit; `undefined` drops it, as rolling back to a prop with no edit does. */
  #write(loc: string, prop: string, value: PropValue | undefined): void {
    const site = new Map(this.editsAt(loc));
    if (value === undefined) site.delete(prop);
    else site.set(prop, value);
    const edits = new Map(this.#edits);
    if (site.size === 0) edits.delete(loc);
    else edits.set(loc, site);
    this.#edits = edits;
    this.#invalidateSites();
  }

  /** Drops every edit, the preview and any notice, and counts a reset so the stage remounts. */
  reset(): void {
    this.#edits = NO_FRAME_EDITS;
    this.#invalidateSites();
    this.#preview = null;
    this.#unsettled = null;
    this.#notice = null;
    this.#generation += 1;
    this.#notify();
  }
}
