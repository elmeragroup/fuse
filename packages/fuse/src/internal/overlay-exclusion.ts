"use client";

import { createContext, use, useState } from "react";

/**
 * Package-private. Whether the subtree renders content that must not open overlays: a
 * SkeletonReveal's ghost, drawn from sample data, and content on its way out. Every Fuse overlay
 * resolves its portal through `useResolvedPortalContainer`, which renders no portal here, so no
 * popup, focus trap, backdrop or anchored scroll lock mounts. The dialog-family roots, which lock
 * the page's scroll from the root itself, stay closed here too.
 */
export const OverlayExclusionContext = createContext(false);

/**
 * Package-private. Whether overlays in this subtree stay closed and unportaled.
 *
 * @returns `true` inside an excluded subtree.
 */
export function useOverlayExcluded(): boolean {
  return use(OverlayExclusionContext);
}

/** The props an excluded overlay root takes over the consumer's: closed, or nothing. */
export type OverlayRootOverride = { readonly open?: false };

const CLOSED: OverlayRootOverride = { open: false };
const NO_OVERRIDE: OverlayRootOverride = {};

/**
 * Package-private. The props a dialog-family root spreads after the consumer's: `{ open: false }`
 * for a root that mounted inside an exclusion, which stays closed for its lifetime, controlled
 * closed from its first render as Base UI requires of a controlled root; nothing otherwise. A root
 * that was open before its subtree became excluded, in content on its way out, keeps its state:
 * its popup is gone with the portal, and its pane unmounts once the fade ends.
 *
 * @returns The override to spread last onto the primitive root.
 */
export function useOverlayRootOverride(): OverlayRootOverride {
  const excluded = useOverlayExcluded();
  const [closed] = useState(excluded);
  return closed ? CLOSED : NO_OVERRIDE;
}
