import type { ComponentProps, ReactElement, ReactNode } from "react";

import { cn } from "../../styles/cn";
import { kbdVariants } from "./kbd-variants";

const styles = kbdVariants();

/** `Kbd` takes a native `kbd` element's props. */
export type KbdProps = Omit<ComponentProps<"kbd">, "children" | "aria-hidden"> & {
  /**
   * The key: a word such as `Esc`, a glyph such as `⌘`, or an icon. Kbd never detects the
   * platform, so the server and the browser render the same cap. Pass `⌘` or `Ctrl` yourself
   * where your app knows the platform.
   */
  children?: ReactNode;
  /**
   * Hides the cap from screen readers, which read it otherwise. Set it when the cap only repeats
   * a shortcut that its control declares in `aria-keyshortcuts`.
   */
  "aria-hidden"?: ComponentProps<"kbd">["aria-hidden"];
};

/** `KbdGroup` takes a native `kbd` element's props. */
export type KbdGroupProps = Omit<ComponentProps<"kbd">, "children"> & {
  /**
   * The `Kbd` caps of one combination, pressed together. In an `InputGroup` addon, make the group,
   * or a lone cap, the addon's direct child, so the caps round with the addon's inner corner.
   */
  children?: ReactNode;
};

/** One key cap, such as `Esc`, as a `<kbd>` element. */
export function Kbd({ className, ...props }: KbdProps): ReactElement {
  return <kbd data-slot="kbd" className={cn(styles.cap(), className)} {...props} />;
}

/**
 * A key combination, such as `⌘` and `K`, as caps inside an outer `<kbd>`, which is how HTML
 * marks keys pressed together.
 */
export function KbdGroup({ className, ...props }: KbdGroupProps): ReactElement {
  return <kbd data-slot="kbd-group" className={cn(styles.group(), className)} {...props} />;
}

Kbd.displayName = "Kbd";
KbdGroup.displayName = "KbdGroup";
