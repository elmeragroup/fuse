"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useLocalizedStrings } from "../../hooks/use-localized-strings";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { windowOf } from "../../internal/dom-node";
import { cn } from "../../styles/cn";
import { skeletonRevealStrings } from "./intl";
import { SkeletonPane } from "./skeleton-pane";
import { PaneExclusion } from "./skeleton-reveal-exclusion";
import { RevealMotion } from "./skeleton-reveal-motion";
import type { PaneKind } from "./skeleton-reveal-motion";
import { INPUT_WINDOW_MS } from "./skeleton-reveal-plan";
import type { SkeletonRevealMode } from "./skeleton-reveal-plan";

/** Props every form of `SkeletonReveal` takes. */
export type SkeletonRevealSharedProps = Omit<useRender.ComponentProps<"div">, "children"> & {
  /**
   * How content replaces the skeleton. `smart`, the default, holds a client skeleton back 150 ms
   * so a fast load never shows one, lands content at once over a skeleton that was up only a
   * moment or while someone scrolls or types, crossfades a refetch and small content, and brings
   * larger content in row by row. `together` crossfades it all at once; `sequence` brings each
   * piece in by its place, top to bottom and then a little left to right.
   */
  reveal?: SkeletonRevealMode;
  /**
   * Read to screen readers while loading, in place of the skeleton, such as "Loading invoices".
   * Defaults to the locale dictionary's "Loading".
   */
  label?: string;
  /**
   * Called once content has come in over a skeleton and finished arriving. A reveal interrupted by
   * loading again, or by unmounting, does not call it. One that Suspense or a hidden `Activity`
   * interrupted, or that came due while hidden, finishes at once when the reveal shows again and
   * calls it then; one that a later load replaced while hidden does not.
   */
  onReveal?: () => void;
};

/** `SkeletonReveal` around plain children, which draw their own skeleton while `loading`. */
export type SkeletonRevealChildrenProps = SkeletonRevealSharedProps & {
  /** Shows the skeleton drawn from `children` instead of `children` themselves. */
  loading: boolean;
  /** The content, which is also what the skeleton is drawn from. */
  children: ReactNode;
  data?: never;
  sample?: never;
};

/**
 * `SkeletonReveal` around data: `children` renders it, and the skeleton is drawn from that render
 * of the data on screen, the last data shown or `sample`.
 *
 * @template T - The data the children render.
 */
export type SkeletonRevealDataProps<T> = SkeletonRevealSharedProps & {
  /** The data to show. The skeleton shows while it is `null` or `undefined`. */
  data: T | null | undefined;
  /** Stands in for `data` to draw the skeleton before any data has loaded. */
  sample?: T;
  /** Shows the skeleton over `data` too, as for a refetch. It is drawn from the data on screen. */
  loading?: boolean;
  /** Renders the data, or the sample the skeleton is drawn from. */
  children: (data: T) => ReactNode;
};

/**
 * Props for `SkeletonReveal`: plain children with `loading`, or `data` with a render function.
 *
 * @template T - The data the children render, in the data form.
 */
export type SkeletonRevealProps<T = unknown> = SkeletonRevealChildrenProps | SkeletonRevealDataProps<T>;

/** Which pane a reveal shows, what it renders, and what the planner needs to know of it. */
type PaneView<T> = {
  readonly kind: PaneKind;
  readonly node: ReactNode;
  /** Whether a skeleton is drawn over the data on screen. */
  readonly refetch: boolean;
  /** The data a content pane shows, kept so a reload's skeleton has its exact shape. */
  readonly shown: { readonly value: T } | null;
};

/** A pane that has stopped being current: it keeps the node it last rendered while it leaves. */
type LeavingPane = {
  readonly id: number;
  readonly kind: PaneKind;
  readonly node: ReactNode;
  readonly refetch: boolean;
};

