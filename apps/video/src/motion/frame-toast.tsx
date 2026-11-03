import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { Toast } from "@elmeragroup/fuse/toast";

import type { FrameClock } from "./frame-clock";
import { MOTION_ELAPSED_ATTRIBUTE } from "./seek-css-animations";
import { elapsedMs, useRewindGeneration } from "./seeked-overlay";

/**
 * Where the viewport sits in its frame, in Tailwind spacing steps from the frame's edges, as
 * `right-36` would place it, and its width in steps or the frame's full width.
 */
export type ToastPlacement = {
  readonly left?: number;
  readonly right?: number;
  readonly bottom: number;
  readonly width: number | "full";
};

/** A length of Tailwind spacing steps, as the `right-36` class computes it. */
function spacing(steps: number | undefined): string | undefined {
  return steps === undefined ? undefined : `calc(var(--spacing) * ${String(steps)})`;
}

/**
 * The viewport's place as inline style. Fuse places its viewport with `sm:` classes against the
 * window, which is wider than the stage, and inline style outranks them at every breakpoint.
 */
function placementStyle({ left, right, bottom, width }: ToastPlacement): CSSProperties {
  return {
    position: "absolute",
    left: spacing(left),
    right: spacing(right),
    bottom: spacing(bottom),
    width: width === "full" ? "100%" : spacing(width),
  };
}

/** Props for {@link FrameToast}. */
export type FrameToastProps = {
  /** The frame the toast appears on. */
  readonly at: number;
  readonly clock: FrameClock;
  readonly title: string;
  readonly description: string;
  /** Places the viewport in the frame. */
  readonly placement: ToastPlacement;
};

/** One mount of the toast: a provider of its own that raises the toast once, on mount. */
function ToastMount({ at, clock, title, description, placement }: FrameToastProps): ReactElement {
  const [manager] = useState(Toast.createToastManager);
  const host = useRef<HTMLDivElement>(null);
  const raised = useRef(false);
  useLayoutEffect(() => {
    if (!raised.current) {
      raised.current = true;
      // A toast never times out on the wall clock; the frame decides when it leaves.
      manager.add({ type: "success", title, description, timeout: 0 });
    }
  }, [manager, title, description]);
  return (
    <Toast.Provider toastManager={manager}>
      <div ref={host} className="absolute inset-0" {...{ [MOTION_ELAPSED_ATTRIBUTE]: elapsedMs(clock, at) }}>
        <Toast.Viewport container={host} style={placementStyle(placement)} />
      </div>
    </Toast.Provider>
  );
}

/**
 * A success toast that exists from frame `at` on. Its provider mounts on that frame and unmounts
 * before it, so a rewind removes the toast at once instead of animating it out, and replaying
 * forward raises one toast, never a second. A rewind into its entrance mounts it fresh, so the
 * entrance runs again from the start.
 *
 * @returns The toast layer, or nothing before `at`.
 */
export function FrameToast(props: FrameToastProps): ReactElement | null {
  const generation = useRewindGeneration(props.clock, props.at);
  return props.clock.frame < props.at ? null : <ToastMount key={generation} {...props} />;
}
