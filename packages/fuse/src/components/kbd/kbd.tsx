import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { kbdVariants } from "./kbd-variants";

const styles = kbdVariants();

/** `Kbd` takes a native `kbd` element's props. */
export type KbdProps = ComponentProps<"kbd">;
/** `KbdGroup` takes a native `kbd` element's props. */
export type KbdGroupProps = ComponentProps<"kbd">;

/**
 * One key cap, such as `Esc` or an icon. It renders the glyph it is given and never detects
 * the platform, so the server and the browser render the same cap. Choose `⌘` or `Ctrl` where
 * you know the platform. Screen readers read the cap. When it only repeats a shortcut that the
 * control it annotates declares in `aria-keyshortcuts`, set `aria-hidden` on it. It is a server
 * component.
 */
export function Kbd({ className, ...props }: KbdProps): ReactElement {
  return <kbd data-slot="kbd" className={cn(styles.cap(), className)} {...props} />;
}

/**
 * A key combination, which holds the caps pressed together, such as `⌘` and `K`. Caps nested
 * in an outer `kbd` mark a combination in HTML. Inside an InputGroup addon, the group takes the
 * addon's inner corner and passes it on to its caps. It is a server component.
 */
export function KbdGroup({ className, ...props }: KbdGroupProps): ReactElement {
  return <kbd data-slot="kbd-group" className={cn(styles.group(), className)} {...props} />;
}

Kbd.displayName = "Kbd";
KbdGroup.displayName = "KbdGroup";
