"use client";

import { createContext, useContext, useLayoutEffect, useState, useSyncExternalStore } from "react";
import type { ComponentType, ReactElement } from "react";

import type { PropValue, SiteEdits } from "../../lib/live-code/edits";
import type { PartSchema } from "../../lib/live-code/schema";
import type { LiveCodeStore } from "../../lib/live-code/store";

const NO_EDITS: SiteEdits = new Map();

/** The frame's store, or `null` outside a Live code frame. */
export const LiveCodeContext = createContext<LiveCodeStore | null>(null);

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

/**
 * The one wrapper the Live code loader binds each settable Fuse part of a demo through, such as
 * `Button` or `Select.Trigger`. The wrapper reads its site's edits from the frame's store and lays
 * them over the demo's own props. It records the values it renders each settable prop with, so
 * the Code view shows the stage's state, expressions included. Outside a `LiveCodeContext` it
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
    const values = settableValues(merged, schema);
    // Every commit records what this instance rendered, which the store ignores when nothing
    // changed, and settles the last edit: the commit shows the stage rendered it, even when the
    // edit set the value the site already had.
    useLayoutEffect(() => {
      if (store === null || loc === "") return;
      store.register(instance, { loc, part, schema, values });
      store.settle();
    });
    useLayoutEffect(() => {
      if (store === null) return;
      return () => store.unregister(instance);
    }, [store, instance]);
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
