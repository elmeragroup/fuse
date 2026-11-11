import { describe, expect, it } from "vitest";

import * as Announcement from "../src/announcement.ts";
import { versionNotes } from "../src/release-notes.ts";
import {
  changelog,
  delimiters,
  notesOf,
  repository,
  sectionTexts,
  shortenedNotice,
  shown,
  stableRelease,
} from "./fixtures.ts";

// Unit under test: ReleaseNotes.versionNotes, which renders a version's changelog notes into Slack
// sections, and the stable announcement built from them. Oracles: CommonMark with GitHub's
// strikethrough for what the Markdown means, Slack's mrkdwn rules for how it shows, and Block Kit's
// limits (3000 characters per section, four note sections here). Expected sections are written out
// by hand.

/** The sections of `## 1.0.0` holding `markdown`, and how much of the notes they show. */
function packed(markdown: string) {
  const notes = shown(notesOf(markdown));
  return { sections: notes.sections, shortened: notes.extent._tag === "Shortened" };
}

/** The section texts of `## 1.0.0` holding `markdown`. */
function stableNotes(markdown: string): readonly string[] {
  return packed(markdown).sections;
}

/** The stable announcement of `version` from a changelog. */
function announcementOf(text: string, version: string): Announcement.Message {
  return Announcement.stable(
    stableRelease(version),
    versionNotes({ _tag: "Whole", text }, version),
    repository
  );
}

