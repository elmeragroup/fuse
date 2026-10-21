import type { KeyboardEvent } from "react";

/**
 * Whether a key press is a Backspace that edits nothing, because the input is empty and no input
 * method is composing text. A search treats it as "go back".
 *
 * @param event - The input's keydown.
 * @returns Whether the press is a Backspace in an empty input.
 */
export function isBackspaceOnEmpty(event: KeyboardEvent<HTMLInputElement>): boolean {
  // keyCode 229 marks an input method's key event, which some browsers send without `isComposing`.
  return (
    event.key === "Backspace" &&
    event.currentTarget.value === "" &&
    !event.nativeEvent.isComposing &&
    event.keyCode !== 229
  );
}
