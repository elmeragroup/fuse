import { describe, expect, it } from "vitest";

import * as Accept from "./accept";
import { split } from "./split-files";
import type { FileRejection, SplitEntry } from "./split-files";

function file(name: string, type: string): SplitEntry {
  return { kind: "file", file: new File([], name, { type }) };
}

function folder(name: string): SplitEntry {
  return { kind: "directory", name };
}

/** A rejection as `[reason, name]`, so the expectations below read as plain literals. */
function rejectionName(rejection: FileRejection): readonly [FileRejection["reason"], string] {
  return "file" in rejection ? [rejection.reason, rejection.file.name] : [rejection.reason, rejection.name];
}

function splitNames(entries: readonly SplitEntry[], accept: string | undefined, multiple: boolean) {
  const { accepted, rejected } = split(entries, { accept: Accept.parse(accept), multiple });
  return { accepted: accepted.map((each) => each.name), rejected: rejected.map(rejectionName) };
}

// Expectations follow SPEC "Split".
describe("split", () => {
  it("keeps the input order in both lists", () => {
    const entries = [
      file("a.png", "image/png"),
      file("b.txt", "text/plain"),
      file("c.png", "image/png"),
      file("d.txt", "text/plain"),
    ];
    expect(splitNames(entries, "image/*", true)).toEqual({
      accepted: ["a.png", "c.png"],
      rejected: [
        ["type", "b.txt"],
        ["type", "d.txt"],
      ],
    });
  });

  // A copy would drop the `webkitRelativePath` that folder expansion defines on each file.
  it("hands back the entries' own File objects", () => {
    const photo = new File([], "a.png", { type: "image/png" });
    const { accepted } = split([{ kind: "file", file: photo }], {
      accept: Accept.parse(undefined),
      multiple: false,
    });
    expect(accepted[0]).toBe(photo);
  });

  it("rejects a directory entry with its name", () => {
    expect(splitNames([folder("photos"), file("a.png", "image/png")], undefined, true)).toEqual({
      accepted: ["a.png"],
      rejected: [["directory", "photos"]],
    });
  });

  it("rejects an unreadable entry with its path, in input order, and counts it as no file", () => {
    const entries: SplitEntry[] = [
      file("a.png", "image/png"),
      { kind: "unreadable", name: "photos/gone.png" },
      file("b.txt", "text/plain"),
    ];
    expect(splitNames(entries, "image/*", false)).toEqual({
      accepted: ["a.png"],
      rejected: [
        ["unreadable", "photos/gone.png"],
        ["type", "b.txt"],
      ],
    });
  });

  it("checks the type before the count, so a single-file Root accepts its one survivor", () => {
    const entries = [file("a.txt", "text/plain"), folder("photos"), file("b.png", "image/png")];
    expect(splitNames(entries, "image/*", false)).toEqual({
      accepted: ["b.png"],
      rejected: [
        ["type", "a.txt"],
        ["directory", "photos"],
      ],
    });
  });

  it("rejects every survivor with count when a single-file Root gets two", () => {
    const entries = [file("a.png", "image/png"), file("b.txt", "text/plain"), file("c.png", "image/png")];
    expect(splitNames(entries, "image/*", false)).toEqual({
      accepted: [],
      rejected: [
        ["count", "a.png"],
        ["type", "b.txt"],
        ["count", "c.png"],
      ],
    });
  });

  it("returns two empty lists for no entries", () => {
    expect(splitNames([], undefined, false)).toEqual({ accepted: [], rejected: [] });
  });
});