describe("stable notes", () => {
  it("reads the version's section up to the next version's heading", () => {
    expect(versionNotes({ _tag: "Whole", text: changelog }, "0.1.0")).toEqual({
      _tag: "Notes",
      sections: ["*Minor Changes*\n\n• 1a2b3c4: First release."],
      extent: { _tag: "Whole" },
    });
    const later = versionNotes({ _tag: "Whole", text: changelog }, "0.2.0");
    expect(later._tag === "Notes" && later.sections.join("\n")).not.toContain("First release");
  });

  it("says the notes are missing for a changelog without the version's section", () => {
    expect(versionNotes({ _tag: "Whole", text: changelog }, "0.3.0")).toEqual({ _tag: "Missing" });
    expect(sectionTexts(announcementOf(changelog, "0.3.0"))).toEqual([
      "The changelog has no notes for 0.3.0. " +
        "<https://github.com/elmeragroup/fuse/blob/v0.3.0/packages/fuse/CHANGELOG.md|Open the changelog>",
    ]);
  });

  it("shows four full sections of long notes, then links the full changelog", () => {
    // 60 entries of exactly 300 characters. Joined by newlines, nine fit in Slack's 3000-character
    // section (2708) and ten do not (3009), so four sections hold entries 1 to 36.
    const entries = Array.from({ length: 60 }, (_, index) => {
      const prefix = `- Entry ${String(index + 1).padStart(2, "0")}: `;
      return prefix + "x".repeat(300 - prefix.length);
    });
    const notes = notesOf(entries.join("\n"));
    expect(notes).toMatchObject({ _tag: "Notes", extent: { _tag: "Shortened", by: "section-limit" } });
    const message = announcementOf(`## 1.0.0\n\n${entries.join("\n")}\n`, "1.0.0");
    const texts = sectionTexts(message);
    expect(texts).toHaveLength(4);
    for (const text of texts) expect(text.length).toBeLessThanOrEqual(3000);
    expect(texts.join("\n").split("\n")).toEqual(entries.slice(0, 36).map((entry) => `• ${entry.slice(2)}`));
    expect(message.blocks).toContainEqual(shortenedNotice);
    expect(message.blocks.length).toBeLessThanOrEqual(50);
  });

  it("closes and reopens a code block that crosses sections", () => {
    const code = Array.from({ length: 50 }, (_, index) => `line ${String(index)} ${"y".repeat(90)}`);
    const texts = stableNotes(`\`\`\`\n${code.join("\n")}\n\`\`\``);
    expect(texts).toHaveLength(2);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(3000);
      expect(text.startsWith("```\n") && text.endsWith("\n```"), text).toBe(true);
    }
    expect(texts.flatMap((text) => text.split("\n")).filter((line) => line !== "```")).toEqual(code);
  });

  it("splits a line longer than a section at spaces", () => {
    const words = Array.from({ length: 1200 }, (_, index) => `w${String(index)}`);
    const { sections, shortened } = packed(words.join(" "));
    expect(sections.length).toBeGreaterThan(1);
    expect(shortened).toBe(false);
    for (const text of sections) expect(text.length).toBeLessThanOrEqual(3000);
    expect(sections.join(" ").split(/\s+/u)).toEqual(words);
  });

  it("never splits a link, a code span or an escaped entity between sections", () => {
    // Each unit renders to a link with an escaped `&` in its URL and label, a code span with
    // escaped brackets, and a bare escaped `&`; 100 of them overflow two sections.
    const unit = "[Docs & more](https://fuse.elmeragroup.no/a?b=1&c=2) `a<b>` &";
    const rendered = "<https://fuse.elmeragroup.no/a?b=1&amp;c=2|Docs &amp; more> `a&lt;b&gt;` &amp;";
    const texts = stableNotes(Array.from({ length: 100 }, () => unit).join(" "));
    expect(texts.length).toBeGreaterThan(2);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(3000);
      // Rendering escapes every literal bracket, so a section holds only whole links.
      expect(text.replaceAll(/<[^<>]*>/gu, ""), text).not.toMatch(/[<>]/u);
      expect(text.split("`").length % 2, text).toBe(1);
      expect(text, text).not.toMatch(/&(?!amp;|lt;|gt;)/u);
    }
    expect(texts.join(" ")).toBe(Array.from({ length: 100 }, () => rendered).join(" "));
  });

  it("shows a link whose URL alone outgrows a section as its label, noting the URL it drops", () => {
    expect(packed(`[the label](https://fuse.elmeragroup.no/${"p".repeat(3100)})`)).toEqual({
      sections: ["the label"],
      shortened: true,
    });
  });

  it.each([
    { case: "fenced code", markdown: `\`\`\`\n  ${"z".repeat(3100)}\n\`\`\`` },
    { case: "a list item's continuation", markdown: `- Entry\n\n${" ".repeat(10)}${"z".repeat(3100)}` },
    {
      case: "an indented link",
      markdown: `${" ".repeat(10)}[${"L".repeat(3100)}](https://fuse.elmeragroup.no/l)`,
    },
  ])("keeps every section within Slack's limit when $case is indented and oversized", ({ markdown }) => {
    const texts = stableNotes(markdown);
    for (const text of texts) expect(text.length, text.slice(0, 40)).toBeLessThanOrEqual(3000);
    expect(texts.join("").replaceAll(/[^z]/gu, "").length).toBe(markdown.replaceAll(/[^z]/gu, "").length);
  });

  it.each([
    { kind: "of plain words", inner: `${"bold ".repeat(700)}end` },
    { kind: "holding code spans", inner: `${"bold `c` ".repeat(400)}end` },
  ])("drops the delimiters of a bold span $kind too long for a section", ({ inner }) => {
    const texts = stableNotes(`**${inner}**`);
    expect(texts.length).toBeGreaterThan(1);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(3000);
      expect(delimiters(text)["*"], text.slice(0, 60)).toBe(0);
      expect(delimiters(text)["`"] % 2, text.slice(0, 60)).toBe(0);
    }
    expect(texts.join(" ").split(/\s+/u)).toEqual(inner.trim().split(/\s+/u));
  });

  it("shortens a link label over whole code spans, never leaving a backtick unpaired", () => {
    // The leading "ab" puts the cut inside a code span, which must be left out whole.
    const texts = stableNotes(`[ab${"see `code` ".repeat(400)}](https://fuse.elmeragroup.no/l)`);
    expect(texts).toHaveLength(1);
    const [text = ""] = texts;
    expect(text.length).toBeLessThanOrEqual(3000);
    expect(text.startsWith("<https://fuse.elmeragroup.no/l|absee `code` see `code` ")).toBe(true);
    expect(text.endsWith("…>")).toBe(true);
    expect(delimiters(text)["`"] % 2).toBe(0);
    expect(text.length).toBeGreaterThan(2900);
  });

  it("keeps a fenced line longer than a section whole across sections, opening no empty block", () => {
    const { sections, shortened } = packed(`\`\`\`\n${"z".repeat(9000)}\n\`\`\``);
    for (const text of sections) {
      expect(text.length).toBeLessThanOrEqual(3000);
      expect(text.startsWith("```\n") && text.endsWith("\n```"), text.slice(0, 20)).toBe(true);
      expect(text.length, "no section is an empty code block").toBeGreaterThan("```\n\n```".length);
    }
    expect(sections.join("").replaceAll(/[^z]/gu, "")).toBe("z".repeat(9000));
    expect(shortened).toBe(false);
  });

  it("cuts a word longer than a section anywhere, since plain text holds no markup", () => {
    const texts = stableNotes("z".repeat(7000));
    for (const text of texts) expect(text).toMatch(/^z{1,3000}$/u);
    expect(texts.join("")).toBe("z".repeat(7000));
  });

  it("keeps a fence open past a closing run followed by a no-break space, as CommonMark reads it", () => {
    const text = [
      "# @elmeragroup/fuse",
      "",
      "```md",
      "example",
      "``` ",
      "```",
      "",
      "## 1.0.0",
      "",
      "- Notes survive.",
      "",
      "## 0.9.0",
      "",
    ].join("\n");
    const notes = versionNotes({ _tag: "Whole", text }, "1.0.0");
    expect(notes).toMatchObject({ _tag: "Notes", sections: ["• Notes survive."] });
  });

  it("keeps a bold span around an oversized relative link balanced, and notes what it leaves out", () => {
    const message = announcementOf(
      `## 1.0.0\n\n**hello [${"word ".repeat(3000)}](./README.md) world** next\n`,
      "1.0.0"
    );
    const texts = sectionTexts(message);
    expect(texts).toHaveLength(4);
    for (const text of texts) {
      expect(text.length).toBeLessThanOrEqual(3000);
      expect(delimiters(text)["*"] % 2, text.slice(0, 40)).toBe(0);
    }
    expect(message.blocks).toContainEqual(shortenedNotice);
  });

  it.each([
    { what: "link label", markdown: `[${"word ".repeat(800)}](https://fuse.elmeragroup.no/l)` },
    { what: "code span", markdown: `\`${"word ".repeat(800)}\`` },
  ])("notes that a shortened $what leaves words out", ({ markdown }) => {
    const message = announcementOf(`## 1.0.0\n\n${markdown}\n`, "1.0.0");
    const texts = sectionTexts(message);
    expect(texts).toHaveLength(1);
    expect(texts[0]?.length).toBeLessThanOrEqual(3000);
    expect((texts[0]?.match(/word/gu) ?? []).length).toBeLessThan(800);
    expect(message.blocks).toContainEqual(shortenedNotice);
  });
});

