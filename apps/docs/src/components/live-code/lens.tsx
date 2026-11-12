"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ComponentType, ReactElement, Ref, RefCallback } from "react";

import { useRender } from "@base-ui/react/use-render";

import type { PropValue, SiteEdits } from "../../lib/live-code/edits";
import type { PartSchema } from "../../lib/live-code/schema";
import type { LiveCodeStore, Preview } from "../../lib/live-code/store";

const NO_EDITS: SiteEdits = new Map();

/** The frame's store, or `null` outside a Live code frame. */
export const LiveCodeContext = createContext<LiveCodeStore | null>(null);

const noSubscription = (): (() => void) => () => undefined;

/** The prop the loader stamps on each lensed site: its `line:column`. */
type LensSite = { readonly __lensLoc?: string };

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
 * `Button` or `Select.Trigger`. The wrapper reads its site's committed edits and the editor's
 * preview from the frame's store and lays them over the demo's own props. It records the values
 * the demo's own props give each settable prop, expressions included, which the store keeps as the
 * site's baseline, and the element the part puts its `ref` on, which the stage editor outlines.
 * Outside a `LiveCodeContext` it renders the part with the demo's props alone.
 *
 * The ref never reaches the markup, so a lensed demo renders exactly what the original renders (`test/live-code-transparency.test.ts`).
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
  function Lensed({ __lensLoc: loc = "", ...rest }: P & LensSite): ReactElement {
    const store = useContext(LiveCodeContext);
    // A token of this instance's own. `useId` would do, but calling it shifts the ids every part
    // below generates, so a lensed demo would no longer render what the original renders.
    const [instance] = useState(() => Symbol(part));
    // The server reads the same snapshots: a store there holds no edits, unless a caller set some.
    const readEdits = (): SiteEdits => store?.editsAt(loc) ?? NO_EDITS;
    const readPreview = (): Preview | null => store?.previewAt(loc) ?? null;
    const subscribe = store?.subscribe ?? noSubscription;
    const edits = useSyncExternalStore(subscribe, readEdits, readEdits);
    const preview = useSyncExternalStore(subscribe, readPreview, readPreview);
    // SAFETY: React 19 passes `ref` as a prop; a part's ref, when it takes one, is an element's.
    const { ref: demoRef, ...props } = rest as typeof rest & { readonly ref?: Ref<Element> };
    const tracked = store !== null && loc !== "";
    // The part's element, recorded for the editor. Base UI's `useRender` merges it with the demo's
    // own ref, which keeps getting the element as before.
    const recordElement = useCallback<RefCallback<Element>>(
      (node) => {
        // React 19 calls the returned cleanup rather than the callback with `null`.
        if (node === null) return undefined;
        store?.attach(instance, node);
        return () => store?.attach(instance, null);
      },
      [store, instance]
    );
    // SAFETY: the demo's own props are `P` less the stamp, and each edit sets a prop of `P` to one
    // of the values its api.json lists for it.
    const committed = { ...props, ...Object.fromEntries(edits) } as P;
    // The store keeps the demo's own values as the site's baseline and lays the edits over them.
    const values = settableValues(props, schema);
    // Every commit records what this instance rendered, which the store ignores when nothing
    // changed, and settles the last edit: the commit shows the stage rendered it, even when the
    // edit set the value the site already had.
    useLayoutEffect(() => {
      if (!tracked) return;
      store.register(instance, { loc, part, schema, values });
      store.settle();
    });
    useLayoutEffect(() => {
      if (store === null) return;
      return () => store.unregister(instance);
    }, [store, instance]);
    // The editor's preview shows over the committed edits, and is never recorded as a value.
    const shown = new Map(Object.entries(committed));
    if (preview !== null) shown.set(preview.prop, preview.value);
    // SAFETY: as above; the preview sets one prop of `P` to a value its api.json lists.
    const rendered = Object.fromEntries(shown) as P;
    return useRender({
      render: <Part {...rendered} />,
      // Outside a frame, or as a namespace's pass-through, the part keeps the demo's ref alone.
      ref: tracked ? [demoRef ?? null, recordElement] : demoRef,
    });
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