type RevealState<T> = {
  readonly current: {
    readonly id: number;
    readonly kind: PaneKind;
    /**
     * Whether this content pane replaced a skeleton, decided when the pane is created: the reveal
     * owes `onReveal` once for it, whatever the effects saw of the panes in between.
     */
    readonly overSkeleton: boolean;
  };
  readonly exiting: readonly LeavingPane[];
  /** The last data shown, so a reload's skeleton has its exact shape. */
  readonly last: { readonly value: T } | null;
};

function isDataForm<T>(props: SkeletonRevealProps<T>): props is SkeletonRevealDataProps<T> {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the two prop forms differ only in whether children is a render function
  return typeof props.children === "function";
}

/** Three lines of text, for a skeleton with no data, last data or sample to draw from. */
const FALLBACK_LINES = (
  <div className="flex flex-col gap-2 py-1">
    <div data-skeleton="block" className="h-3 w-full rounded-md" />
    <div data-skeleton="block" className="h-3 w-11/12 rounded-md" />
    <div data-skeleton="block" className="h-3 w-3/5 rounded-md" />
  </div>
);

/** The dictionary's "Loading", read only without a `label`, so a labelled reveal needs no LocaleProvider. */
function DefaultLabel(): ReactNode {
  return useLocalizedStrings(skeletonRevealStrings).format("loading");
}

const subscribeNothing = (): (() => void) => () => undefined;

/** True while rendering on the server and hydrating its markup; false for a client render. */
function useServerRendered(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => false,
    () => true
  );
}

/**
 * The pane the props ask for, rendered: the content, or a skeleton drawn from the data on screen,
 * the last data shown, the sample or the plain children.
 */
function viewOf<T>(props: SkeletonRevealProps<T>, last: RevealState<T>["last"]): PaneView<T> {
  if (!isDataForm(props)) {
    return {
      kind: props.loading ? "skeleton" : "content",
      node: props.children,
      refetch: false,
      shown: null,
    };
  }
  const { data } = props;
  if (data !== null && data !== undefined) {
    const node = props.children(data);
    return props.loading === true
      ? { kind: "skeleton", node, refetch: true, shown: null }
      : { kind: "content", node, refetch: false, shown: { value: data } };
  }
  const standIn = last === null ? props.sample : last.value;
  return {
    kind: "skeleton",
    node: standIn === undefined ? FALLBACK_LINES : props.children(standIn),
    refetch: false,
    shown: null,
  };
}

/**
 * Draws a loading skeleton from the real content and reveals the content over it. While loading,
 * the content renders unseen with sample data, the last data shown or the data on screen, and a
 * layer of bones is measured from it: one bar per line of text and one block per control, avatar,
 * badge or media part. The skeleton takes exactly the content's space, so callers keep no second
 * copy of the layout. When the content arrives, `reveal` decides how it replaces the skeleton, and
 * the root eases its height when the content differs in size from its skeleton.
 *
 * The root is a `div` with `aria-busy` while loading and a visually hidden `label`; the skeleton is
 * hidden from assistive tech and inert, and the content is reachable only once it replaces the
 * skeleton. Form controls in the skeleton, or in content on its way out, are neither submitted
 * nor validated with their form, though they show the form's errors. Fuse overlays there open
 * nothing: no popup, focus trap or scroll lock. A portal of your own in the content, outside Fuse's
 * overlays, is yours to keep closed while the skeleton draws from it. Before hydration, or without
 * JavaScript, the skeleton paints text as thick strike-through bars, and covers media, until its
 * bones are measured. Mark consumer markup with `data-skeleton="block"` to draw it as one block, or
 * `data-skeleton="ignore"` to leave it and everything inside it out.
 *
 * @template T - The data the children render, in the data form.
 * @param props - `loading` and plain children, or `data`, `sample` and a render function, with the
 *   reveal mode, label, `onReveal` and the root `div`'s props.
 * @returns The reveal root, with `data-slot="skeleton-reveal"`.
 */
