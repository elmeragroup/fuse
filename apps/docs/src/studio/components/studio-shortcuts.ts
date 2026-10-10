"use client";

import { useSyncExternalStore } from "react";

import { isTypingTarget } from "../../lib/typing-target";

/** Open overlays inside an artboard: they keep their keys, presses and scrolling. */
export const OVERLAYS = '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]';

/**
 * Whether a key press should toggle a canvas overlay: a bare `key`, pressed once rather than
 * repeated while held, outside text fields and the overlays open inside an artboard.
 *
 * @param event - The keydown event.
 * @param key - The shortcut's letter, in lower case.
 */
export function isOverlayShortcut(event: KeyboardEvent, key: string): boolean {
  return (
    event.key.toLowerCase() === key &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey &&
    !event.repeat &&
    !event.defaultPrevented &&
    !isTypingTarget(event.target, OVERLAYS)
  );
}

/** The platform never changes, so there is nothing to subscribe to. */
const subscribe = (): (() => void) => () => undefined;

/**
 * The modifier the zoom shortcuts name: ⌘ on Apple platforms, Ctrl elsewhere. The server and
 * hydration render ⌘, and the client corrects it after hydration.
 */
export function useModifierLabel(): string {
  return useSyncExternalStore(
    subscribe,
    () => (/Mac|iPhone|iPad/u.test(navigator.platform) ? "⌘" : "Ctrl+"),
    () => "⌘"
  );
}
