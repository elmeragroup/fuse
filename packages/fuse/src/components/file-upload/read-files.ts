import type { SplitEntry } from "./split-files";

/**
 * Reading a drop or a paste. {@link read}
 * copies the items while the event runs, because the browser empties the `DataTransfer`
 * afterwards. {@link expand} then walks dropped folders asynchronously.
 *
 * The types below are the members of the File and Directory Entries API this module calls.
 * The DOM's `FileSystemEntry` and `DataTransferItem` satisfy them, and unit tests can fake them.
 */

/** A `FileSystemDirectoryReader`: each call hands out the next batch, and an empty one ends it. */
export type WalkReader = {
  readEntries(success: (entries: readonly WalkEntry[]) => void, error?: (error: DOMException) => void): void;
};

/** A `FileSystemEntry`. A file entry also has `file`, and a folder entry also has `createReader`. */
export type WalkEntry = {
  readonly name: string;
  readonly isFile: boolean;
  readonly isDirectory: boolean;
  file?(success: (file: File) => void, error?: (error: DOMException) => void): void;
  createReader?(): WalkReader;
};

/** A `DataTransferItem`. Browsers without `webkitGetAsEntry` cannot hand out folders. */
export type ReadableItem = {
  readonly kind: string;
  getAsFile(): File | null;
  webkitGetAsEntry?(): WalkEntry | null;
};

/** A folder entry that {@link expand} can walk. */
type FolderEntry = WalkEntry & { createReader(): WalkReader };

/** One item of a drop or paste: a file, or a folder with the entry that walks it. */
export type ReadEntry =
  | { readonly kind: "file"; readonly file: File }
  | { readonly kind: "directory"; readonly name: string; readonly entry: FolderEntry };

function isFolder(entry: WalkEntry): entry is FolderEntry {
  return entry.isDirectory && entry.createReader !== undefined;
}

/**
 * Copy the file and folder items of a drop or paste, synchronously and in order. String items
 * are ignored, and so is an item with neither a folder entry nor a file, such as the phantom
 * item Firefox adds to a paste. An item with a `null` entry and a file is still a file, because
 * Chromium hands out a pasted image that way.
 *
 * @param dataTransfer - The event's `dataTransfer` or `clipboardData`, read during the event.
 * @returns The entries, which stay usable after the event ends.
 */
export function read(dataTransfer: { readonly items: ArrayLike<ReadableItem> }): ReadEntry[] {
  const entries: ReadEntry[] = [];
  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== "file") {
      continue;
    }
    const entry = item.webkitGetAsEntry?.();
    if (entry && isFolder(entry)) {
      entries.push({ kind: "directory", name: entry.name, entry });
      continue;
    }
    const file = item.getAsFile();
    if (file) {
      entries.push({ kind: "file", file });
    }
  }
  return entries;
}

/** The rule {@link expand} applies to folders. */
export type ExpandOptions = {
  /** Whether folders expand into their files. When off, folders pass through for `split` to reject. */
  readonly directory: boolean;
};

/**
 * Replace each folder with the files inside it, at any depth. Each of those files gets an own
 * `webkitRelativePath` of `folder/sub/name.ext`, as a picked folder's files have. A file
 * dropped outside a folder keeps the browser's `""`.
 *
 * A file the browser fails to read, for example because it was deleted mid-drop, becomes an
 * `"unreadable"` entry named by its relative path. So does a folder whose reader fails, after
 * the files it listed before the failure. The promise never rejects.
 *
 * @param entries - The entries {@link read} returned.
 * @param options - Whether folders expand.
 * @returns The entries in input order, with each folder's contents in reader order.
 */
export async function expand(entries: readonly ReadEntry[], options: ExpandOptions): Promise<SplitEntry[]> {
  if (!options.directory) {
    return [...entries];
  }
  const expanded = await Promise.all(
    entries.map((entry) => (entry.kind === "file" ? Promise.resolve([entry]) : walk(entry.entry, entry.name)))
  );
  return expanded.flat();
}

const FAILED = Symbol("failed");

/**
 * The files under `folder`, in reader order. Its reader hands out one batch at a time, and every
 * child of a batch is read at once, so a folder has at most one batch in flight.
 */
async function walk(folder: FolderEntry, path: string): Promise<SplitEntry[]> {
  const batches: SplitEntry[][] = [];
  const reader = folder.createReader();
  for (;;) {
    const batch = await readBatch(reader);
    if (batch === FAILED) {
      return [...batches.flat(), { kind: "unreadable", name: path }];
    }
    if (batch.length === 0) {
      return batches.flat();
    }
    const children = await Promise.all(batch.map((child) => readChild(child, `${path}/${child.name}`)));
    batches.push(children.flat());
  }
}

/** A child's entries: a subfolder's files, its file, or none for an entry that is neither. */
async function readChild(child: WalkEntry, path: string): Promise<SplitEntry[]> {
  if (isFolder(child)) {
    return walk(child, path);
  }
  const file = await readFile(child);
  if (file === FAILED) {
    return [{ kind: "unreadable", name: path }];
  }
  if (!file) {
    return [];
  }
  Object.defineProperty(file, "webkitRelativePath", { value: path, configurable: true });
  return [{ kind: "file", file }];
}

/** The next batch, where an empty one ends the folder, or `FAILED` when the browser fails. */
function readBatch(reader: WalkReader): Promise<readonly WalkEntry[] | typeof FAILED> {
  return new Promise((resolve) => {
    reader.readEntries(resolve, () => resolve(FAILED));
  });
}

/** The entry's file, `null` for an entry that is neither file nor folder, or `FAILED`. */
function readFile(entry: WalkEntry): Promise<File | null | typeof FAILED> {
  return new Promise((resolve) => {
    if (!entry.isFile || !entry.file) {
      resolve(null);
      return;
    }
    entry.file(resolve, () => resolve(FAILED));
  });
}
