import * as Accept from "./accept";

/**
 * Why a file or folder did not reach `onSelect`.
 *
 * - `"type"` means the file failed `accept`.
 * - `"count"` means a Root without `multiple` received more than one file that passed `accept`.
 * - `"directory"` means a folder arrived while `directory` is off.
 * - `"unreadable"` means the browser failed to read a file or folder inside a dropped folder.
 *   `name` is its path from the dropped folder, as in `folder/sub/name.ext`.
 */
export type FileRejection =
  | { readonly reason: "type" | "count"; readonly file: File }
  | { readonly reason: "directory" | "unreadable"; readonly name: string };

/**
 * One picked, dropped or pasted item, in the order the source listed it. An `"unreadable"`
 * entry is a file or folder the browser failed to read, named by its relative path.
 */
export type SplitEntry =
  | { readonly kind: "file"; readonly file: File }
  | { readonly kind: "directory" | "unreadable"; readonly name: string };

/** The rules a {@link split} applies, and a drag's verdict judges by. */
export type FileRules = {
  /** The parsed `accept` attribute. */
  readonly accept: Accept.AcceptRule;
  /** Whether more than one file may pass. */
  readonly multiple: boolean;
};

/** The outcome of a {@link split}. Each list keeps the input order. */
export type SplitResult = {
  /** The files `onSelect` receives. */
  readonly accepted: File[];
  /** The rejections `onReject` receives. */
  readonly rejected: FileRejection[];
};

/**
 * Decide which entries reach `onSelect` and which reach `onReject`. It rejects a folder with
 * `"directory"`, an unreadable entry with `"unreadable"` and a file that fails `accept` with `"type"`. When `multiple` is off and more
 * than one file is left, it rejects every one of them with `"count"`.
 *
 * @param entries - The entries in input order.
 * @param options - The parsed `accept` rule and whether the Root takes several files.
 * @returns Fresh `accepted` and `rejected` arrays, both in input order.
 */
export function split(entries: readonly SplitEntry[], options: FileRules): SplitResult {
  const typed = entries.map((entry): File | FileRejection => {
    if (entry.kind !== "file") {
      return { reason: entry.kind, name: entry.name };
    }
    return Accept.matchesFile(options.accept, entry.file) ? entry.file : { reason: "type", file: entry.file };
  });
  const tooMany = !options.multiple && typed.filter((each) => !("reason" in each)).length > 1;
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  for (const each of typed) {
    if ("reason" in each) {
      rejected.push(each);
    } else if (tooMany) {
      rejected.push({ reason: "count", file: each });
    } else {
      accepted.push(each);
    }
  }
  return { accepted, rejected };
}
