import { nextFrames } from "./animation-frames";

/**
 * Waits out a popup's focus restore after a parent's change has rendered. When the change removes
 * the focused element, such as a picker's day button or a time input that remounts, Base UI's
 * `FloatingFocusManager` (`restoreFocus: "popup"`) focuses the popup in a microtask and, in that
 * microtask, requests an animation frame that focuses it again. Both are queued during the commit,
 * so two frames after the change has rendered they have run, and a part the test focuses next keeps
 * its focus. When the change removes nothing, there is nothing to wait for and this costs two frames.
 */
export async function popupFocusRestored(): Promise<void> {
  await nextFrames(2);
}
