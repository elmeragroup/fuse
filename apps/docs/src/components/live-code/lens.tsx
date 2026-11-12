"use client";

import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";

import { attributeText } from "../../lib/live-code/edits";
import type { FrameEdits, PropValue, SiteEdits } from "../../lib/live-code/edits";
import type { PartSchema } from "../../lib/live-code/schema";

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
type Instance = {
  readonly loc: string;
  readonly part: string;
  readonly schema: PartSchema;
  readonly values: ReadonlyMap<string, PropValue | undefined>;
};

/** Folds the instances of one site into its values: the shared value, or `mixed` where they differ. */
function siteOf(instances: readonly Instance[]): LiveSite | null {
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

const NO_EDITS: SiteEdits = new Map();
const NO_FRAME_EDITS: FrameEdits = new Map();
const NO_SITES: ReadonlyMap<string, LiveSite> = new Map();

/**
 * One demo frame's Live code state: the sites its stage rendered, and the reader's edits.
 *
 * The two are separate snapshots. A part that renders registers its site without re-rendering the
 * other parts, and an edit re-renders only the parts at the edited site, which read their own
 * slice of the edits.
 */
export class LiveCodeStore {
  #edits: FrameEdits = NO_FRAME_EDITS;
  #sites: ReadonlyMap<string, LiveSite> = NO_SITES;
  /** Every mounted instance, by instance id. A site inside a map has several. */
  readonly #instances = new Map<symbol, Instance>();
  readonly #listeners = new Set<() => void>();
  #pending = false;
  /** The last edit, until a commit shows the stage rendered it; a throw before then reverts it. */
  #unsettled: {
    readonly loc: string;
    readonly prop: string;
    readonly previous: PropValue | undefined;
    readonly value: PropValue | undefined;
  } | null = null;
  #notice: string | null = null;
  #generation = 0;

  /** Adds a listener for any change; returns its removal. */
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** The reader's edits, keyed by site `loc`. */
  getEdits = (): FrameEdits => this.#edits;

  /** The rendered sites, keyed by `loc`. */
  getSites = (): ReadonlyMap<string, LiveSite> => this.#sites;

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

  /** Registrations land during commit; one microtask folds a whole commit into one update. */
  #publishSites(): void {
    if (this.#pending) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      const byLoc = Map.groupBy(this.#instances.values(), (instance) => instance.loc);
      this.#sites = new Map(
        [...byLoc].flatMap(([loc, instances]) => {
          const site = siteOf(instances);
          return site === null ? [] : [[loc, site] as const];
        })
      );
      this.#notify();
    });
  }

  /** Records what an instance renders, replacing what it recorded before. */
  register(instance: symbol, rendered: Instance): void {
    this.#instances.set(instance, rendered);
    this.#publishSites();
  }

  /** Forgets an unmounted instance. */
  unregister(instance: symbol): void {
    if (this.#instances.delete(instance)) this.#publishSites();
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

/** The frame's store, or `null` outside a Live code frame. */
export const LiveCodeContext = createContext<LiveCodeStore | null>(null);

/**
 * Shares a frame's store with the lensed parts of its stage and with its Code view.
 *
 * @param props - The frame's store, and the stage and Code view under it.
 * @returns The provider.
 */
export function LiveCodeProvider({
  store,
  children,
}: {
  store: LiveCodeStore;
  children: ReactNode;
}): ReactElement {
  return <LiveCodeContext value={store}>{children}</LiveCodeContext>;
}

const noSubscription = (): (() => void) => () => undefined;

/** The prop the loader stamps on each lensed site: its `line:column`. */
export type LensSite = { readonly __lensLoc?: string };

/** The settable values a part renders with, read off its props: a listed option or a boolean. */
function settableValues<P extends object>(
  props: P,
  schema: PartSchema
): ReadonlyMap<string, PropValue | undefined> {
  const given = new Map<string, unknown>(Object.entries(props));
  return new Map(
    schema.map((spec) => {
      const raw = given.get(spec.name);
      const value =
        spec.kind === "boolean"
          ? [true, false].find((option) => option === raw)
          : spec.values.find((option) => option === raw);
      return [spec.name, value];
    })
  );
}

/** One value as a key segment; `encode` and `decode` round-trip a schema's values. */
function encode(value: PropValue | undefined): string {
  if (value === undefined) return "u";
  if (value === true) return "t";
  if (value === false) return "f";
  return `s${value}`;
}

function decode(segment: string): PropValue | undefined {
  if (segment === "t") return true;
  if (segment === "f") return false;
  return segment.startsWith("s") ? segment.slice(1) : undefined;
}

/** Separates the key's segments; no option a schema lists contains it. */
const SEPARATOR = "\u0000";

/**
 * The one wrapper the Live code loader binds each settable Fuse part of a demo through, such as
 * `Button` or `Select.Trigger`. The wrapper reads its site's edits from the frame's store and lays
 * them over the demo's own props. It records the values it renders each settable prop with, so
 * the Code view shows the stage's state, expressions included. Outside a `LiveCodeProvider` it
 * renders the part with the demo's props alone.
 *
 * @param Part - The imported part.
 * @param part - Its API name, such as `Select.Trigger`.
 * @param schema - Its settable props, from its `api.json`.
 * @returns The component the demo renders in the part's place.
 */
export function lens<P extends object>(
  Part: ComponentType<P>,
  part: string,
  schema: PartSchema
): ComponentType<P & LensSite> {
  function Lensed({ __lensLoc: loc = "", ...props }: P & LensSite): ReactElement {
    const store = useContext(LiveCodeContext);
    // A token of this instance's own. `useId` would do, but calling it shifts the ids every part
    // below generates, so a lensed demo would no longer render what the original renders.
    const [instance] = useState(() => Symbol(part));
    // The server reads the same snapshot: a store there holds no edits, unless a caller set some.
    const readEdits = (): SiteEdits => store?.editsAt(loc) ?? NO_EDITS;
    const edits = useSyncExternalStore(store?.subscribe ?? noSubscription, readEdits, readEdits);
    // SAFETY: the demo's own props are `P` less the stamp, and each edit sets a prop of `P` to one
    // of the values its api.json lists for it.
    const merged = { ...props, ...Object.fromEntries(edits) } as P;
    // A string key, so the record updates only when a value changes.
    const key = [...settableValues(merged, schema).values()].map(encode).join(SEPARATOR);
    useLayoutEffect(() => {
      if (store === null || loc === "") return;
      const segments = key.split(SEPARATOR);
      const values = new Map(schema.map((spec, index) => [spec.name, decode(segments[index] ?? "u")]));
      store.register(instance, { loc, part, schema, values });
      // The commit succeeded, so the stage renders the edits it was given.
      store.settle();
      return () => store.unregister(instance);
    }, [store, instance, loc, key]);
    return <Part {...merged} />;
  }
  Lensed.displayName = `Lens(${part})`;
  return Lensed;
}

/** The keys React keeps on a memo or forwardRef component, which a wrapper must not take over. */
const COMPONENT_KEYS: ReadonlySet<string> = new Set(["$$typeof", "type", "render", "compare", "displayName"]);

/**
 * A namespace, or a part that carries parts such as `RadioItem.Title`, with some members
 * replaced by their wrappers. The loader binds through it so the original keeps every other
 * member, and a callable original stays callable.
 *
 * @param original - The imported value.
 * @param self - The value standing for the original itself: its wrapper, or the original.
 * @param members - The wrapped members, by name.
 * @returns The value the demo binds in place of the import.
 */
export function lensMembers<T extends object>(original: T, self: T, members: Partial<T>): T {
  const parts = Object.fromEntries(Object.entries(original).filter(([key]) => !COMPONENT_KEYS.has(key)));
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- module boundary: the loader passes whatever the Fuse entry exports
  const callable = typeof original === "function" || "$$typeof" in original;
  // A plain namespace becomes a fresh object. A component takes its members on its wrapper, or on
  // a pass-through wrapper of its own, so the original, which other modules share, never changes.
  // SAFETY: `callable` holds, so `original` is a function or memo/forwardRef component.
  const host = !callable ? {} : self === original ? lens(original as ComponentType<object>, "", []) : self;
  // SAFETY: the host carries every member of `original` but React's own keys, some replaced by wrappers
  // that accept the same props, and is callable exactly when `original` is.
  return Object.assign(host, parts, members) as T;
}
