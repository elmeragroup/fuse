"use client";

import { useSyncExternalStore } from "react";

/** The platform never changes, so there is nothing to subscribe to. */
function subscribeNever(): () => void {
  return () => undefined;
}

/**
 * The cap of the platform's command modifier: ⌘ on Apple platforms, Ctrl elsewhere. The server and
 * hydration render ⌘, and the client corrects it after hydration.
 *
 * @returns The modifier's cap label.
 */
export function useModifierKey(): "⌘" | "Ctrl" {
  return useSyncExternalStore(
    subscribeNever,
    () => (/Mac|iPhone|iPad/u.test(navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "⌘"
  );
}
