import { describe, expect, it } from "vitest";

import * as Announcement from "../src/announcement.ts";
import { versionNotes } from "../src/release-notes.ts";
import { READ_LIMIT } from "../src/render-protocol.ts";
import type { Changelog, VersionNotes } from "../src/render-protocol.ts";
import {
  bulk,
  context,
  notesOf,
  repository,
  sectionTexts,
  shortenedNotice,
  shown,
  stableRelease,
} from "./fixtures.ts";

// Unit under test: ReleaseNotes.versionNotes on large and adversarial changelogs, and on the
// bounded prefix the git adapter reads of a long one. Oracle: Block Kit's limits (3000 characters
// per section, four note sections here).

/**
 * The part of `text` the git adapter reads: all of it, or its first READ_LIMIT bytes.
 *
 * @param text - A changelog of ASCII text, so its characters are its bytes.
 * @returns The changelog as read.
 */
function read(text: string): Changelog {
  return text.length > READ_LIMIT
    ? { _tag: "Prefix", text: text.slice(0, READ_LIMIT) }
    : { _tag: "Whole", text };
}

function sectionsOf(notes: VersionNotes): readonly string[] {
  return shown(notes).sections;
}

describe("large changelogs", () => {
  it("reads short notes from a changelog whose older history lies past the read limit", () => {
    const text = `# @elmeragroup/fuse\n\n## 0.3.0\n\n### Patch Changes\n\n- abc1234: Small fix.\n\n## 0.2.0\n\n${bulk}\n`;
    const notes = versionNotes(read(text), "0.3.0");
    expect(notes).toMatchObject({
      _tag: "Notes",
      sections: ["*Patch Changes*\n\n• abc1234: Small fix."],
      extent: { _tag: "Whole" },
    });
  });

  it("reports notes that run past the read limit as shortened", () => {
    const message = Announcement.stable(
      stableRelease("1.0.0"),
      versionNotes(read(`## 1.0.0\n\n${bulk}\n\n## 0.9.0\n\n- Old.\n`), "1.0.0"),
      repository
    );
    expect(sectionTexts(message)).toHaveLength(4);
    expect(message.blocks).toContainEqual(shortenedNotice);
    expect(sectionTexts(message)[0]?.startsWith(`• 0000000: ${"y".repeat(100)}\n`)).toBe(true);
  });

  it("links the notes instead when the version's heading lies past the read limit", () => {
    const older = Array.from(
      { length: 5500 },
      (_, index) => `- ${String(index).padStart(7, "0")}: ${"y".repeat(100)}`
    );
    const text = `# @elmeragroup/fuse\n\n## 0.0.1\n\n${older.join("\n")}\n\n## 1.0.0\n\n- Late notes.\n`;
    const notes = versionNotes(read(text), "1.0.0");
    expect(notes).toEqual({ _tag: "BeyondReadLimit" });
    const message = Announcement.stable(stableRelease("1.0.0"), notes, repository);
    expect(sectionTexts(message)).toEqual([
      "The notes for 1.0.0 are too large to show here. " +
        "<https://github.com/elmeragroup/fuse/blob/v1.0.0/packages/fuse/CHANGELOG.md#100|Read them in the changelog>.",
    ]);
    expect(message.blocks.at(-2)).toEqual(
      context(
        "<https://github.com/elmeragroup/fuse/releases/tag/v1.0.0|GitHub release> · " +
          "<https://www.npmjs.com/package/@elmeragroup/fuse/v/1.0.0|npm>"
      )
    );
  });

  it("reads a prefix that ends inside a line only up to its last whole line", () => {
    // The cut lands inside the heading of 0.9.0, which must not read as a heading `## 0.`.
    const head = "## 1.0.0\n\n- Kept.\n\n";
    const notes = versionNotes({ _tag: "Prefix", text: `${head}## 0.` }, "1.0.0");
    expect(notes).toMatchObject({
      _tag: "Notes",
      sections: ["• Kept."],
      extent: { _tag: "Shortened", by: "read-limit" },
    });
  });

  it("shortens current notes over a megabyte to four sections", () => {
    const sections = sectionsOf(versionNotes(read(`## 1.0.0\n\n${bulk}\n`), "1.0.0"));
    expect(sections).toHaveLength(4);
    for (const text of sections) expect(text.length).toBeLessThanOrEqual(3000);
    expect(sections[0]?.startsWith(`• 0000000: ${"y".repeat(100)}\n• 0000001: `)).toBe(true);
  });

  it("reads notes whose line past the cut is a relative link with a huge label", () => {
    // 200 entries fill the four sections long before the last line, a whole link of 180,000 label
    // units inside the read limit. Its label once overflowed the call stack when spread into an
    // array; now it is parsed and, past the cut, never rendered.
    const entries = Array.from({ length: 200 }, (_, index) => `- ${String(index)}: ${"y".repeat(250)}`);
    const text = `## 1.0.0\n\n${entries.join("\n")}\n[${"word ".repeat(90_000)}](./README.md)\n`;
    expect(text.length).toBeLessThan(READ_LIMIT);
    const notes = versionNotes(read(text), "1.0.0");
    expect(notes).toMatchObject({ _tag: "Notes", extent: { _tag: "Shortened", by: "section-limit" } });
    const sections = sectionsOf(notes);
    expect(sections).toHaveLength(4);
    expect(sections[0]?.startsWith(`• 0: ${"y".repeat(250)}\n• 1: `)).toBe(true);
    expect(sections.join("\n")).not.toContain("word");
  });

  it("shows the label of a relative link whose label alone has 120,000 units", () => {
    const sections = sectionsOf(
      versionNotes(read(`## 1.0.0\n\n[${"w ".repeat(60_000)}end](./README.md)\n`), "1.0.0")
    );
    expect(sections).toHaveLength(4);
    expect(sections[0]?.startsWith("w w w ")).toBe(true);
    for (const text of sections) expect(text.length).toBeLessThanOrEqual(3000);
  });

  it("reads only the first part of a ten-megabyte section", () => {
    const line = `- ${"word ".repeat(40)}`;
    const notes = versionNotes(
      read(`## 1.0.0\n\n${Array.from({ length: 50_000 }, () => line).join("\n")}\n`),
      "1.0.0"
    );
    expect(sectionsOf(notes)).toHaveLength(4);
    expect(notes).toMatchObject({ extent: { _tag: "Shortened" } });
  });
});

