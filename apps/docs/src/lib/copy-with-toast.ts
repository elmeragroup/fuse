import type { CreateToastManagerReturnValue } from "@elmeragroup/fuse/toast";

/** The toasts a copy reports in: a Fuse toast manager. */
export type CopyToasts = Pick<CreateToastManagerReturnValue, "add">;

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
  try {
    // Rejects too where there is no clipboard at all, as on insecure origins.
    await navigator.clipboard.writeText(text);
  } catch {
    toasts.add({ type: "error", title: "Could not copy", description: "The browser refused the clipboard." });
    return;
  }
  toasts.add({ type: "success", title, description });
}
