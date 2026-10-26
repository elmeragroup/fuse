import { describe, expect, it } from "vitest";

import { expand, read } from "./read-files";
import type { ReadEntry, ReadableItem, WalkEntry } from "./read-files";
import type { SplitEntry } from "./split-files";

// The fakes below model the File and Directory Entries API: `webkitGetAsEntry()` on a
// DataTransfer item, `createReader().readEntries()` on a folder and `file()` on a file entry.

function png(name: string): File {
  return new File([], name, { type: "image/png" });
}

function fileEntry(file: File): WalkEntry {
  return { name: file.name, isFile: true, isDirectory: false, file: (success) => success(file) };
}

/** A folder whose reader hands out `batches` one per call, then empty batches. */
function folderEntry(name: string, batches: readonly (readonly WalkEntry[])[]): WalkEntry {
  return {
    name,
    isFile: false,
    isDirectory: true,
    createReader: () => {
      let call = 0;
      return { readEntries: (success) => success(batches[call++] ?? []) };
    },
  };
}

function fileItem(file: File): ReadableItem {
  return { kind: "file", getAsFile: () => file, webkitGetAsEntry: () => fileEntry(file) };
}

function folderItem(entry: WalkEntry): ReadableItem {
  return { kind: "file", getAsFile: () => null, webkitGetAsEntry: () => entry };
}

/** An entry as `[kind, name]`, so the expectations read as plain literals. */
function label(entry: SplitEntry): readonly [SplitEntry["kind"], string] {
  return entry.kind === "file" ? ["file", entry.file.name] : [entry.kind, entry.name];
}

/** The File objects of the file entries, so a test can check identity with `toBe`. */
function filesOf(entries: readonly SplitEntry[]): File[] {
  return entries.flatMap((entry) => (entry.kind === "file" ? [entry.file] : []));
}

function readLabels(items: readonly ReadableItem[]) {
  return read({ items }).map(label);
}

// Expectations follow the contracts in `read`'s and `expand`'s JSDoc.
describe("read", () => {
  it("reads plain file items as file entries in order, keeping each File", () => {
    const a = png("a.png");
    const b = png("b.png");
    const entries = read({ items: [fileItem(a), fileItem(b)] });
    expect(entries.map(label)).toEqual([
      ["file", "a.png"],
      ["file", "b.png"],
    ]);
    expect(filesOf(entries)[0]).toBe(a);
    expect(filesOf(entries)[1]).toBe(b);
  });

  it("skips an item whose entry and file are both null, as Firefox's phantom paste item is", () => {
    const phantom: ReadableItem = { kind: "file", getAsFile: () => null, webkitGetAsEntry: () => null };
    expect(readLabels([phantom, fileItem(png("a.png"))])).toEqual([["file", "a.png"]]);
  });

  // Chromium 153 gives a pasted clipboard image, and a File added to a constructed
  // DataTransfer, a null entry but a real file (`.scratch/file-drop-zone/probes-t2/probe-entry-null.mjs`).
  it("reads an item with a null entry but a file as a file, as Chromium lists a pasted image", () => {
    const pasted: ReadableItem = {
      kind: "file",
      getAsFile: () => png("image.png"),
      webkitGetAsEntry: () => null,
    };
    expect(readLabels([pasted])).toEqual([["file", "image.png"]]);
  });

  it("reads every file item as a file when items have no webkitGetAsEntry", () => {
    const a = png("a.png");
    const b = png("b.png");
    const items: ReadableItem[] = [
      { kind: "file", getAsFile: () => a },
      { kind: "file", getAsFile: () => b },
    ];
    expect(readLabels(items)).toEqual([
      ["file", "a.png"],
      ["file", "b.png"],
    ]);
  });

  it("ignores string items", () => {
    const text: ReadableItem = { kind: "string", getAsFile: () => null };
    expect(readLabels([text, fileItem(png("a.png"))])).toEqual([["file", "a.png"]]);
  });

  it("reads a folder item as a directory entry with the folder's name", () => {
    expect(readLabels([folderItem(folderEntry("photos", []))])).toEqual([["directory", "photos"]]);
  });
});

