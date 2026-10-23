import * as Accept from "./accept";
import type { FileRules } from "./split-files";

/**
 * What a drag over the Dropzone would deliver, judged before the drop. `"unknown"` means the
 * browser lists no file items, as Safari does until the drop.
 */
export type DragVerdict = "accept" | "reject" | "unknown";

/**
 * Judge a file drag from its items. A drag exposes each item's kind and
 * MIME type but no file name, so the verdict is `"reject"` only when the drop is certain to
 * reject every file. That holds on a single-file Root when more than one file has a known type
 * that passes `accept`, and for files whose types are all known and all miss an `accept` that has
 * no extension token.
 *
 * @param items - The event's `dataTransfer.items`.
 * @param options - The parsed `accept` rule and whether the Root takes several files.
 * @returns `"unknown"` with no file items, `"reject"` when the drop cannot pass, else `"accept"`.
 */
export function dragVerdict(
  items: ArrayLike<{ readonly kind: string; readonly type: string }>,
  options: FileRules
): DragVerdict {
  const files = Array.from(items).filter((item) => item.kind === "file");
  if (files.length === 0) {
    return "unknown";
  }
  // Only an item whose known type passes is certain to survive the type check. An untyped item
  // may be a folder or a file `split` rejects, so it never counts toward the single-file limit.
  const certain = files.filter(
    (item) => item.type !== "" && Accept.matchesMimeType(options.accept, item.type)
  );
  if (!options.multiple && certain.length > 1) {
    return "reject";
  }
  const typesDecide = !Accept.hasExtension(options.accept) && files.every((item) => item.type !== "");
  if (typesDecide && certain.length === 0) {
    return "reject";
  }
  return "accept";
}

/**
 * Whether a drag carries files, which browsers list as the `"Files"` type even while they
 * hide the items, as Safari does until the drop.
 *
 * @param dataTransfer - The event's `dataTransfer`, which a synthetic event may lack.
 * @returns `true` for a drag of files or folders from outside the page.
 */
export function isFileDrag(dataTransfer: { readonly types: readonly string[] } | null): boolean {
  return dataTransfer?.types.includes("Files") === true;
}