describe("lines longer than a section", () => {
  // A line past the 2,992 units a section leaves after its fences is cut into pieces. Each case's
  // pieces are worked out by hand from the cluster's length in UTF-16 units: the first piece takes
  // as many whole clusters as fit, the rest go to the next section.
  it.each([
    // 1 + 1,495 × 2 = 2,991; one more emoji would need 2,993.
    { case: "emoji", line: `a${"😀".repeat(2000)}`, sections: [`a${"😀".repeat(1495)}`, "😀".repeat(505)] },
    // An accent combines with its letter: 1 + 1,495 × 2.
    {
      case: "letters with a combining accent",
      line: `x${"e\u0301".repeat(2000)}`,
      sections: [`x${"e\u0301".repeat(1495)}`, "e\u0301".repeat(505)],
    },
    // A flag is two regional indicators, four units: 2 + 747 × 4 = 2,990.
    { case: "flags", line: `ab${"🇳🇴".repeat(1000)}`, sections: [`ab${"🇳🇴".repeat(747)}`, "🇳🇴".repeat(253)] },
    // A family is three emoji joined by two ZWJs, eight units: 4 + 373 × 8 = 2,988.
    {
      case: "ZWJ sequences",
      line: `abcd${"👨\u200D👩\u200D👧".repeat(500)}`,
      sections: [`abcd${"👨\u200D👩\u200D👧".repeat(373)}`, "👨\u200D👩\u200D👧".repeat(127)],
    },
    // Each CJK character is one unit.
    { case: "CJK", line: "字".repeat(4000), sections: ["字".repeat(2992), "字".repeat(1008)] },
    // `&` is written `&amp;`, so each pair is seven units: 1 + 427 × 7 = 2,990, then 427 × 7 = 2,989.
    {
      case: "escaped ampersands beside emoji",
      line: `x${"&😀".repeat(1000)}`,
      sections: [`x${"&amp;😀".repeat(427)}`, "&amp;😀".repeat(427), "&amp;😀".repeat(146)],
    },
  ])("cuts a line of $case between whole characters, keeping every one", ({ line, sections }) => {
    const notes = notesOf(line);
    expect(notes).toEqual({ _tag: "Notes", sections, extent: { _tag: "Whole" } });
    for (const text of sectionsOf(notes)) {
      expect(text.isWellFormed()).toBe(true);
      expect(text.length).toBeLessThanOrEqual(3000);
    }
  });

  it.each([
    // The backtick, 1,494 emoji (2,988) and `…` and the closing backtick fill 2,991 of 2,992.
    { case: "a code span", line: `\`${"😀".repeat(2000)}\``, section: `\`${"😀".repeat(1494)}…\`` },
    // `<https://example.com|` is 21 units, `…>` two: 1,484 emoji (2,968) fit beside them.
    {
      case: "a link label",
      line: `[${"😀".repeat(2000)}](https://example.com)`,
      section: `<https://example.com|${"😀".repeat(1484)}…>`,
    },
  ])("shortens $case of emoji between whole emoji", ({ line, section }) => {
    const notes = notesOf(line);
    expect(notes).toEqual({
      _tag: "Notes",
      sections: [section],
      extent: { _tag: "Shortened", by: "oversized-unit" },
    });
  });
});

