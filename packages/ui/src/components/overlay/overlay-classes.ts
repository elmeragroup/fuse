/**
 * Package-private class vocabulary shared by every overlay family — the public base-ui
 * Dialog/Sheet and the interim RAC Modal/Dialog alike. Nothing here is exported through
 * `package.json#exports`; it lives outside `src/react-aria/**` on purpose so the
 * standalone stylesheet's `@source not "../src/react-aria/**"` exclusion keeps
 * describing only the published JS (architecture.md §5).
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

/** Dialog title typography (dialog.md §2), shared so the interim tier cannot drift. */
export const overlayTitleClass = "text-base font-medium font-heading leading-none text-balance";

/** Dialog footer action row (dialog.md §2), shared with the interim tier's footer slot. */
export const overlayFooterClass = "sm:flex-row sm:justify-end flex flex-col-reverse gap-2";
