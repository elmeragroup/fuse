/**
 * What React has committed on a page, read through the global hook React DevTools uses. Every
 * function here runs in a frame of the page.
 *
 * A shot must not show a part React is still loading: a click that mounts a lazily loaded part,
 * such as the landing's Neutral side, commits a Suspense fallback first and the part only once its
 * code has arrived. Network idle cannot tell, since a page reaches it once per load, and loaded
 * code is not yet rendered code. React itself can: every React DOM build, production included,
 * registers with `__REACT_DEVTOOLS_GLOBAL_HOOK__` when the page defines one and reports each
 * commit to it. So the page needs no marker of its own, and a deployment built before this tool
 * read it settles the same way.
 *
 * The reading walks React's fiber tree, which is internal, so it accepts only the renderers it was
 * checked against: `react-dom` 19, whose tags `react-reconciler/src/ReactWorkTags.js` defines and
 * `react-dom-client.production.js` 19.3 uses as below. Any other renderer fails the shot, naming
 * itself, rather than being read wrongly.
 */

/** The fiber tags the reading uses, as react-dom 19 numbers them. */
const TAGS = {
  /** `HostRoot`: its `stateNode.containerInfo` is the node the root renders into. */
  root: 3,
  /** `HostPortal`: its `stateNode.containerInfo` is the node the portal renders into. */
  portal: 4,
  /** `SuspenseComponent`: `memoizedState` is set while it shows its fallback or awaits hydration. */
  suspense: 13,
  /** `OffscreenComponent`: `memoizedState` is set while its subtree is hidden. */
  offscreen: 22,
  /** `ActivityComponent`: `memoizedState.dehydrated` is set while it awaits hydration. */
  activity: 31,
} as const;

/** The values {@link readReact} reads, passed as its argument, since it runs apart from this module. */
export const COMMIT_READING = { tags: TAGS, rendererPackage: "react-dom", majors: ["19"] } as const;

/** The argument {@link readReact} takes. */
export type CommitReading = typeof COMMIT_READING;

/** A renderer that registered with the hook, as it describes itself. */
type Renderer = { readonly rendererPackageName?: unknown; readonly version?: unknown };

/** The fields of a fiber the reading uses. */
type Fiber = {
  readonly tag: number;
  readonly memoizedState: { readonly dehydrated?: unknown } | null;
  /** The element of a host fiber, the root of a root fiber, the portal's of a portal fiber. */
  readonly stateNode: Element | { readonly containerInfo?: Node } | null;
  readonly child: Fiber | null;
  readonly sibling: Fiber | null;
};

/** The fields of a fiber root the reading uses. */
type FiberRoot = { readonly current: Fiber; readonly containerInfo: Node };

/** What the hook has seen. */
type Commits = { readonly renderers: readonly Renderer[]; readonly roots: ReadonlySet<FiberRoot> };

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- `Window` gains a property only by interface declaration merging; a type alias cannot augment.
  interface Window {
    /** What the commit hook has seen; defined by `installCommitHook` in every frame a run opens. */
    readonly __prShotsReactCommits?: Commits;
  }
}

/**
 * Runs in every frame before its scripts, as an init script. Defines the hook React registers with
 * and records each renderer and each root it commits. A frame without React never calls it.
 */
export function installCommitHook(): void {
  const renderers: Renderer[] = [];
  const roots = new Set<FiberRoot>();
  Object.defineProperty(window, "__prShotsReactCommits", { value: { renderers, roots } });
  const noop = (): void => undefined;
  Object.defineProperty(window, "__REACT_DEVTOOLS_GLOBAL_HOOK__", {
    value: {
      supportsFiber: true,
      renderers: new Map(),
      inject: (renderer: Renderer): number => renderers.push(renderer),
      onCommitFiberRoot: (_renderer: number, root: FiberRoot) => {
        roots.add(root);
      },
      onCommitFiberUnmount: noop,
      onPostCommitFiberRoot: noop,
      onScheduleFiberRoot: noop,
      setStrictMode: noop,
      checkDCE: noop,
    },
  });
}

/**
 * Runs in a frame. Whether a React renderer has registered with the hook.
 *
 * @returns True once React has loaded in the frame.
 */
export function reactRegistered(): boolean {
  return (window.__prShotsReactCommits?.renderers.length ?? 0) > 0;
}

/** What {@link readReact} found once it no longer waits. */
export type ReactVerdict =
  | { readonly _tag: "settled" }
  | { readonly _tag: "unsupported"; readonly renderer: string };

/**
 * Runs in a frame. Whether React has painted everything it is loading. It waits (`false`) while a
 * painted boundary is incomplete: a Suspense boundary that shows its fallback or awaits hydration,
 * or an Activity that awaits hydration. A boundary is painted when the element its content renders
 * into is visible, opacity and `visibility` included, outside any subtree React hides, so an
 * inactive side under `opacity: 0` does not hold the shot. It also waits while React has
 * registered but committed nothing. A frame without React is settled. A renderer the reading was
 * not checked against is `unsupported`, whatever its tree shows.
 *
 * @param reading - `COMMIT_READING`.
 * @returns `false` while waiting, then the verdict.
 */
export function readReact({ tags, rendererPackage, majors }: CommitReading): ReactVerdict | false {
  const commits = window.__prShotsReactCommits;
  if (commits === undefined || commits.renderers.length === 0) {
    return { _tag: "settled" };
  }
  for (const { rendererPackageName, version } of commits.renderers) {
    const major = String(version).split(".")[0];
    if (rendererPackageName !== rendererPackage || !majors.some((supported) => supported === major)) {
      return { _tag: "unsupported", renderer: `${String(rendererPackageName)} ${String(version)}` };
    }
  }
  if (commits.roots.size === 0) {
    return false;
  }
  const painted = (container: Node) =>
    (container instanceof Element ? container : document.documentElement).checkVisibility({
      opacityProperty: true,
      visibilityProperty: true,
    });
  for (const root of commits.roots) {
    // Each fiber with the node its host children render into.
    const stack: (readonly [Fiber, Node])[] = [[root.current, root.containerInfo]];
    for (let entry = stack.pop(); entry !== undefined; entry = stack.pop()) {
      const [fiber, container] = entry;
      const { tag, memoizedState: state } = fiber;
      if (tag === tags.offscreen && state !== null) {
        continue;
      }
      const incomplete =
        (tag === tags.suspense && state !== null) ||
        (tag === tags.activity && state !== null && (state.dehydrated ?? null) !== null);
      if (incomplete && painted(container)) {
        return false;
      }
      if (fiber.sibling !== null) {
        stack.push([fiber.sibling, container]);
      }
      if (fiber.child !== null) {
        // A host element's children render into it, a root's or portal's into its container.
        const node = fiber.stateNode;
        const inner =
          node instanceof Element
            ? node
            : ((tag === tags.root || tag === tags.portal ? node?.containerInfo : undefined) ?? container);
        stack.push([fiber.child, inner]);
      }
    }
  }
  return { _tag: "settled" };
}
