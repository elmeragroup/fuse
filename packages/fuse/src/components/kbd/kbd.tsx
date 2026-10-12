import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { kbdVariants } from "./kbd-variants";

const styles = kbdVariants();

/** Props of `Kbd`: a native `kbd` element's. */
export type KbdProps = ComponentProps<"kbd">;
/** Props of `KbdGroup`: a native `kbd` element's. */
export type KbdGroupProps = ComponentProps<"kbd">;

/**
 * One key cap, such as `Esc` or an icon. It renders the glyph it is given and never detects
 * the platform, so the server and the browser render the same cap; choose `⌘` or `Ctrl` where
 * the platform is known. Screen readers read it. Where it only repeats a shortcut that the
 * control it annotates carries in `aria-keyshortcuts`, set `aria-hidden`. Server component.
 */
export function Kbd({ className, ...props }: KbdProps): ReactElement {
  return <kbd data-slot="kbd" className={cn(styles.cap(), className)} {...props} />;
}

/**
 * A key combination: the caps pressed together, such as `⌘` and `K`. Caps nested in an outer
 * `kbd` mark a combination in HTML. Inside an InputGroup addon the group takes the addon's
 * inner corner and hands it on to its caps. Server component.
 */
export function KbdGroup({ className, ...props }: KbdGroupProps): ReactElement {
  return <kbd data-slot="kbd-group" className={cn(styles.group(), className)} {...props} />;
}

Kbd.displayName = "Kbd";
KbdGroup.displayName = "KbdGroup";
