import type { CreateToastManagerReturnValue } from "@elmeragroup/fuse/toast";

/** The toasts a copy reports in: a Fuse toast manager. */
export type CopyToasts = Pick<CreateToastManagerReturnValue, "add">;

/**
 * Puts `text` on the clipboard.
 *
 * @param text - What to copy.
 * @returns Whether the browser took it: `false` where it refuses the clipboard or has none.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    // Rejects too where there is no clipboard at all, as on insecure origins.
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Puts `text` on the clipboard and reports the outcome in `toasts`: a success titled `title`, or
 * an error when the browser refuses the clipboard.
 *
 * @param toasts - Where the outcome shows.
 * @param text - What to copy.
 * @param title - The success toast's title.
 * @param description - The success toast's description, if it has one.
 */
export async function copyWithToast(
  toasts: CopyToasts,
  text: string,
  title: string,
  description?: string
): Promise<void> {
  if (await copyText(text)) {
    toasts.add({ type: "success", title, description });
  } else {
    toasts.add({ type: "error", title: "Could not copy", description: "The browser refused the clipboard." });
  }
}
