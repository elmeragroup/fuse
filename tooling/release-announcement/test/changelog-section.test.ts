import { describe, expect, it } from "vitest";

import { versionNotes } from "../src/release-notes.ts";

// Unit under test: ChangelogSection's choice of a version's section and of how much of it the
// notes hold, seen through the notes it yields. Oracle: CommonMark, by which a `## ` line inside a
// fenced block, an HTML comment or a list is not a heading, and the read limit, by which a prefix
// that ends before the next version's heading has cut the section.

const whole = (text: string, version = "1.0.0") => versionNotes({ _tag: "Whole", text }, version);
const prefix = (text: string, version = "1.0.0") => versionNotes({ _tag: "Prefix", text }, version);

describe("the version's section", () => {
  it.each([
    { where: "a fenced example", before: "```md\n## 1.0.0\n\n- Not these notes.\n```" },
    { where: "an HTML comment", before: "<!--\n## 1.0.0\n\n- Not these notes.\n-->" },
    { where: "a list item", before: "- Older text:\n\n  ## 1.0.0\n\n  - Not these notes." },
  ])("starts at the version's own heading, not one inside $where earlier in the file", ({ before }) => {
    expect(whole(`# @elmeragroup/fuse\n\n${before}\n\n## 1.0.0\n\n- These notes.\n`)).toEqual({
      _tag: "Notes",
      sections: ["• These notes."],
      extent: { _tag: "Whole" },
    });
  });

  it("goes on past a `## ` line inside a fenced example, to the next version's heading", () => {
    const text = "## 1.0.0\n\n- Before.\n\n```md\n## 8.8.8\n```\n\n- After.\n\n## 0.9.0\n\n- Older.\n";
    expect(whole(text)).toEqual({
      _tag: "Notes",
      sections: ["• Before.\n\n```\n## 8.8.8\n```\n\n• After."],
      extent: { _tag: "Whole" },
    });
  });

  it("matches the version exactly, not a longer version that starts with it", () => {
    expect(whole("## 1.0.10\n\n- Ten.\n\n## 1.0.1\n\n- One.\n", "1.0.1")).toEqual({
      _tag: "Notes",
      sections: ["• One."],
      extent: { _tag: "Whole" },
    });
  });

  it("is missing from a changelog read whole without its heading", () => {
    expect(whole("## 0.9.0\n\n- Older.\n")).toEqual({ _tag: "Missing" });
  });

  it("lies past the read limit when a prefix holds no heading for it", () => {
    expect(prefix("## 0.9.0\n\n- Older.\n")).toEqual({ _tag: "BeyondReadLimit" });
  });
});

describe("how much of the section the notes hold", () => {
  it("is whole when a prefix holds the section and the next version's heading", () => {
    expect(prefix("## 1.0.0\n\n- All of it.\n\n## 0.9.0\n\n- Old")).toEqual({
      _tag: "Notes",
      sections: ["• All of it."],
      extent: { _tag: "Whole" },
    });
  });

  it("is shortened by the read limit when a prefix ends inside the section", () => {
    expect(prefix("## 1.0.0\n\n- Kept.\n\n- Cut")).toEqual({
      _tag: "Notes",
      sections: ["• Kept."],
      extent: { _tag: "Shortened", by: "read-limit" },
    });
  });

  it("is shortened by the read limit when a prefix ends inside a fence holding a version look-alike", () => {
    // The reviewers' case: the next real heading lies past the cut, after the fence closes.
    const text = "## 1.0.0\n\n- Kept.\n\n```md\nexample\n## 8.8.8\nmore example\n";
    expect(prefix(text)).toMatchObject({
      _tag: "Notes",
      extent: { _tag: "Shortened", by: "read-limit" },
    });
    expect(prefix(text)).toMatchObject({
      sections: [expect.stringMatching(/^• Kept\.\n\n```\nexample\n## 8\.8\.8\n/u)],
    });
  });

  it("is whole when nothing but older versions follows a prefix's last heading", () => {
    expect(prefix("## 1.0.0\n\n- New.\n\n## 0.9.0\n\n- Old, and cut")).toMatchObject({
      extent: { _tag: "Whole" },
    });
  });
});