describe("expand", () => {
  function snapshot(items: readonly ReadableItem[]): readonly ReadEntry[] {
    return read({ items });
  }

  it("passes folders through unchanged while directory is off", async () => {
    const entries = snapshot([
      folderItem(folderEntry("photos", [[fileEntry(png("a.png"))]])),
      fileItem(png("b.png")),
    ]);
    const expanded = await expand(entries, { directory: false });
    expect(expanded.map(label)).toEqual([
      ["directory", "photos"],
      ["file", "b.png"],
    ]);
  });

  it("walks every batch of a nested folder and gives each file its relative path", async () => {
    const sub = folderEntry("sub", [[fileEntry(png("c.png"))]]);
    const photos = folderEntry("photos", [[fileEntry(png("a.png")), sub], [fileEntry(png("b.png"))]]);
    const expanded = await expand(snapshot([folderItem(photos)]), { directory: true });
    const paths = expanded.map((entry) =>
      entry.kind === "file" ? entry.file.webkitRelativePath : `dir:${entry.name}`
    );
    expect(paths.toSorted()).toEqual(["photos/a.png", "photos/b.png", "photos/sub/c.png"]);
  });

  it("reads every folder's batch at once and keeps input and reader order when reads finish out of order", async () => {
    // Each read waits until the test releases it, and the test releases each wave newest first.
    const held: { readonly name: string; readonly release: () => void }[] = [];
    const slow = (file: File): WalkEntry => ({
      name: file.name,
      isFile: true,
      isDirectory: false,
      file: (success) => held.push({ name: file.name, release: () => success(file) }),
    });
    const sub = folderEntry("sub", [[slow(png("b.png"))]]);
    const photos = folderEntry("photos", [
      [slow(png("a.png")), sub, slow(png("c.png"))],
      [slow(png("d.png"))],
    ]);
    const scans = folderEntry("scans", [[slow(png("e.png"))]]);
    let done = false;
    const pending = expand(snapshot([folderItem(photos), fileItem(png("loose.png")), folderItem(scans)]), {
      directory: true,
    }).finally(() => {
      done = true;
    });
    const waves: string[][] = [];
    while (!done) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const wave = held.splice(0);
      waves.push(wave.map((read) => read.name).toSorted());
      for (const read of wave.toReversed()) {
        read.release();
      }
    }
    // The second batch of `photos` is read only after its first batch has finished.
    expect(waves.slice(0, 2)).toEqual([["a.png", "b.png", "c.png", "e.png"], ["d.png"]]);
    expect((await pending).map(label)).toEqual([
      ["file", "a.png"],
      ["file", "b.png"],
      ["file", "c.png"],
      ["file", "d.png"],
      ["file", "loose.png"],
      ["file", "e.png"],
    ]);
  });

  it("leaves a file dropped outside a folder as it was", async () => {
    const loose = png("loose.png");
    const expanded = await expand(snapshot([fileItem(loose), folderItem(folderEntry("photos", []))]), {
      directory: true,
    });
    expect(expanded.map(label)).toEqual([["file", "loose.png"]]);
    expect(filesOf(expanded)[0]).toBe(loose);
    // Without an own property, the browser's `File.prototype` getter keeps answering "".
    expect(Object.hasOwn(loose, "webkitRelativePath")).toBe(false);
  });

  it("rejects a file the browser fails to read as unreadable, by its path, and keeps the rest", async () => {
    const unreadable: WalkEntry = {
      name: "gone.png",
      isFile: true,
      isDirectory: false,
      file: (_success, error) => error?.(new DOMException("The file is gone.", "NotFoundError")),
    };
    const photos = folderEntry("photos", [[unreadable, fileEntry(png("a.png"))]]);
    const expanded = await expand(snapshot([folderItem(photos)]), { directory: true });
    expect(expanded.map(label)).toEqual([
      ["unreadable", "photos/gone.png"],
      ["file", "a.png"],
    ]);
  });

  it("rejects a folder whose reader fails as unreadable and keeps the batches read before", async () => {
    let call = 0;
    const sub: WalkEntry = {
      name: "sub",
      isFile: false,
      isDirectory: true,
      createReader: () => ({
        readEntries: (success, error) =>
          call++ === 0
            ? success([fileEntry(png("c.png"))])
            : error?.(new DOMException("The folder is gone.", "NotFoundError")),
      }),
    };
    const photos = folderEntry("photos", [[sub, fileEntry(png("a.png"))]]);
    const expanded = await expand(snapshot([folderItem(photos)]), { directory: true });
    expect(expanded.map(label)).toEqual([
      ["file", "c.png"],
      ["unreadable", "photos/sub"],
      ["file", "a.png"],
    ]);
  });
});
