/**
 * Whether a demo stage reaches inside a Fuse part, read in the page. The stage positions each
 * demo root; it never lays out what a Fuse part renders inside itself. The unit under test is the
 * stage's root rules, the ones `data-stage-layout` switches on in `demo-stage.tsx`; the oracle is
 * the part's own layout without them. For every stage root that carries a `data-slot`, this
 * module records each rendered descendant's box relative to the root, removes `data-stage-layout`
 * from every stage, re-reads, puts the attribute back and reads a third time.
 *
 * The two reads with the rules must agree, or the descendant's layout was still changing, such as
 * a late image or a resize observer, and the read says nothing about the stage. Such a descendant
 * is read again, after two animation frames, up to `ATTEMPTS` reads in all; one that never reads
 * the same twice is reported as `unstable`, so a flaky read fails the gate instead of passing it.
 * A stable descendant whose box differs without the rules is reported as `moved`.
 *
 * It skips boxes with no area in both reads with the rules, which show nothing, and `position:
 * fixed` subtrees, such as Base UI's 1px hidden inputs and live regions: they sit against the
 * viewport, not the part, so they shift against the root whenever the root itself moves, which the
 * stage is free to do.
 *
 * Keying the rules off one attribute keeps this probe independent of the stage's class string: a
 * rule added to the stage's root rules later is neutralised with the rest.
 *
 * Every helper is declared inside `readStageLeaks`, because Playwright serializes the function it
 * evaluates on its own.
 */

/** One descendant of a Fuse part that the stage's root rules move, or that never read steadily. */
export type StageLeak = {
  /** `moved` when the rules move the descendant, `unstable` when its reads never agreed. */
  readonly outcome: "moved" | "unstable";
  /** The id of the demo frame's heading. */
  readonly demo: string;
  /** The root's tag and `data-slot`. */
  readonly root: string;
  /** The descendant's tag and `data-slot`. */
  readonly descendant: string;
  /** What moved and by how much, or how the reads disagreed, in px. */
  readonly reason: string;
};

/**
 * Reads every stage on the page and returns the descendants of its Fuse part roots that the
 * stage's root rules move, and those that never read the same twice with the rules.
 *
 * @returns The leaks, empty when the stage moves nothing inside a part and every read was steady.
 */