export function SkeletonReveal<T>(props: SkeletonRevealProps<T>): ReactElement {
  const served = useServerRendered();
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState<RevealState<T>>(() => ({
    current: { id: 0, kind: viewOf(props, null).kind, overSkeleton: false },
    exiting: [],
    last: null,
  }));
  const view = viewOf(props, state.last);
  // What the current pane last committed, which it keeps rendering once it starts leaving.
  const committed = useRef<{ readonly node: ReactNode; readonly refetch: boolean }>({
    node: view.node,
    refetch: view.refetch,
  });

  let next = state;
  if (view.kind !== state.current.kind) {
    // The leaving pane keeps what it last committed, not what these props would render: the
    // children or render function may have changed with the data. React renders this pass again at
    // once with the new state, so the ref is read before any commit can move it.
    const { node, refetch } = committed.current;
    next = {
      ...state,
      current: {
        id: state.current.id + 1,
        kind: view.kind,
        overSkeleton: view.kind === "content" && state.current.kind === "skeleton",
      },
      exiting: [...state.exiting, { id: state.current.id, kind: state.current.kind, node, refetch }],
    };
  }
  // Object.is, so data such as NaN that is never === itself still settles.
  if (view.shown !== null && (next.last === null || !Object.is(next.last.value, view.shown.value))) {
    next = { ...next, last: view.shown };
  }
  if (next !== state) setState(next);

  const { reveal = "smart", label, onReveal, className, render, ref, ...rest } = props;
  const { loading: _loading, data: _data, sample: _sample, children: _children, ...rootProps } = rest;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const panes = useRef(new Map<number, HTMLDivElement>());
  const motion = useRef<RevealMotion | null>(null);
  const servedAtMount = useRef(served);
  const skeletonSince = useRef(0);
  const lastInput = useRef(Number.NEGATIVE_INFINITY);
  const onRevealRef = useRef(onReveal);
  const previousId = useRef(next.current.id);
  /** The content pane `onReveal` last reported, so each reveal reports once and only once. */
  const reportedId = useRef<number | null>(null);
  /** The content pane whose reveal has come in and reports once no leaving pane is left. */
  const dueReport = useRef<number | null>(null);
  /** How many panes the last commit left on their way out, which `onReveal` waits on. */
  const leavingCount = useRef(0);

  /**
   * Reports the due reveal once its pane is still the one on screen, the last commit left no
   * pane on its way out and no height ease is running, a retargeted one included, so `onReveal`
   * reads the page as it stays: the content alone, with the root at its final height. A reveal a later swap replaced is dropped; one already reported is not reported again.
   */
  const reportWhenSettled = (): void => {
    const due = dueReport.current;
    if (due === null || leavingCount.current > 0 || motion.current?.easing === true) return;
    dueReport.current = null;
    if (due !== previousId.current || reportedId.current === due) return;
    reportedId.current = due;
    onRevealRef.current?.();
  };
  /** The owner the last swap or recovery ran under; a different one means the effects came back. */
  const swapOwner = useRef<RevealMotion | null>(null);
  /** Set while the owner's effects were just torn down, until the next microtask. */
  const maybeRemount = useRef(false);
  const currentId = next.current.id;
  const currentKind = next.current.kind;

  useLayoutEffect(() => {
    onRevealRef.current = onReveal;
    committed.current = { node: view.node, refetch: view.refetch };
  });

  // The motion owner lives while the root's effects do: unmounting stops every animation it
  // started, so nothing settles into an `onReveal` or a state update afterwards. Suspense hiding
  // the reveal, or a hidden Activity, destroys the effects too while the DOM and state stay; the
  // swap below recovers what the old owner left when the effects come back.
  //
  // StrictMode's development effect cycle also destroys and recreates them, and the swap below
  // must not take that for a resume, or the first client skeleton would skip its hold. The two
  // differ in time: React runs StrictMode's cleanup and second setup within one commit, before
  // any microtask, while a resume always lands in a later commit. So a teardown marks the next
  // owner as a possible remount, and a microtask clears the mark: an owner created while it is
  // still set is StrictMode's re-run, and one created after is a real resume.
  useLayoutEffect(() => {
    // A height ease that ends may be the last thing a due reveal waits on.
    const owner = new RevealMotion(() => reportWhenSettled());
    motion.current = owner;
    return () => {
      owner.dispose();
      if (motion.current === owner) motion.current = null;
      maybeRemount.current = true;
      queueMicrotask(() => {
        maybeRemount.current = false;
      });
    };
  }, []);

  const paneRef =
    (id: number) =>
    (element: HTMLDivElement | null): void => {
      if (element === null) panes.current.delete(id);
      else panes.current.set(id, element);
    };

  // Input while a skeleton is up: someone mid-gesture gets the content at once. Heard in the
  // reveal's own window, a same-origin frame's for a reveal rendered into one.
  useEffect(() => {
    const root = rootRef.current;
    if (currentKind !== "skeleton" || root === null) return undefined;
    const view = windowOf(root);
    const note = (): void => {
      lastInput.current = performance.now();
    };
    const options = { passive: true, capture: true } as const;
    for (const type of ["wheel", "touchmove", "keydown"] as const) view.addEventListener(type, note, options);
    return () => {
      for (const type of ["wheel", "touchmove", "keydown"] as const)
        view.removeEventListener(type, note, options);
    };
  }, [currentKind]);

  // A pane swap: the pane that was current has just moved into the exiting list. The same effect
  // brings in the reveal's first pane under its first owner. It also runs whenever the reveal's
  // effects come back under a new owner, after Suspense or a hidden Activity, and then settles
  // straight to this commit's pane instead: nobody saw the motion the old owner was running, a
  // first skeleton's hold included, or a swap that came due while hidden, so none is replayed. A
  // first owner settles the same way when the panes changed before it existed, as in an Activity
  // that rendered hidden and took its data before it first showed. Every pane on its way
  // out goes at once, the root keeps its own height, which the old owner restored, and content on
  // screen that a skeleton was giving way to has come in, so it reports `onReveal` once. A reveal
  // that a later load replaced while hidden reports nothing.
  useLayoutEffect(() => {
    const owner = motion.current;
    if (owner !== null && swapOwner.current !== owner) {
      // A StrictMode re-run is the same first arrival; only a later owner is a resume.
      const firstArrival = swapOwner.current === null || maybeRemount.current;
      swapOwner.current = owner;
      const leavingId = previousId.current;
      previousId.current = currentId;
      // Panes that changed before any owner saw them, as in an Activity that rendered hidden and
      // took its data before it first showed: nobody saw that swap either.
      const swappedUnseen = leavingId !== currentId || next.exiting.length > 0;
      if (firstArrival && !swappedUnseen) {
        // The reveal's first pane: a skeleton the server rendered is already on screen; one the
        // client mounts is held back under `smart`. Only a first owner gets here, so a reveal that
        // shows again after Suspense or a hidden Activity never holds its skeleton again.
        if (currentKind !== "skeleton") return;
        skeletonSince.current = servedAtMount.current ? Number.NEGATIVE_INFINITY : performance.now();
        const skeleton = panes.current.get(currentId);
        if (skeleton !== undefined && !servedAtMount.current) owner.holdFirstSkeleton(skeleton, reveal);
        return;
      }
      if (next.exiting.length > 0) setState((latest) => ({ ...latest, exiting: [] }));
      // Content on screen that replaced a skeleton, however many panes came and went unseen, has
      // come in; it reports once, unless its own reveal already did, after the cleanup commits.
      dueReport.current = next.current.overSkeleton && reportedId.current !== currentId ? currentId : null;
      return;
    }
    const leavingId = previousId.current;
    previousId.current = currentId;
    const root = rootRef.current;
    const incoming = panes.current.get(currentId);
    const leaving = panes.current.get(leavingId);
    const leavingPane = next.exiting.find((pane) => pane.id === leavingId);
    if (leavingId === currentId || owner === null || root === null) return;
    if (incoming === undefined || leaving === undefined || leavingPane === undefined) return;

    const now = performance.now();
    const shownMs = now - skeletonSince.current;
    if (currentKind === "skeleton") skeletonSince.current = now;
    const progress = owner.swap({
      root,
      mode: reveal,
      reducedMotion,
      incoming: { element: incoming, kind: currentKind },
      leaving: { element: leaving, kind: leavingPane.kind },
      history: {
        shownMs,
        recentInput: now - lastInput.current < INPUT_WINDOW_MS,
        refetch: leavingPane.kind === "skeleton" && leavingPane.refetch,
      },
    });
    // A label labels whatever element first holds its `for` id, so a leaving copy of a label would
    // also name the incoming content's control. The leaving pane renders its frozen node and never
    // returns, so React never writes the attribute back.
    for (const copy of leaving.querySelectorAll("label[for]")) copy.removeAttribute("for");
    const revealing = next.current.overSkeleton;
    void progress.entered.then((outcome) => {
      // Only a reveal that ran to its end and is still the pane on screen has come in. One cut
      // short by unmounting, Suspense or a hidden Activity reports when its effects come back.
      if (!revealing || outcome !== "completed" || owner.disposed) return;
      if (previousId.current !== currentId) return;
      dueReport.current = currentId;
      // The leaving panes may be gone already; otherwise the commit that removes them reports.
      reportWhenSettled();
    });
    void progress.exited.then(() => {
      if (owner.disposed) return;
      setState((latest) => ({ ...latest, exiting: latest.exiting.filter((pane) => pane.id !== leavingId) }));
    });
    // Keyed on the pane id alone: a swap runs once per new pane.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the swap reads this render's panes once
  }, [currentId]);

  // After the swap above: the pane now on screen is tracked from this commit on, so the next swap
  // pins it to where it stood before the pane replacing it was inserted.
  useLayoutEffect(() => {
    const pane = panes.current.get(currentId);
    const root = rootRef.current;
    if (pane !== undefined && root !== null) motion.current?.track(pane, root);
  });

  // After every commit: a reveal that has come in reports once this commit has left no pane on
  // its way out, so `onReveal` sees the final layout.
  useLayoutEffect(() => {
    leavingCount.current = next.exiting.length;
    reportWhenSettled();
  });

  // A swap is under way while a pane is on its way out, from the commit that inserts the incoming
  // pane before the leaving one.
  const swapping = next.exiting.length > 0;
  const renderPane = (
    pane: { readonly id: number; readonly kind: PaneKind; readonly node: ReactNode },
    leavingNow: boolean
  ): ReactElement =>
    pane.kind === "skeleton" ? (
      <SkeletonPane key={pane.id} standIn={pane.node} paneRef={paneRef(pane.id)} leaving={leavingNow} />
    ) : (
      // While a swap is under way neither content pane anchors a scrolled ancestor's scroll:
      // inserting the incoming pane before the leaving one would otherwise scroll it by the incoming
      // pane's height. Settled content anchors as any content does. See `SkeletonPane`.
      <div
        key={pane.id}
        ref={paneRef(pane.id)}
        data-slot="skeleton-reveal-content"
        className={swapping ? "[overflow-anchor:none]" : undefined}>
        <PaneExclusion excluded={leavingNow && "leaving"}>{pane.node}</PaneExclusion>
      </div>
    );

  const loading = currentKind === "skeleton";
  return useRender({
    defaultTagName: "div",
    render,
    ref: ref === undefined ? rootRef : [rootRef, ref],
    props: {
      "data-slot": "skeleton-reveal",
      "aria-busy": loading,
      ...mergeProps<"div">(
        {
          className: cn("relative isolate", className),
          children: (
            <>
              {loading ? (
                <span data-slot="skeleton-reveal-label" className="sr-only">
                  {label ?? <DefaultLabel />}
                </span>
              ) : null}
              {/* One keyed list, so the current pane keeps its DOM as it moves into the exiting ones.
                  The current pane comes first, so ids in it resolve to its own elements, not to
                  copies in a pane on its way out; the newest leaving pane follows it, so no pane
                  that stays in the DOM is ever moved. Leaving panes stack by z-index. */}
              {[
                renderPane({ id: currentId, kind: currentKind, node: view.node }, false),
                ...next.exiting.toReversed().map((pane) => renderPane(pane, true)),
              ]}
            </>
          ),
        },
        rootProps
      ),
    },
  });
}

SkeletonReveal.displayName = "SkeletonReveal";