describe("reference links", () => {
  it("resolves full, collapsed and shortcut references by CommonMark's normalized label", () => {
    expect(
      packed(
        "[docs][ref], [ref][], [Ref] and [docs][ the   REF ]\n\n" +
          "[ref]: https://example.test/docs\n[The Ref]: https://example.test/the"
      )
    ).toEqual({
      sections: [
        "<https://example.test/docs|docs>, <https://example.test/docs|ref>, " +
          "<https://example.test/docs|Ref> and <https://example.test/the|docs>",
      ],
      shortened: false,
    });
  });

  it("keeps a relative reference's label and shows an image reference without alt text as its URL", () => {
    expect(packed("[guide][rel] ![][img]\n\n[rel]: ./guide.md\n[img]: https://example.test/l.png")).toEqual({
      sections: ["guide <https://example.test/l.png>"],
      shortened: false,
    });
  });

  it("shows an undefined reference as its source text, as CommonMark reads it", () => {
    expect(packed("[nope][missing] and [also]")).toEqual({
      sections: ["[nope][missing] and [also]"],
      shortened: false,
    });
  });
});

describe("backticks", () => {
  // Slack ends a code span at its next backtick and has no escape for one, so a backtick inside a
  // code span, or loose in prose, is shown as U+02CB (ˋ). The expected texts hold paired backticks.
  it.each([
    { markdown: "``a`b``", mrkdwn: "`aˋb`" },
    { markdown: "```x``y```", mrkdwn: "`xˋˋy`" },
    { markdown: "`` `c` ``", mrkdwn: "`ˋcˋ`" },
    { markdown: "Press \\` then a ` b", mrkdwn: "Press ˋ then a ˋ b" },
  ])("keeps $markdown one code span or plain text", ({ markdown, mrkdwn }) => {
    expect(packed(markdown)).toEqual({ sections: [mrkdwn], shortened: false });
  });
});