describe("adversarial lines", () => {
  // Each line defeats a backtracking reader: an opener with no closer, a lookahead over the rest of
  // a long line, or a parse that restarts at every bracket. Each is close to the 512 KiB read
  // limit and parsed whole, and both the parser and the renderer are linear on it.
  // The backtracking renderer these cases were first written against took over 30 seconds on the
  // first line, and over 10 seconds on the doubled unpaired (`**`, `~~`) and bracket lines at under
  // half these sizes. No assertion depends on time: the generous test timeout only stops a reader
  // that hangs. The CLI suite runs every nesting shape at this size.
  it.each([
    {
      case: "an unclosed * before code spans and a long word",
      line: `*literal ${"`c` ".repeat(30)}${"x".repeat(3100)}`,
      starts: "*literal `c` `c` ",
    },
    { case: "160,000 unpaired *", line: "*a ".repeat(160_000), starts: "*a *a *a " },
    { case: "120,000 unpaired **", line: "**a ".repeat(120_000), starts: "**a **a **a " },
    { case: "160,000 unpaired _", line: "_a ".repeat(160_000), starts: "_a _a _a " },
    { case: "120,000 unpaired ~~", line: "~~a ".repeat(120_000), starts: "~~a ~~a ~~a " },
    { case: "120,000 backtick pairs", line: "`c` ".repeat(120_000), starts: "`c` `c` `c` " },
    {
      case: "240,000 brackets before one long target",
      line: `${"[".repeat(240_000)}](${"u".repeat(240_000)} z)`,
      starts: "[[[[[[",
    },
    { case: "a 480,000-character line", line: "word ".repeat(96_000), starts: "word word word " },
  ])(
    "reads $case",
    ({ line, starts }) => {
      const sections = sectionsOf(versionNotes(read(`## 1.0.0\n\n${line}\n`), "1.0.0"));
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.length).toBeLessThanOrEqual(4);
      expect(sections[0]?.startsWith(starts), sections[0]?.slice(0, 40)).toBe(true);
      for (const text of sections) expect(text.length).toBeLessThanOrEqual(3000);
    },
    120_000
  );
});
