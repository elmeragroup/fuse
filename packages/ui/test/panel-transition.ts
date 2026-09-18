import { expect, vi } from "vitest";
import { userEvent } from "vitest/browser";

/**
 * Frame-level observations for the two Base UI panels whose height animates through the
 * shared `panelHeight` recipe (`Collapsible.Content`, `Accordion.Content`). End-state
 * assertions cannot tell a transition from a snap, so the assertion helper samples the
 * rendered box once per animation frame, watches the height transition events, and waits
 * for the animation to settle before checking either direction.
 */

/**
 * The panel a trigger controls *while the panel is open*: `aria-controls` is the semantic
 * seam and works for the keepMounted, hiddenUntilFound, and default (unmounted-when-closed)
 * content variants, unlike a `closest("[hidden]")` walk, which depends on the mount mode.
 * Base UI exposes the attribute only while open, so suites resolve the panel after the
 * opening click.
 */
export function panelControlledBy(trigger: HTMLElement): HTMLElement | null {
  const id = trigger.getAttribute("aria-controls");
  if (!id) {
    return null;
  }
  const element = document.getElementById(id);
  return element instanceof HTMLElement ? element : null;
}

const HEIGHT_TRANSITION_EVENTS = ["transitionrun", "transitionend", "transitioncancel"] as const;

type HeightTransitionEvent = (typeof HEIGHT_TRANSITION_EVENTS)[number];

type ObservedHeightTransition = {
  readonly type: HeightTransitionEvent;
  readonly target: EventTarget | null;
};

type HeightTransitionWatch = {
  readonly events: ObservedHeightTransition[];
  stop(): void;
};

/**
 * Collect `height` transition events on `document`, so the watch can start before the
 * opening click: the panel may not exist yet (default content) and `aria-controls` only
 * resolves once open. Each observation keeps its target, so the caller can filter to the
 * resolved panel after the click; `stop()` detaches the listeners.
 */
function watchHeightTransitions(): HeightTransitionWatch {
  const events: ObservedHeightTransition[] = [];
  const handlers = HEIGHT_TRANSITION_EVENTS.map(
    (type) =>
      [
        type,
        (event: TransitionEvent) => {
          if (event.propertyName === "height") {
            events.push({ type, target: event.target });
          }
        },
      ] as const
  );
  for (const [type, handler] of handlers) {
    document.addEventListener(type, handler);
  }
  return {
    events,
    stop: () => {
      for (const [type, handler] of handlers) {
        document.removeEventListener(type, handler);
      }
    },
  };
}

function heightTransitionsOn(
  events: readonly ObservedHeightTransition[],
  panel: HTMLElement
): HeightTransitionEvent[] {
  return events.filter((event) => event.target === panel).map((event) => event.type);
}

/** Sample `read()` once per animation frame for `count` frames. */
async function sampleFrames(count: number, read: () => number): Promise<number[]> {
  const samples: number[] = [];
  for (let index = 0; index < count; index += 1) {
    samples.push(read());
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  return samples;
}

/**
 * Rendered height in px. A `display: none` panel (boolean `hidden`) reports 0 here, unlike
 * `getComputedStyle`, which would echo the authored `h-0` even when nothing is rendered.
 */
function renderedHeight(panel: HTMLElement): number {
  return panel.getBoundingClientRect().height;
}

/**
 * True when some sample lies strictly inside (0, settled): the height moved through
 * intermediate values rather than jumping. A snapped (or `transition-none`) panel fails this.
 */
function hasIntermediateFrame(samples: readonly number[], settled: number): boolean {
  return samples.some((height) => height > 0.5 && height < settled - 0.5);
}

/**
 * Assert the shared panel height transition in both directions for the panel the trigger
 * controls. Height transition events are observed from before the opening click, so the
 * open direction is proven by events as well as by the intermediate rendered frames. The
 * close direction waits for the closed shape named by `closedState`, then asserts a
 * closing `transitionrun`; a `keepMounted` panel also dispatches `transitionend`, while a
 * default panel is unmounted as the animation finishes and cannot dispatch it.
 *
 * @param trigger - The trigger that opens and closes the panel under test.
 * @param closedState - `"hidden"` for a panel that stays mounted behind `hidden`, or
 * `"unmounted"` for one that leaves the accessibility tree when closed.
 */
export async function expectPanelHeightTransition(
  trigger: HTMLElement,
  closedState: "hidden" | "unmounted"
): Promise<void> {
  const watch = watchHeightTransitions();
  try {
    await userEvent.click(trigger);
    const panel = panelControlledBy(trigger);
    if (panel === null) {
      throw new Error("expected the opening click to control a panel");
    }

    const opening = await sampleFrames(20, () => renderedHeight(panel));
    await vi.waitFor(() => {
      expect(panel.getAnimations().length).toBe(0);
    });
    const settled = renderedHeight(panel);
    expect(settled).toBeGreaterThan(0);
    expect(Math.abs(settled - panel.scrollHeight)).toBeLessThanOrEqual(1);
    expect(hasIntermediateFrame(opening, settled)).toBe(true);
    await vi.waitFor(() => {
      expect(heightTransitionsOn(watch.events, panel)).toEqual(["transitionrun", "transitionend"]);
    });

    watch.events.length = 0;
    await userEvent.click(trigger);
    const closing = await sampleFrames(20, () => renderedHeight(panel));
    expect(hasIntermediateFrame(closing, settled)).toBe(true);
    if (closedState === "hidden") {
      await vi.waitFor(() => {
        expect(panel.hasAttribute("hidden")).toBe(true);
      });
      expect(renderedHeight(panel)).toBe(0);
    } else {
      await vi.waitFor(() => {
        expect(panelControlledBy(trigger)).toBeNull();
      });
    }
    // Base UI unmounts a default Content as its close animation finishes, so the panel is
    // detached before `transitionend` dispatches; the closing `transitionrun` plus the
    // unmount wait prove the close ran to completion. A `keepMounted` panel stays attached
    // and dispatches both events.
    const closingEvents: readonly HeightTransitionEvent[] =
      closedState === "hidden" ? ["transitionrun", "transitionend"] : ["transitionrun"];
    await vi.waitFor(() => {
      expect(heightTransitionsOn(watch.events, panel)).toEqual(closingEvents);
    });
  } finally {
    watch.stop();
  }
}
