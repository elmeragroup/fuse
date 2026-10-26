import { cn } from "../../styles/cn";

/**
 * The Avatar root: the 32px `muted` circle that clips the image and centers the initials, set at
 * 14px Medium in `muted-foreground`. A consumer's `size-*` class, which Avatar merges after it,
 * replaces its `size-8`. Not exported from `@elmeragroup/fuse/avatar`; the workspace-only recipe
 * catalog re-exports it for the Figma component sync.
 */
export const avatarRootClass = cn(
  "text-sm font-medium inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted align-middle text-muted-foreground select-none"
);

/**
 * Stack classes for `Avatar.Group`. `:where()` wraps the whole parent-and-child selector, so the
 * group's ring rule scores zero specificity and any explicit ring utility on a child avatar wins.
 */
export const avatarGroupClass = cn("flex -space-x-2 [:where(&>*)]:ring-2 [:where(&>*)]:ring-background");

/** The Avatar image, which fills the circle and covers it, cropping what overflows. */
export const avatarImageClass = cn("size-full object-cover");

/** The Avatar fallback, which fills the circle and centers its initials. */
export const avatarFallbackClass = cn("flex size-full items-center justify-center");
