import { useLayoutEffect, useRef, useState } from "react";
import type { ReactElement } from "react";

import { Toast } from "@elmeragroup/fuse/toast";

import type { FrameClock } from "./frame-clock";
import { MOTION_ELAPSED_ATTRIBUTE } from "./seek-css-animations";
import { elapsedMs, useRewindGeneration } from "./seeked-overlay";

/** Props for {@link FrameToast}. */
export type FrameToastProps = {
  /** The frame the toast appears on. */
  readonly at: number;
  readonly clock: FrameClock;
  readonly title: string;
  readonly description: string;
  /** Places the viewport. */
  readonly className?: string;
};

/** One mount of the toast: a provider of its own that raises the toast once, on mount. */
function ToastMount({ at, clock, title, description, className }: FrameToastProps): ReactElement {
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
        <Toast.Viewport container={host} className={className} />
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
