import { tv } from "../../styles/tv";

/**
 * The filter's one recipe. Each slot names its density role, the row it has in
 * `density-roles.ts`. Layout slots follow the document density through the control and row
 * metrics they read and set none of their own.
 */
export const dataTableFilterVariants = tv({
  slots: {
    /**
     * layout. A transparent row, not Toolbar.Root's bordered surface, since the chips carry the
     * surface. It is the container the narrow layout queries.
     */
    bar: "@container/dtf-bar min-w-0 flex-1",
    /** surface. Never wraps. Only the chips do, so the Trigger and Clear stay on the first line. */
    barRow: "flex min-w-0 items-start gap-(--surface-gap-sm)",
    /**
     * control. An icon and label at full width, a centred square in a narrow bar. The
     * `has-data-[icon]` arm beats Button's own icon-side padding, which sorts earlier at the same
     * weight.
     */
    trigger:
      "shrink-0 @max-[36rem]/dtf-bar:aspect-square @max-[36rem]/dtf-bar:px-0 @max-[36rem]/dtf-bar:has-data-[icon=inline-start]:pl-0",
    /** The Trigger's and Clear's labels, visually hidden in a narrow bar. Their names never change. */
    triggerLabel: "@max-[36rem]/dtf-bar:sr-only",
    /** control. A label at full width, a square icon button at the strip's end in a narrow bar. */
    clear: "shrink-0 @max-[36rem]/dtf-bar:aspect-square @max-[36rem]/dtf-bar:px-0",
    /** Clear's icon, shown only in a narrow bar. */
    clearIcon: "hidden @max-[36rem]/dtf-bar:block",
    /**
     * surface. At full width, a wrapping box between the Trigger and Clear. In a narrow bar, one
     * strip that scrolls sideways under an end fade. The end scroll padding, 2rem, is wider than
     * the 1.5rem fade, and the 2px block padding gives the focus ring room inside the scroll box.
     * Under a coarse pointer the block padding grows to half the gap between a chip and 44px, with
     * a matching negative margin, because the scroll box clips on both axes and would cut each
     * segment's 44px reach. No snapping, which would pull a focused segment back under the fade.
     */
    chips:
      "flex min-w-0 flex-wrap gap-(--surface-gap-sm) @max-[36rem]/dtf-bar:-my-0.5 @max-[36rem]/dtf-bar:flex-1 @max-[36rem]/dtf-bar:scroll-ps-2 @max-[36rem]/dtf-bar:scroll-pe-8 @max-[36rem]/dtf-bar:[scrollbar-width:none] @max-[36rem]/dtf-bar:flex-nowrap @max-[36rem]/dtf-bar:overflow-x-auto @max-[36rem]/dtf-bar:overscroll-x-contain @max-[36rem]/dtf-bar:[mask-image:linear-gradient(to_right,black_calc(100%-1.5rem),transparent)] @max-[36rem]/dtf-bar:py-0.5 @max-[36rem]/dtf-bar:pe-6 @max-[36rem]/dtf-bar:pointer-coarse:-my-[max(2px,calc((44px-var(--control-h-sm))/2))] @max-[36rem]/dtf-bar:pointer-coarse:py-[max(2px,calc((44px-var(--control-h-sm))/2))]",
    /**
     * layout. A sentence of segments in one hairline border at the `rounded-md` rung. It never
     * clips, so a segment's focus ring stays whole. A ghost chip is dashed and muted.
     */
    chip: "text-sm shadow-xs flex h-(--control-h-sm) shrink-0 items-stretch rounded-md border border-border bg-background data-ghost:border-dashed data-ghost:text-muted-foreground",
    /**
     * control. A chip's button: square inside, the last one rounding its end with the chip's
     * corner less the 1px border, a hairline before each, and raised while focused so its ring
     * paints over the neighbour. Under a coarse pointer each reaches 44px tall through
     * `hit-area-*`, vertically only, so neighbouring hit areas never overlap.
     */
    segment:
      "h-full rounded-none border-0 border-s border-s-border last:rounded-e-[calc(var(--radius-md)-1px)] focus-visible:relative focus-visible:z-10 pointer-coarse:hit-area-[max(0px,calc((44px_-_100%)/2))] pointer-coarse:[--hit-area-l:0px] pointer-coarse:[--hit-area-r:0px]",
    /** control. Static text, the field's icon and name. Not focusable. */
    subject:
      "font-medium flex items-center gap-(--control-gap-sm) px-(--control-px-sm) whitespace-nowrap select-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
    /** control. The operator reads quieter than the subject and the value. */
    operator: "font-normal text-muted-foreground",
    /** control. The summary truncates, and tabular numerals keep number and date summaries still. */
    value: "max-w-56 min-w-0 gap-(--control-gap-sm) tabular-nums",
    /** The summary text inside the value segment. */
    valueText: "min-w-0 truncate",
    /** fixed. Up to three option icons before the summary. */
    valueIcons: "flex shrink-0 items-center gap-px",
    /**
     * The search group above an option list. The group is a field box that publishes its own
     * inner corner, so the wrapper captures the popup's inner corner and hands it to the group as
     * its `--field-corner`, which keeps the group's addons concentric too. 44px tall under a
     * coarse pointer.
     */
    search:
      "shrink-0 [--dtf-search-corner:var(--inner-corner)] *:data-[slot=input-group]:h-(--control-h-sm) *:data-[slot=input-group]:w-full *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none *:data-[slot=input-group]:[--field-corner:var(--dtf-search-corner)] pointer-coarse:*:data-[slot=input-group]:h-[2.75rem]",
    /**
     * surface. The add menu and each value submenu: the menu shell at one fixed width, so typing
     * and a drill never resize it sideways. The list scrolls inside. Its height follows the results
     * and snaps on a keystroke, and the step change between the field list and an editor morphs it
     * through `transition-[height]`.
     */
    menu: "ease-out box-border flex max-h-[min(24rem,var(--available-height))] w-72 max-w-(--available-width) flex-col overflow-hidden transition-[height] duration-100",
    /** layout. A menu list: it scrolls inside the popup, never the page. */
    list: "-mx-(--surface-pad-sm) mt-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-(--surface-pad-sm) [&_[role=group][hidden]]:hidden",
    /**
     * row. A menu row lights on `data-highlighted`, not on focus, since a filtering menu keeps real
     * focus in its search and moves a virtual highlight. 44px tall under a coarse pointer.
     */
    row: "data-highlighted:bg-accent data-highlighted:text-accent-foreground pointer-coarse:min-h-11",
    /** row. A field row stays lit while its value submenu is open. */
    fieldRow: "data-popup-open:bg-accent data-popup-open:text-accent-foreground",
    /** The caret at the end of a field row, which leads to a further step. */
    caret: "ms-auto text-muted-foreground",
    /** row. A value row. A count of 0 mutes its label too. */
    option: "data-zero:text-muted-foreground",
    /** The dot on a field row whose field already has a filter. */
    activeDot: "ms-auto size-[6px] shrink-0 rounded-full bg-primary",
    /** The field's name before a quick-search value, "Status ›". */
    pathSeparator: "text-muted-foreground",
    /** The empty state of a menu list. */
    empty: "text-sm px-(--row-px) py-2 text-muted-foreground",
    /**
     * The status under a menu list that shows only its first matches. A status, so a screen
     * reader hears it appear, and outside the list, so it is never an item.
     */
    narrowHint:
      "text-xs -mx-(--surface-pad-sm) mt-1 shrink-0 border-t border-border px-[calc(var(--row-px)+var(--surface-pad-sm))] pt-1.5 pb-0.5 text-muted-foreground empty:hidden",
    /**
     * The in-place editor cancels the menu shell's padding, so its header and body reach the edge,
     * and it shrinks to the menu's height cap, where its body scrolls.
     */
    menuEditor: "-m-(--surface-pad-sm) min-h-0 flex-1",
    /**
     * control. Back, rounding with the inner corner. Under a coarse pointer it reaches 44px
     * through `hit-area-*`, and nothing interactive sits within its reach.
     */
    back: "shrink-0 rounded-inner pointer-coarse:hit-area-[max(0px,calc((44px_-_100%)/2))]",
    /** fixed. A count right-aligned in tabular numerals, in a column that never collapses. */
    count: "text-xs ms-auto min-w-[3ch] shrink-0 text-end text-muted-foreground tabular-nums",
    /**
     * surface. The value popover, one popup for every chip's editor at a fixed width.
     *
     * It stays in flow on every side. With a Viewport inside, Base UI writes `position: absolute;
     * bottom: 0` on a top-side popup while it measures (`usePopupAutoResize.ts`). The positioner
     * then collapses, Floating UI finds room below and flips the popup. The `!` beats that inline
     * style.
     *
     * Its height follows Base UI's `--popup-height`, which Base UI writes on a trigger change, so
     * a move from chip to chip morphs, and an editor's own growth snaps. Base UI writes the new
     * height a frame after the move, so under reduced motion the height follows the content and
     * the move lands in one frame. It caps at 32rem or the room the viewport leaves, and the
     * Viewport and the editor shrink with it, so a tall editor's body scrolls under its header.
     * No padding, so it publishes its rows' real 4px inset instead of the popover shell's padded
     * corner.
     */
    content:
      "ease-out relative! bottom-auto! flex h-[var(--popup-height,auto)] max-h-[min(32rem,var(--available-height))] w-72 max-w-(--available-width) flex-col overflow-clip p-0 transition-[height] [--shell-inner:max(0px,--theme(--radius-md)-0.25rem)] motion-reduce:h-auto",
    /** The positioner glides between chips on a trigger change. */
    positioner: "ease-out transition-[top,left] duration-100",
    /**
     * Cross-fades the previous and the current editor on a trigger change, and hands the popup's
     * height cap down to the current editor.
     */
    viewport:
      "relative flex min-h-0 flex-col [&>[data-current]]:flex [&>[data-current]]:min-h-0 [&>[data-current]]:flex-col [&>[data-current]]:transition-opacity [&>[data-current]]:duration-100 [&>[data-current][data-starting-style]]:opacity-0 [&>[data-previous]]:inset-x-0 [&>[data-previous]]:top-0 [&>[data-previous]]:transition-opacity [&>[data-previous]]:duration-100 [&>[data-previous][data-ending-style]]:opacity-0",
    /** surface. An editor: the header, then its body. */
    editor: "flex min-h-0 flex-col",
    /**
     * layout. The editor's body: the kind editors. It scrolls inside the popup when a tall one,
     * such as a calendar, meets the height cap, and the header stays put above it.
     */
    editorBody: "min-h-0 flex-1 overflow-y-auto overscroll-contain",
    /**
     * surface. The editor's header, the title and the operator. Under a coarse pointer its padding
     * grows to half the gap between a small control and 44px, so the 44px reach of Back and the
     * operator stays inside the popup, which clips.
     */
    header:
      "flex items-center gap-(--surface-pad-sm) border-b border-border p-(--surface-pad-sm) pointer-coarse:p-[max(var(--surface-pad-sm),calc((44px-var(--control-h-sm))/2))]",
    /** The field's icon and name, the popover's title. */
    title:
      "text-sm font-medium flex min-w-0 flex-1 items-center gap-(--control-gap-sm) px-(--control-px-icon-sm) [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
    /** The title's text. */
    titleText: "truncate",
    /** control. The header's operator, the chip operator's quiet face, at the header's end. */
    headerOperator:
      "font-normal shrink-0 rounded-inner text-muted-foreground pointer-coarse:hit-area-[max(0px,calc((44px_-_100%)/2))] pointer-coarse:[--hit-area-l:0px] pointer-coarse:[--hit-area-r:0px]",
    /** surface. A text, number or date editor's body. */
    body: "flex flex-col gap-(--surface-gap-md) p-(--surface-pad-md)",
    /** The text editor's Enter hint. */
    hint: "text-xs flex items-center gap-(--control-gap-sm) text-muted-foreground",
    /** The date presets, wrapping. */
    presets: "flex flex-wrap gap-(--surface-pad-sm)",
    /** Two date inputs side by side. */
    dateFields: "grid grid-cols-2 gap-(--surface-gap-sm)",
    /** A date input's Field, its label above the input in the popup's small type. */
    dateField:
      "*:data-[slot=field-label]:text-xs gap-(--surface-pad-sm) *:data-[slot=field-label]:text-muted-foreground",
    /** Number fields stack, since a formatted amount and two steppers need the full width. */
    numberStack: "flex flex-col gap-(--surface-gap-sm)",
    /** layout. The option editor: its search, list and status. */
    optionEditor: "group/combobox-content flex flex-col",
    /** The option editor's search, 4px inside the popover. */
    editorSearch: "px-(--surface-pad-sm) pt-(--surface-pad-sm)",
    /** row. An option editor row. A count of 0 mutes its label too. */
    editorOption: "gap-(--control-gap-md) data-zero:text-muted-foreground",
    /** The option editor's empty state. */
    editorEmpty: "flex empty:hidden",
    /**
     * The status under a list that shows only its first matches. A status, so a screen reader
     * hears it appear, and outside the list, so it is never an option.
     */
    editorNarrowHint:
      "text-xs shrink-0 border-t border-border px-(--surface-pad-md) pt-1.5 pb-2 text-muted-foreground empty:hidden",
  },
});

/** The recipe's slots, resolved once, since it has no axes. */
export const dataTableFilterSlots = dataTableFilterVariants();
