"use client";

import { useSyncExternalStore } from "react";

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
