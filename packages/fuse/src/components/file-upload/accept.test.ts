import { describe, expect, it } from "vitest";

import * as Accept from "./accept";

/** One hand-written row: the `accept` string, the file's name and type, and whether it passes. */
type Row = readonly [accept: string | undefined, name: string, type: string, passes: boolean];

// Each row follows a rule in SPEC "Accept", which follows the HTML `accept` attribute.
const rows = {
  "an exact MIME type matches": ["application/pdf", "report.pdf", "application/pdf", true],
  "an exact MIME type rejects another type": ["application/pdf", "photo.png", "image/png", false],
  "an exact MIME token matches in any case": ["Application/PDF", "report.pdf", "application/pdf", true],
  "image/* matches an image type": ["image/*", "photo.png", "image/png", true],
  "image/* rejects a type with another top-level type": ["image/*", "report.pdf", "application/pdf", false],
  "an extension matches a name in another case": [".pdf", "B.PDF", "", true],
  "an extension matches the end of the name only": [".pdf", "b.pdf.exe", "application/x-msdownload", false],
  "an extension matches the last part of a double extension": [
    ".gz",
    "archive.tar.gz",
    "application/gzip",
    true,
  ],
  "a file with no type fails a MIME token": ["application/pdf", "report.pdf", "", false],
  "a file with no type passes an extension token": [".pdf", "report.pdf", "", true],
  "tokens are trimmed and empty tokens skipped": [" , image/png ,, .PDF ,", "notes.pdf", "", true],
  "a trimmed MIME token still matches": ["  image/png  ,", "photo.png", "image/png", true],
  "unusable tokens are ignored beside usable ones": [
    "pdf, image, .txt",
    "report.pdf",
    "application/pdf",
    false,
  ],
  "a usable token still matches beside unusable ones": ["pdf, image, .txt", "notes.txt", "text/plain", true],
  "only unusable tokens accept every file": ["pdf, image", "report.pdf", "application/pdf", true],
  "an empty string accepts every file": ["", "anything.bin", "", true],
  "a missing accept accepts every file": [undefined, "anything.bin", "application/octet-stream", true],
} satisfies Readonly<Record<string, Row>>;

describe("Accept.matchesFile", () => {
  it.each(Object.entries(rows))("%s", (_name, [accept, name, type, passes]) => {
    const file = new File([], name, { type });
    expect(Accept.matchesFile(Accept.parse(accept), file)).toBe(passes);
  });
});

// The drag verdict (SPEC "Drop") only sees MIME types, so it asks these two questions of the rule.
describe("Accept.matchesMimeType", () => {
  it.each<readonly [accept: string | undefined, type: string, matches: boolean]>([
    ["image/*", "image/png", true],
    ["IMAGE/PNG", "image/png", true],
    ["image/*", "application/pdf", false],
    ["image/png, .pdf", "application/pdf", false],
    ["image/png", "", false],
    [undefined, "application/pdf", true],
    ["pdf", "application/pdf", true],
  ])("%j against %j is %s", (accept, type, matches) => {
    expect(Accept.matchesMimeType(Accept.parse(accept), type)).toBe(matches);
  });
});

describe("Accept.hasExtension", () => {
  it.each<readonly [accept: string | undefined, has: boolean]>([
    ["image/*, .pdf", true],
    [" .PDF ", true],
    ["image/*, application/pdf", false],
    ["pdf, image", false],
    ["", false],
    [undefined, false],
  ])("%j is %s", (accept, has) => {
    expect(Accept.hasExtension(Accept.parse(accept))).toBe(has);
  });
});
