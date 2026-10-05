import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

const kbd = tv({
  slots: {
    keys: "inline-flex items-center gap-0.5",
    key: "text-2xs font-medium inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-sm border border-border bg-muted px-1 font-sans text-muted-foreground tabular-nums",
  },
});

const styles = kbd();

export type KbdProps = {
  /** The keys in press order, such as `["⌘", "K"]`. */
  keys: readonly string[];
};

/**
 * A keyboard shortcut hint, one cap per key. Decorative: the control it annotates carries the
 * shortcut in `aria-keyshortcuts`, so the caps are hidden from assistive technology.
 * Fuse has no Kbd part yet (TODO.md), so the landing composes this one.
 */
export function Kbd({ keys }: KbdProps): ReactElement {
  return (
    <span aria-hidden className={styles.keys()}>
      {keys.map((key) => (
        <kbd key={key} className={styles.key()}>
          {key}
        </kbd>
      ))}
    </span>
  );
}
