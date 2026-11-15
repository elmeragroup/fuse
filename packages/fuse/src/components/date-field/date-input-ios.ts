"use client";

// iOS VoiceOver cannot focus a spinbutton, so the segments are textboxes there, as React Aria's
// are, detected as React Aria's `isIOS` does: an iPhone, iPad or iPod platform, or a Mac platform
// with touch, which is how iPadOS reports itself. The platform is read after hydration: the server
// and the hydrating render write spinbuttons.

import { useSyncExternalStore } from "react";

/** The navigator fields that the iOS detection reads. */
type PlatformReport = Pick<Navigator, "platform" | "maxTouchPoints">;

/**
 * Whether a navigator reports iOS or iPadOS.
 *
 * @param report - The navigator's platform and touch points.
 * @returns `true` on an iPhone, iPad or iPod, including an iPad that reports a Mac platform.
 */
export function isIOS({ platform, maxTouchPoints }: PlatformReport): boolean {
  return /^iP(?:hone|ad|od)/u.test(platform) || (platform.startsWith("Mac") && maxTouchPoints > 1);
}

const noSubscription = (): (() => void) => () => undefined;
const readsNavigator = (): boolean => isIOS(navigator);
const onServer = (): boolean => false;

/**
 * Whether the segments are textboxes for iOS VoiceOver. It is `false` on the server and while
 * hydrating.
 *
 * @returns `true` once mounted on iOS or iPadOS.
 */
export function useIsIOS(): boolean {
  return useSyncExternalStore(noSubscription, readsNavigator, onServer);
}
