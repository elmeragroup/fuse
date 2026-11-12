import type { KeyboardEvent } from "react";

import { isComposing } from "./is-composing";

/**
 * Whether a key press is a Backspace that edits nothing, because the input is empty and no input
 * method is composing text. A search treats it as "go back".
 *
 * @param event - The input's keydown.
 * @returns Whether the press is a Backspace in an empty input.
 */
export function isBackspaceOnEmpty(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.key === "Backspace" && event.currentTarget.value === "" && !isComposing(event);
}