export async function readStageLeaks(): Promise<StageLeak[]> {
  /** The attribute that switches on the stage's root rules. */
  const LAYOUT = "data-stage-layout";
  /** How far a box edge may shift, in px, before it counts as moved: sub-pixel snapping. */
  const TOLERANCE = 0.5;
  /** How many with/without/with reads a descendant gets before an unsteady one is reported. */
  const ATTEMPTS = 3;

  /** The boxes a stage lays out: element children, through `display: contents`, in flow. */
  function rootsOf(parent: Element): HTMLElement[] {
    return [...parent.children].flatMap((child) => {
      if (!(child instanceof HTMLElement)) {
        return [];
      }
      const style = getComputedStyle(child);
      if (style.display === "contents") {
        return rootsOf(child);
      }
      if (style.display === "none" || style.position === "absolute" || style.position === "fixed") {
        return [];
      }
      return [child];
    });
  }

  /** A descendant's edges relative to its root's top-left corner, or `undefined` with no area. */
  type Edges = readonly [left: number, top: number, right: number, bottom: number];
  function edgesIn(root: Element, element: Element): Edges | undefined {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) {
      return undefined;
    }
    const origin = root.getBoundingClientRect();
    return [box.left - origin.left, box.top - origin.top, box.right - origin.left, box.bottom - origin.top];
  }

  /** Whether the element or an ancestor below `root` is placed against the viewport. */
  function isFixed(root: Element, element: Element): boolean {
    for (let node: Element | null = element; node !== null && node !== root; node = node.parentElement) {
      if (getComputedStyle(node).position === "fixed") {
        return true;
      }
    }
    return false;
  }

  /** Whether two reads of a box agree within `TOLERANCE`; two reads with no area agree. */
  function same(a: Edges | undefined, b: Edges | undefined): boolean {
    if (a === undefined || b === undefined) {
      return a === b;
    }
    return a.every((edge, index) => Math.abs(edge - (b[index] ?? Number.NaN)) <= TOLERANCE);
  }

  /** Edges as text for a report. */
  function format(edges: Edges | undefined): string {
    return edges === undefined
      ? "no box"
      : `[${edges.map((edge) => String(Math.round(edge * 10) / 10)).join(", ")}]`;
  }

  /** A short name for an element: its tag, then its `data-slot` if it has one. */
  function nameOf(element: Element): string {
    const slot = element.getAttribute("data-slot");
    return `${element.tagName.toLowerCase()}${slot === null ? "" : `[${slot}]`}`;
  }

  /** Resolves after two animation frames, so a layout in progress can land before a re-read. */
  function settle(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }

  type Descendant = { readonly demo: string; readonly root: HTMLElement; readonly element: Element };
  type Reads = {
    readonly staged: Edges | undefined;
    readonly own: Edges | undefined;
    readonly restaged: Edges | undefined;
  };

  const stages = [...document.querySelectorAll<HTMLElement>(`[data-demo-stage][${LAYOUT}]`)];

  /**
   * Reads each descendant with the rules, without them and with them again. The attribute comes off
   * every stage at once: a read per stage would restyle the document per stage.
   */
  function readAll(descendants: readonly Descendant[]): Reads[] {
    const staged = descendants.map(({ root, element }) => edgesIn(root, element));
    const values = stages.map((stage) => stage.getAttribute(LAYOUT) ?? "");
    for (const stage of stages) {
      stage.removeAttribute(LAYOUT);
    }
    let own: (Edges | undefined)[];
    try {
      own = descendants.map(({ root, element }) => edgesIn(root, element));
    } finally {
      for (const [index, stage] of stages.entries()) {
        stage.setAttribute(LAYOUT, values[index] ?? "");
      }
    }
    return descendants.map(({ root, element }, index) => ({
      staged: staged[index],
      own: own[index],
      restaged: edgesIn(root, element),
    }));
  }

  /** A report on one descendant. */
  function leak(
    outcome: StageLeak["outcome"],
    { demo, root, element }: Descendant,
    reason: string
  ): StageLeak {
    return { outcome, demo, root: nameOf(root), descendant: nameOf(element), reason };
  }

  let pending: Descendant[] = stages.flatMap((stage) => {
    const demo = stage.closest("[data-demo-frame]")?.getAttribute("aria-labelledby") ?? "(no frame)";
    return rootsOf(stage)
      .filter((root) => root.dataset.slot !== undefined)
      .flatMap((root) =>
        [...root.querySelectorAll("*")]
          .filter((element) => !isFixed(root, element))
          .map((element) => ({ demo, root, element }))
      );
  });
  const leaks: StageLeak[] = [];
  for (let attempt = 1; attempt <= ATTEMPTS && pending.length > 0; attempt += 1) {
    if (attempt > 1) {
      await settle();
    }
    const reads = readAll(pending);
    const unsteady: Descendant[] = [];
    for (const [index, descendant] of pending.entries()) {
      const read = reads[index];
      if (read === undefined) {
        continue;
      }
      const { staged, own, restaged } = read;
      if (!same(staged, restaged)) {
        if (attempt < ATTEMPTS) {
          unsteady.push(descendant);
        } else {
          leaks.push(
            leak(
              "unstable",
              descendant,
              `reads ${format(staged)} then ${format(restaged)} with the stage rules, ${String(ATTEMPTS)} times out of ${String(ATTEMPTS)}`
            )
          );
        }
        continue;
      }
      if (staged === undefined || same(staged, own)) {
        continue;
      }
      leaks.push(
        leak("moved", descendant, `sits at ${format(staged)} with the stage rules, ${format(own)} without`)
      );
    }
    pending = unsteady;
  }
  return leaks;
}
