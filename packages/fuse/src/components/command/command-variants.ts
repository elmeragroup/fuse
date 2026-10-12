import { cn } from "../../styles/cn";
import { tv } from "../../styles/tv";
import { menuItemClass } from "../overlay/menu-row-classes";

/**
 * Module-private recipe for the palette's parts. The palette box pads nothing: the input sits
 * one small surface tier in from the box's edges, the list pads its rows with the same tier
 * (`styles/inner-corner/command.ts`), and the footer pads its hints so their text lines up with
 * the rows' text.
 *
 * - `input` is the InputGroup field box, inset from the palette's edges.
 * - `list` scrolls; in a palette box it takes the room the input and footer leave.
 * - `item` is the shared menu row, highlighted by Base UI's `data-highlighted`.
 * - `empty` is a row-inset message that collapses while the list has matches.
 * - `footer` and `hint` lay out the key hints under the list.
 * - `content` is the palette popup's layout, placed near the top of the viewport so the input
 *   stays put while the results shrink. `Command.Content` composes it after the modal face it
 *   shares with Dialog, which brings the surface, elevation and motion.
 */
export const commandVariants = tv({
  slots: {
    input: "m-(--surface-pad-sm) mb-0 w-auto shrink-0",
    list: "max-h-80 min-h-0 flex-1 scroll-py-(--surface-pad-sm) overflow-y-auto overscroll-contain",
    item: cn(
      menuItemClass,
      // oxlint-disable-next-line elmera/no-local-focus-ring -- the highlight face menuItemClass leaves to the family; base-ui spells it `data-highlighted:` on listbox options
      "w-full data-highlighted:bg-accent data-highlighted:text-accent-foreground"
    ),
    trailing: "ms-auto text-muted-foreground in-data-highlighted:text-accent-foreground",
    empty: "text-sm px-(--row-px) py-6 text-center text-muted-foreground empty:p-0",
    footer:
      "text-xs flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-[calc(var(--surface-pad-sm)+var(--row-px))] py-(--row-py) text-muted-foreground",
    hint: "inline-flex items-center gap-1.5",
    content:
      "max-w-xl fixed top-[max(--spacing(4),12dvh)] left-1/2 flex max-h-[calc(100dvh-2*max(--spacing(4),12dvh))] w-[calc(100%-2rem)] -translate-x-1/2 flex-col overflow-hidden",
  },
});
