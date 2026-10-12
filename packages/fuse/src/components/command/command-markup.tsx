import type { ComponentProps, ReactElement } from "react";

import { cn } from "../../styles/cn";
import { KbdGroup } from "../kbd/kbd";
import type { KbdGroupProps } from "../kbd/kbd";
import { commandVariants } from "./command-variants";

// The palette's stateless markup. These parts hold no state and read no context, so they stay
// server components that a server tree can render inside the client palette.

const styles = commandVariants();

/** Props of `Command.Footer`: a native `div`'s. */
export type CommandFooterProps = ComponentProps<"div">;
/** Props of `Command.Hint`: a native `span`'s. */
export type CommandHintProps = ComponentProps<"span">;
/** Props of `Command.Shortcut`: `KbdGroup`'s. */
export type CommandShortcutProps = KbdGroupProps;

/**
 * The strip under the list for key hints. It pads its content so the hints' text lines up with
 * the rows' text. Server component.
 */
export function CommandFooter({ className, ...props }: CommandFooterProps): ReactElement {
  return <div data-slot="command-footer" className={cn(styles.footer(), className)} {...props} />;
}

/**
 * One key hint: its `Kbd` caps and a label, such as the caps for `↵` and "Open". A hint repeats
 * what the palette's own roles already tell assistive technology, so it is `aria-hidden`.
 * Server component.
 */
export function CommandHint({ className, ...props }: CommandHintProps): ReactElement {
  return <span data-slot="command-hint" aria-hidden className={cn(styles.hint(), className)} {...props} />;
}

/**
 * A row's keyboard shortcut, pushed to the row's end: the caps of one combination. It is
 * decorative, so it is `aria-hidden`; put the same shortcut on the row in `aria-keyshortcuts`,
 * such as `aria-keyshortcuts="Control+N"`. Server component.
 */
export function CommandShortcut({ className, ...props }: CommandShortcutProps): ReactElement {
  return (
    <KbdGroup
      data-slot="command-shortcut"
      aria-hidden
      className={cn(styles.trailing(), className)}
      {...props}
    />
  );
}

CommandFooter.displayName = "Command.Footer";
CommandHint.displayName = "Command.Hint";
CommandShortcut.displayName = "Command.Shortcut";
