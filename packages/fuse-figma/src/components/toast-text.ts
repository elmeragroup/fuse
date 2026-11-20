/**
 * The docs Toast default demo's copy, host and viewport classes, and the statuses the kit draws, free
 * of imports for the client bundle, which `toast-kit.ts` draws and `compare/toast-cell.ts` renders.
 */

/** The demo's title. */
export const TOAST_TITLE = "Draft saved";

/** The demo's description. */
export const TOAST_DESCRIPTION = "You can finish it later.";

/**
 * The classes the default demo passes, by the element that takes them: the `max-w-sm` box the stack
 * sits in, and the viewport it holds at its bottom right, full width.
 */
export const TOAST_DEMO_CLASSES = {
  host: "max-w-sm relative min-h-[28rem] w-full",
  viewport: "sm:right-0 sm:bottom-0 sm:w-full absolute right-0 bottom-0 w-full",
} as const;

/** The width the demo's `max-w-sm` box gives the stack. */
export const TOAST_PREVIEW_WIDTH = 384;

/**
 * The statuses a toast's `type` sets, neutral first, then in the order the docs page's examples
 * show them.
 */
export const TOAST_STATUSES = ["neutral", "info", "success", "warning", "error", "loading"] as const;

/** A status the kit draws. */
export type ToastStatus = (typeof TOAST_STATUSES)[number];

/**
 * The status a cell names.
 *
 * @param value - The cell's `status`.
 * @returns The status, or neutral for a cell that names none of them, as Fuse's Toast reads an
 *   unknown `type`.
 */
export function toastStatus(value: string | undefined): ToastStatus {
  return TOAST_STATUSES.find((status) => status === value) ?? "neutral";
}
