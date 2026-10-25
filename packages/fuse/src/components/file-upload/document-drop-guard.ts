import { isFileDrag } from "./drag-verdict";

/**
 * Keeps a file dropped outside every enabled `FileUpload.Dropzone` from opening in the tab,
 * which would replace the page. Each mounted `FileUpload.Root` registers once, enabled or not,
 * and the document keeps one pair of listeners while any Root holds a registration. A drag
 * that carries no files, such as selected text, passes untouched.
 *
 * The guard answers only a file drag no handler has cancelled, so it reaches drags outside every
 * enabled zone, or inside a disabled one, and leaves other drop targets on the page alone. A
 * Dropzone's `stopPropagation` cannot keep the drag from it: when React's root is the document,
 * as in the Next.js App Router, the zone's handler and the guard listen on the same node. React
 * registers its root listeners before any Root's effect registers the guard, so the guard runs
 * after the zone and reads its cancellation.
 */

const registrations = new WeakMap<Document, number>();

function guardDragOver(event: DragEvent): void {
  if (!event.defaultPrevented && isFileDrag(event.dataTransfer)) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "none";
    }
  }
}

function guardDrop(event: DragEvent): void {
  if (!event.defaultPrevented && isFileDrag(event.dataTransfer)) {
    event.preventDefault();
  }
}

/**
 * Register a Root with the guard of `ownerDocument`.
 *
 * @param ownerDocument - The Root's document.
 * @returns A function that releases this registration. Calling it again does nothing.
 */
export function registerDocumentDropGuard(ownerDocument: Document): () => void {
  const count = registrations.get(ownerDocument) ?? 0;
  if (count === 0) {
    ownerDocument.addEventListener("dragover", guardDragOver);
    ownerDocument.addEventListener("drop", guardDrop);
  }
  registrations.set(ownerDocument, count + 1);
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const remaining = (registrations.get(ownerDocument) ?? 1) - 1;
    registrations.set(ownerDocument, remaining);
    if (remaining === 0) {
      ownerDocument.removeEventListener("dragover", guardDragOver);
      ownerDocument.removeEventListener("drop", guardDrop);
    }
  };
}
