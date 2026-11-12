import type { KeyboardEvent } from "react";

/**
 * Whether a key event belongs to an input method's composition, which owns keys such as Enter,
 * Escape and Backspace until it commits.
 *
 * @param event - The keydown.
 * @returns Whether an input method is composing.
 */
export function isComposing(event: KeyboardEvent): boolean {
  // keyCode 229 marks an input method's key event, which some browsers send without `isComposing`.
  return event.nativeEvent.isComposing || event.keyCode === 229;
}