describe("deep nesting", () => {
  const quoted = (depth: number) => `${"> ".repeat(depth)}hello`;

  it.each([
    { depth: 31, extent: "Whole" },
    { depth: 32, extent: "Whole" },
  ])("renders $depth nested quotes as they nest", ({ depth, extent }) => {
    expect(notesOf(quoted(depth))).toMatchObject({
      _tag: "Notes",
      sections: [`${"> ".repeat(depth)}hello`],
      extent: { _tag: extent },
    });
  });

  it.each([
    // About 6 KB, which once exhausted the call stack.
    { kind: "quotes", markdown: quoted(3000), shown: `${"> ".repeat(32)}hello` },
    { kind: "lists", markdown: `${"- ".repeat(3000)}hello`, shown: `${"• ".repeat(32)}hello` },
  ])(
    "shows $kind nested past 32 levels flattened, and says the notes are shortened",
    ({ markdown, shown }) => {
      expect(notesOf(markdown)).toMatchObject({
        _tag: "Notes",
        sections: [shown],
        extent: { _tag: "Shortened", by: "nesting" },
      });
    }
  );

  it("flattens blocks nested past 32 levels with a space between them", () => {
    // A list item 33 levels deep holding three paragraphs: each paragraph's words stay together,
    // and the paragraphs are separated.
    const indent = (level: number) => "  ".repeat(level);
    const lines = Array.from({ length: 34 }, (_, level) => `${indent(level)}- level${String(level)}`);
    const deepest = indent(34);
    const markdown = [
      ...lines,
      "",
      `${deepest}item`,
      "",
      `${deepest}hello **bold**`,
      "",
      `${deepest}world`,
    ].join("\n");
    const read = notesOf(markdown);
    expect(read).toMatchObject({ _tag: "Notes", extent: { _tag: "Shortened", by: "nesting" } });
    const shown = read._tag === "Notes" ? read.sections.join("\n") : "";
    expect(shown).toContain("level32 level33 item hello bold world");
  });

  it.each([
    { content: "a hard break", markdown: "hello\\\n{q}world", shown: "hello world" },
    { content: "a hard break of trailing spaces", markdown: "hello  \n{q}world", shown: "hello world" },
    {
      content: "an image",
      markdown: "Before ![logo words](https://e.test/l.png) after.",
      shown: "Before logo words after.",
    },
    {
      content: "an image without alt text, code and a link",
      markdown: "Before ![](https://e.test/l.png) after `code` and [link *em*](https://e.test).",
      shown: "Before after code and link em.",
    },
  ])("keeps the text of $content in a quote nested past 32 levels", ({ markdown, shown }) => {
    const q = "> ".repeat(33);
    expect(notesOf(`${q}${markdown.replaceAll("{q}", q)}`)).toEqual({
      _tag: "Notes",
      sections: [`${"> ".repeat(32)}${shown}`],
      extent: { _tag: "Shortened", by: "nesting" },
    });
  });

  it("shows emphasis and links nested past 32 levels as their text, keeping every mark paired", () => {
    const markdown = `[${"*a _b ".repeat(40)}x${"_ c* d".repeat(40)}](https://e.test/l)`;
    const notes = notesOf(markdown);
    expect(notes).toMatchObject({ _tag: "Notes", extent: { _tag: "Shortened", by: "nesting" } });
    const [section = ""] = notes._tag === "Notes" ? notes.sections : [];
    expect(section.startsWith("<https://e.test/l|a b a b ")).toBe(true);
    const counts = delimiters(section);
    expect([counts["*"] % 2, counts._ % 2]).toEqual([0, 0]);
  });
});
