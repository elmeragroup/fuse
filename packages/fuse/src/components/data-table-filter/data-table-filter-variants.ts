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
    /** surface. One line that never wraps, so the bar keeps its height whatever the filter count. */
    barRow: "flex min-w-0 items-start gap-(--surface-gap-sm)",
    /** control. A square icon button at every width, or a consumer's labelled one. */
    trigger: "shrink-0",
    /** control. A label at full width, a square icon button after the strip in a narrow bar. */
    clear: "shrink-0 @max-[36rem]/dtf-bar:aspect-square @max-[36rem]/dtf-bar:px-0",
    /** Clear's label, visually hidden in a narrow bar. Its name never changes. */
    clearLabel: "@max-[36rem]/dtf-bar:sr-only",
    /** Clear's icon, shown only in a narrow bar. */
    clearIcon: "hidden @max-[36rem]/dtf-bar:block",
    /**
     * surface. One strip between the Trigger and Clear that scrolls sideways at every width. It
     * shrinks but never grows, so Clear follows the last chip until the chips overflow. Its ends
     * fade only while chips hide past them. Both scroll paddings, 2rem, are wider than the 1.5rem
     * fade, so a segment scrolled into view never lands under it. The 2px padding gives the focus
     * ring room inside the scroll box, and the matching negative margin keeps the chips where they
     * would sit without it. Where the end fade is static, the end padding widens to the fade.
     * Under a coarse pointer the block padding grows to half the gap between a chip and 44px,
     * because the scroll box clips on both axes and would cut each segment's 44px reach. No
     * snapping, which would pull a focused segment back under a fade.
     */
    chips:
      "-m-0.5 no-scrollbar flex scroll-fade-inline scroll-px-8 gap-(--surface-gap-sm) overflow-x-auto overscroll-x-contain p-0.5 not-supports-[animation-timeline:scroll()]:pe-(--scroll-fade-size) pointer-coarse:-my-[max(2px,calc((44px-var(--control-h-sm))/2))] pointer-coarse:py-[max(2px,calc((44px-var(--control-h-sm))/2))]",
    /**
     * layout. A sentence of segments in one hairline border at the `rounded-md` rung. It never
     * clips, so a segment's focus ring stays whole. A ghost chip is dashed and muted. It rests
     * transparent, as the outline Trigger beside it does, so both show the surface beneath them.
     */
    chip: "text-sm shadow-xs flex h-(--control-h-sm) shrink-0 items-stretch rounded-md border border-border bg-transparent data-ghost:border-dashed data-ghost:text-muted-foreground",
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
     * never resizes it sideways. The list scrolls inside. Its height follows the results and snaps
     * on a keystroke. On the editor step the shell takes the editor's own width and a taller cap,
     * and the step change between the field list and an editor morphs both through
     * `transition-[height,width]`.
     */
    menu: "ease-out box-border flex max-h-[min(24rem,var(--available-height))] w-72 max-w-(--available-width) flex-col overflow-hidden transition-[height,width] duration-100 data-[step=editor]:max-h-[min(32rem,var(--available-height))] data-[step=editor]:w-max",
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
     * surface. The status under a menu list that shows only its first matches. A status, so a
     * screen reader hears it appear, and outside the list, so it is never an item.
     */
    narrowHint:
      "text-xs -mx-(--surface-pad-sm) mt-1 shrink-0 border-t border-border px-[calc(var(--row-px)+var(--surface-pad-sm))] pt-1.5 pb-0.5 text-muted-foreground empty:hidden",
    /**
     * The in-place editor cancels the menu shell's padding, so its header and body reach the edge,
     * its width cap reaches over that padding too, and it shrinks to the menu's height cap, where
     * its body scrolls.
     */
    menuEditor: "-m-(--surface-pad-sm) min-h-0 max-w-[calc(100%+2*var(--surface-pad-sm))] flex-1",
    /**
     * control. Back, rounding with the inner corner. Under a coarse pointer it reaches 44px
     * through `hit-area-*`, and nothing interactive sits within its reach.
     */
    back: "shrink-0 rounded-inner pointer-coarse:hit-area-[max(0px,calc((44px_-_100%)/2))]",
    /** fixed. A count right-aligned in tabular numerals, in a column that never collapses. */
    count: "text-xs ms-auto min-w-[3ch] shrink-0 text-end text-muted-foreground tabular-nums",
    /**
     * surface. The value popover, one popup for every chip's editor, as wide as the editor.
     *
     * It stays in flow on every side. With a Viewport inside, Base UI writes `position: absolute;
     * bottom: 0` on a top-side popup while it measures (`usePopupAutoResize.ts`). The positioner
     * then collapses, Floating UI finds room below and flips the popup. The `!` beats that inline
     * style.
     *
     * Its size follows Base UI's `--popup-width` and `--popup-height`, which Base UI writes on a
     * trigger change, so a move from chip to chip morphs, and an editor's own growth snaps. Base UI
     * writes the new size a frame after the move, so under reduced motion the size follows the
     * content and the move lands in one frame. It caps at 32rem or the room the viewport leaves,
     * and the Viewport and the editor shrink with it, so a tall editor's body scrolls under its
     * header. No padding, so it publishes its rows' real 4px inset instead of the popover shell's
     * padded corner.
     */
    content:
      "ease-out relative! bottom-auto! flex h-[var(--popup-height,auto)] max-h-[min(32rem,var(--available-height))] w-[var(--popup-width,max-content)] max-w-(--available-width) flex-col overflow-clip p-0 transition-[height,width] [--shell-inner:max(0px,--theme(--radius-md)-0.25rem)] motion-reduce:h-auto motion-reduce:w-max",
    /** The positioner glides between chips on a trigger change. */
    positioner: "ease-out transition-[top,left] duration-100",
    /**
     * Cross-fades the previous and the current editor on a trigger change, and hands the popup's
     * height cap down to the current editor.
     */
    viewport:
      "relative flex min-h-0 flex-col [&>[data-current]]:flex [&>[data-current]]:min-h-0 [&>[data-current]]:flex-col [&>[data-current]]:transition-opacity [&>[data-current]]:duration-100 [&>[data-current][data-starting-style]]:opacity-0 [&>[data-previous]]:inset-x-0 [&>[data-previous]]:top-0 [&>[data-previous]]:transition-opacity [&>[data-previous]]:duration-100 [&>[data-previous][data-ending-style]]:opacity-0",
    /**
     * surface. An editor: the header, then its body. It sets the width both popups take, 18rem,
     * and a date editor with its presets beside a slot widens it to that layout, never below 18rem.
     * A popup the viewport narrows narrows it too. The cap is a percentage, which a popup's
     * intrinsic size ignores, since Base UI measures the value popover with `--available-width` at
     * `max-content`.
     */
    editor:
      "flex min-h-0 w-72 max-w-full flex-col has-data-[presets=beside]:w-max has-data-[presets=beside]:min-w-72",
    /**
     * layout. The editor's body: the kind editors. It scrolls inside the popup when a tall one,
     * such as a calendar, meets the height cap, and the header stays put above it. An option editor
     * with a values footer shrinks in it instead, so its list scrolls and the footer stays in view.
     */
    editorBody:
      "min-h-0 flex-1 overflow-y-auto overscroll-contain has-data-[slot=data-table-filter-values-footer]:flex has-data-[slot=data-table-filter-values-footer]:flex-col",
    /**
     * surface. The editor's header, the title and the operator. Under a coarse pointer its padding
     * grows to half the gap between a small control and 44px, so the 44px reach of Back and the
     * operator stays inside the popup, which clips. Its inline size is contained, so a long title
     * truncates instead of widening an editor that takes its body's width.
     */
    header:
      "flex items-center gap-(--surface-pad-sm) border-b border-border p-(--surface-pad-sm) contain-inline-size pointer-coarse:p-[max(var(--surface-pad-sm),calc((44px-var(--control-h-sm))/2))]",
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
    /** The date presets, wrapping above the date inputs or a narrow viewport's slot. */
    presets: "flex flex-wrap gap-(--surface-pad-sm)",
    /**
     * layout. A date editor with its presets beside the slot, as the date pickers set their preset
     * pane beside the calendar. No padding, so the divider runs from the header to the popup's
     * edge. The presets and the slot carry their own insets.
     */
    dateBeside: "flex",
    /** The presets beside the slot: a column of ghost toggles behind the divider. */
    presetsBeside: "shrink-0 gap-(--surface-pad-sm) rounded-none border-e border-border p-(--surface-pad-sm)",
    /**
     * control. A preset in the column, the date pickers' preset face: start-aligned, rounding with
     * the inner corner, and lit with the accent while pressed.
     */
    presetBeside: "justify-start rounded-inner data-pressed:bg-accent data-pressed:text-accent-foreground",
    /** The wrapper of a date editor's function child, boxless under the presets. */
    dateSlot: "contents",
    /** The wrapper beside the presets, at the editor body's inset. */
    dateSlotBeside: "p-(--surface-pad-md)",
    /** Two date inputs side by side. */
    dateFields: "grid grid-cols-2 gap-(--surface-gap-sm)",
    /** A date input's Field, its label above the input in the popup's small type. */
    dateField: "*:data-[slot=field-label]:text-xs *:data-[slot=field-label]:text-muted-foreground",
    /** Number fields stack, since a formatted amount and two steppers need the full width. */
    numberStack: "flex flex-col gap-(--surface-gap-sm)",
    /**
     * layout. The option editor: its search, list, status and the consumer's values footer. With
     * a footer it shrinks to the popup's height cap, where its list scrolls, a scroll container
     * whose minimum height is 0, and the footer stays below it.
     */
    optionEditor:
      "group/combobox-content flex flex-col has-data-[slot=data-table-filter-values-footer]:min-h-0",
    /** The option editor's search, 4px inside the popover. */
    editorSearch: "px-(--surface-pad-sm) pt-(--surface-pad-sm)",
    /** row. An option editor row. A count of 0 mutes its label too. */
    editorOption: "gap-(--control-gap-md) data-zero:text-muted-foreground",
    /** The option editor's empty state. */
    editorEmpty: "flex empty:hidden",
    /**
     * surface. The status under a list that shows only its first matches. A status, so a screen
     * reader hears it appear, and outside the list, so it is never an option.
     */
    editorNarrowHint:
      "text-xs shrink-0 border-t border-border px-(--surface-pad-md) pt-1.5 pb-2 text-muted-foreground empty:hidden",
    /**
     * surface. The values footer under a value list: its actions in one row behind a hairline that
     * matches the menu separator, outside the scrolling list, so it stays in view at the popup's
     * height cap. In a value submenu it reaches across the menu shell's padding and sits on the
     * shell's bottom padding. In the value popover, which has no padding, it pads itself.
     */
    valuesFooter:
      "-mx-(--surface-pad-sm) mt-1 flex shrink-0 items-center gap-(--surface-gap-sm) border-t border-border px-(--surface-pad-sm) pt-(--surface-pad-sm) in-data-[slot=data-table-filter-option-editor]:mx-0 in-data-[slot=data-table-filter-option-editor]:pb-(--surface-pad-sm)",
    /** control. Done, the footer's last action, at its inline end. */
    done: "ms-auto",
  },
});

/** The recipe's slots, resolved once, since it has no axes. */
export const dataTableFilterSlots = dataTableFilterVariants();
