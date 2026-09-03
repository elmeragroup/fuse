/**
 * Package-private class vocabulary shared by every overlay family — the public base-ui
 * Dialog/Sheet and the interim RAC Modal/Dialog alike. Nothing here is exported through
 * `package.json#exports`; it reaches the standalone stylesheet only through the emitted
 * dist modules that import it, which are that sheet's only source (architecture.md §5).
 */

/**
 * One overlay layer for the whole family (dialog.md §8.4): the ref stamps the level on
 * both Backdrop and Popup, we declare it once and share it, so DOM order — not a second
 * z-index step — stacks the Backdrop under the Popup.
 */
export const overlayLayer = "z-50";

/**
 * The 13-value overlay width axis (dialog.md §4), default `md`. `sm`–`7xl` read the
 * Tailwind container variables; no `--container-8xl+` variables exist, so the top three
 * pixel caps stay literal and documented.
 */
export const overlaySizeClasses = {
  sm: "max-w-[min(var(--container-sm),90%)]",
  md: "max-w-[min(var(--container-md),90%)]",
  lg: "max-w-[min(var(--container-lg),90%)]",
  xl: "max-w-[min(var(--container-xl),90%)]",
  "2xl": "max-w-[min(var(--container-2xl),90%)]",
  "3xl": "max-w-[min(var(--container-3xl),90%)]",
  "4xl": "max-w-[min(var(--container-4xl),90%)]",
  "5xl": "max-w-[min(var(--container-5xl),90%)]",
  "6xl": "max-w-[min(var(--container-6xl),90%)]",
  "7xl": "max-w-[min(var(--container-7xl),90%)]",
  // No --container-8xl+ variables exist; the pixel caps stay literal (dialog.md §4).
  "8xl": "max-w-[min(1366px,90%)]",
  "9xl": "max-w-[min(1536px,90%)]",
  "10xl": "max-w-[min(1920px,90%)]",
} as const;

/** The keys of {@link overlaySizeClasses} — the shared overlay width axis. */
export type OverlaySize = keyof typeof overlaySizeClasses;

/**
 * The backdrop scrim (dialog.md §5): `bg-black/10` is deliberately not tokenized and is
 * allowlisted as a raw palette literal; a dark-mode scrim token is on the roadmap. Declared
 * once so the public Dialog backdrop and the interim tier's overlay cannot drift apart.
 */
export const overlayScrimClass = "bg-black/10 supports-backdrop-filter:backdrop-blur-xs";

/** Dialog title typography (dialog.md §2), shared so the interim tier cannot drift. */
export const overlayTitleClass = "text-base font-medium font-heading leading-none text-balance";

/** Dialog footer action row (dialog.md §2), shared with the interim tier's footer slot. */
export const overlayFooterClass = "sm:flex-row sm:justify-end flex flex-col-reverse gap-2";

/**
 * The positioner face of every anchored overlay: one stacking context and the single
 * overlay layer (popover.md §8.4). Site-specific extras — DropdownMenu's `outline-none`,
 * for one — are passed as the extra `cn` argument. Interpolates {@link overlayLayer}
 * rather than restating the layer class, which this module spells exactly once.
 */
export const overlayPositionerClass = `isolate ${overlayLayer}`;

/** The tokenized popup fill and its paired text role (popover.md §5). */
export const overlayPopupFillClass = "bg-popover text-popover-foreground";

/** The popup edge: the `md` elevation rung plus the hairline ring (popover.md §5). */
export const overlayPopupEdgeClass = "shadow-md ring-1 ring-foreground/10";

/**
 * Fill + edge + the `md` radius rung: the whole surface of a popup that sits on the
 * popover role. Intended consumers are Popover, Select (`rounded-lg`), Combobox,
 * DropdownMenu Content/SubContent, PhoneNumberField's country popup, and Dialog
 * (`rounded-xl shadow-lg`) — each overriding a rung through the extra `cn` argument
 * rather than restating the fill and ring.
 *
 * **Not Tooltip.** Tooltip inverts the fill (`bg-foreground text-background`) and paints
 * neither shadow nor ring, and it cannot subtract them here: `ring-0` does not remove
 * `ring-foreground/10`, because tailwind-merge (3.6.0) treats ring width and ring colour
 * as separate conflict groups, so overriding would leave a live token and change
 * Tooltip's rendered set. Tooltip composes {@link overlayPopupMotionClass} only, and
 * takes {@link overlayPopupFillClass}/{@link overlayPopupEdgeClass} as the seam if a
 * future surface of its own is wanted.
 */
export const overlayPopupSurfaceClass = `${overlayPopupFillClass} ${overlayPopupEdgeClass} rounded-md`;

/**
 * The open/close motion set every anchored popup animates with (popover.md §6): the
 * transform origin base-ui publishes, the per-side slide-in, and the fade/zoom pair on
 * `data-open`/`data-closed`. Declared once so a fix to one popup cannot leave the other
 * six behind.
 *
 * The timing rung is deliberately **not** bundled in: six of the seven families pair
 * this with {@link overlayPopupDurationClass}, and Tooltip is the one that ships the set
 * untimed (tooltip.md §6). Composing the rung explicitly keeps that difference visible
 * instead of forcing Tooltip to negate a class it never wanted.
 */
export const overlayPopupMotionClass =
  "origin-(--transform-origin) data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

/**
 * The shared popup timing rung (popover.md §6). Paired with
 * {@link overlayPopupMotionClass} by every family except Tooltip.
 */
export const overlayPopupDurationClass = "duration-100";

/**
 * The geometry, disabled face, and icon sizing an option row shares across Select,
 * Combobox, and DropdownMenu. The *highlight* face is deliberately not here: base-ui
 * publishes it as `focus:` on menu items and `data-highlighted:` on listbox options, so
 * each family passes its own as the extra `cn` argument, along with its horizontal
 * padding (`px-2` for menus, `pr-8 pl-2` for indicator-bearing options).
 */
export const menuItemClass =
  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics, elmera/no-local-focus-ring -- select.md §4: option padding is menu layout, not a control rung; select.md §7: `outline-hidden` only clears the UA outline; this constant carries no highlight face and no ring, both of which stay with the consuming family
  "text-sm relative flex cursor-default items-center gap-2 rounded-sm py-1.5 outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

/** The trailing check slot on a selectable option row, positioned once for all three menu families. */
export const menuItemIndicatorClass = "pointer-events-none absolute right-2 flex items-center justify-center";

/** The hairline rule between option groups, shared by Select, Combobox, and DropdownMenu. */
export const menuSeparatorClass = "-mx-1 my-1 h-px bg-border";

/** The muted caption above an option group, shared by Select, Combobox, and DropdownMenu. */
export const menuGroupLabelClass =
  // oxlint-disable-next-line elmera/no-hardcoded-density-metrics -- select.md §4: group label padding is menu layout, not a control rung
  "text-xs px-2 py-1.5 text-muted-foreground";
