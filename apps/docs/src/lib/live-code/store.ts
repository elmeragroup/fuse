import { attributeText } from "./edits";
import type { FrameEdits, PropValue, SiteEdits } from "./edits";
import type { PartSchema } from "./schema";

/** What a site renders one settable prop with: one value across its instances, or several. */
export type SiteValue =
  | { readonly kind: "one"; readonly value: PropValue | undefined }
  | { readonly kind: "mixed" };

/**
 * One rendered site: the part written there, the props the Code view can set on it, and the
 * values its instances render those props with, edits included.
 */
export type LiveSite = {
  readonly part: string;
  readonly schema: PartSchema;
  readonly values: ReadonlyMap<string, SiteValue>;
};

/** One mounted instance of a lensed part, and the settable values it rendered with. */
export type LensInstance = {
  readonly loc: string;
  readonly part: string;
  readonly schema: PartSchema;
  readonly values: ReadonlyMap<string, PropValue | undefined>;
};

/** Folds the instances of one site into its values: the shared value, or `mixed` where they differ. */
function siteOf(instances: readonly LensInstance[]): LiveSite | null {
  const [first] = instances;
  if (first === undefined) return null;
  const values = new Map<string, SiteValue>();
  for (const spec of first.schema) {
    const seen = new Set(instances.map((instance) => instance.values.get(spec.name)));
    const [only] = seen;
    values.set(spec.name, seen.size === 1 ? { kind: "one", value: only } : { kind: "mixed" });
  }
  return { part: first.part, schema: first.schema, values };
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

const NO_EDITS: SiteEdits = new Map();
const NO_FRAME_EDITS: FrameEdits = new Map();

/**
 * One demo frame's Live code state: the sites its stage rendered, and the reader's edits.
 *
 * The two are separate snapshots with separate listeners. A part that renders registers its
 * instance without re-rendering the other parts, and the sites are folded from the instances only
 * when the Code view reads them, so a stage nobody opened the code of never regroups. An edit
 * re-renders only the parts at the edited site, which read their own slice of the edits.
 */
export class LiveCodeStore {
  #edits: FrameEdits = NO_FRAME_EDITS;
  /** The folded sites, or `null` once an instance changed since the last fold. */
  #sites: ReadonlyMap<string, LiveSite> | null = null;
  /** Every mounted instance, by instance id. A site inside a map has several. */
  readonly #instances = new Map<symbol, LensInstance>();
  readonly #listeners = new Set<() => void>();
  readonly #siteListeners = new Set<() => void>();
  #sitesPending = false;
  /** The last edit, until a commit shows the stage rendered it; a throw before then reverts it. */
  #unsettled: {
    readonly loc: string;
    readonly prop: string;
    readonly previous: PropValue | undefined;
    readonly value: PropValue | undefined;
  } | null = null;
  #notice: string | null = null;
  #generation = 0;

  /** Adds a listener for edits, the notice and resets; returns its removal. */
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

  /** The reader's edits, keyed by site `loc`. */
  getEdits = (): FrameEdits => this.#edits;

  /** The rendered sites, keyed by `loc`; the same object until an instance changes. */
  getSites = (): ReadonlyMap<string, LiveSite> => {
    this.#sites ??= new Map(
      [...Map.groupBy(this.#instances.values(), (instance) => instance.loc)].flatMap(([loc, instances]) => {
        const site = siteOf(instances);
        return site === null ? [] : [[loc, site] as const];
      })
    );
    return this.#sites;
  };

  /** What the last rejected edit was, such as `granularity="hour" doesn't render in this example`. */
  getNotice = (): string | null => this.#notice;

  /** Counts resets, so the frame can remount its stage and drop any error it latched. */
  getGeneration = (): number => this.#generation;

  /** Whether the last edit has not committed yet, so a throw now is its doing. */
  hasUnsettled(): boolean {
    return this.#unsettled !== null;
  }

  /** Records that the stage committed with the edits, so a later throw is not the last edit's. */
  settle(): void {
    this.#unsettled = null;
  }

  /**
   * Reverts the last edit when the stage threw before rendering it, and records a notice naming
   * the rejected value.
   *
   * @returns Whether there was an edit to revert. Without one, the throw is the demo's own.
   */
  rejectUnsettled(): boolean {
    const unsettled = this.#unsettled;
    if (unsettled === null) return false;
    this.#unsettled = null;
    this.#write(unsettled.loc, unsettled.prop, unsettled.previous);
    this.#notice =
      unsettled.value === undefined
        ? `Clearing ${unsettled.prop} doesn't render in this example.`
        : `${attributeText(unsettled.prop, unsettled.value)} doesn't render in this example.`;
    this.#notify();
    return true;
  }

  /** One site's edits; the same object until that site changes. */
  editsAt(loc: string): SiteEdits {
    return this.#edits.get(loc) ?? NO_EDITS;
  }

  #notify(): void {
    for (const listener of this.#listeners) listener();
  }

  /**
   * Marks the sites stale. Registrations land during commit, so one microtask tells the site
   * listeners once per commit; with none listening, the next read folds them.
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

  /** Records what an instance renders, replacing what it recorded before; an equal record is a no-op. */
  register(instance: symbol, rendered: LensInstance): void {
    if (sameInstance(this.#instances.get(instance), rendered)) return;
    this.#instances.set(instance, rendered);
    this.#invalidateSites();
  }

  /** Forgets an unmounted instance. */
  unregister(instance: symbol): void {
    if (this.#instances.delete(instance)) this.#invalidateSites();
  }

  /**
   * Sets one prop at one site, or clears the edit with `undefined`.
   *
   * @param loc - The site's `loc`.
   * @param prop - The prop name.
   * @param value - The value, or `undefined` to drop the edit.
   */
  set(loc: string, prop: string, value: PropValue | undefined): void {
    this.#unsettled = { loc, prop, previous: this.editsAt(loc).get(prop), value };
    this.#notice = null;
    this.#write(loc, prop, value);
    this.#notify();
  }

  #write(loc: string, prop: string, value: PropValue | undefined): void {
    const site = new Map(this.editsAt(loc));
    if (value === undefined) site.delete(prop);
    else site.set(prop, value);
    const edits = new Map(this.#edits);
    if (site.size === 0) edits.delete(loc);
    else edits.set(loc, site);
    this.#edits = edits;
  }

  /** Drops every edit and any notice, and counts a reset so the stage remounts. */
  reset(): void {
    this.#edits = NO_FRAME_EDITS;
    this.#unsettled = null;
    this.#notice = null;
    this.#generation += 1;
    this.#notify();
  }
}
