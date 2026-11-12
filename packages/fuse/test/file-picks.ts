// Pick, paste and file fixtures for the suites that run FileUpload's pick path: FileUpload's own
// and FileTrigger's. One simulation keeps both suites proving the same browser behavior.
import { vi } from "vitest";

import type { FileRejection } from "../src/components/file-upload/split-files";

/**
 * The hidden picker input inside `host`. It is `hidden`, so it is outside the accessibility tree
 * and no role or name finds it. The separate input a form posts and validates is visually hidden
 * instead, never `hidden`.
 *
 * @param host - The rendered container to search.
 * @returns The picker input.
 * @throws When `host` holds no picker input, a defect in the render under test.
 */
export function fileInput(host: HTMLElement): HTMLInputElement {
  const input = host.querySelector('input[type="file"][hidden]');
  if (!(input instanceof HTMLInputElement)) {
    throw new Error("expected a hidden file picker input");
  }
  return input;
}

/**
 * Stubs the hidden picker input's `click`, which would open the picker, so a test can count opens.
 *
 * @param host - The rendered container holding the picker input.
 * @returns The spy on the input's `click`.
 */
export function stubPicker(host: HTMLElement) {
  return vi.spyOn(fileInput(host), "click").mockReturnValue(undefined);
}

/**
 * A `DataTransfer` carrying `files`, as a pick, paste or drop delivers them.
 *
 * @param files - The files to carry, in order.
 * @returns The transfer.
 */
export function fileTransfer(files: readonly File[]): DataTransfer {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  return transfer;
}

/**
 * Picks `files` the way the browser does: it sets `input.files`, then fires a bubbling `change`.
 *
 * @param input - The picker input.
 * @param files - The picked files, in order.
 */
export function pick(input: HTMLInputElement, files: readonly File[]): void {
  input.files = fileTransfer(files).files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Dispatches a paste carrying `files` at `target`, and returns the event to read its outcome.
 * FileUpload cancels a paste it takes before it reads the files, so an uncancelled paste delivered
 * nothing.
 *
 * @param target - Where the paste lands, such as `document.body` or a focused field.
 * @param files - The pasted files, in order.
 * @returns The dispatched event.
 */
export function paste(target: EventTarget, files: readonly File[]): ClipboardEvent {
  // A browser's paste is composed, so it leaves a shadow root on its way to the document.
  const event = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    composed: true,
    clipboardData: fileTransfer(files),
  });
  target.dispatchEvent(event);
  return event;
}

/**
 * A PNG image file.
 *
 * @param name - The file name.
 * @returns A file of type `image/png`.
 */
export const png = (name: string) => new File(["png"], name, { type: "image/png" });

/**
 * A plain-text file.
 *
 * @param name - The file name.
 * @returns A file of type `text/plain`.
 */
export const txt = (name: string) => new File(["txt"], name, { type: "text/plain" });

/**
 * A file the browser gave no MIME type, so only its `.pdf` extension can match `accept`.
 *
 * @param name - The file name.
 * @returns A file with an empty type.
 */
export const pdf = (name: string) => new File(["pdf"], name, { type: "" });

/**
 * A rejection as `[reason, name]`, for comparing rejections by value.
 *
 * @param rejection - The rejection to describe.
 * @returns The rejection's reason and the rejected file's or entry's name.
 */
export function described(rejection: FileRejection): readonly [string, string] {
  return "file" in rejection ? [rejection.reason, rejection.file.name] : [rejection.reason, rejection.name];
}
