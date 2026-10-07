import { describe, expect, it } from "vitest";

import { prTitleProblems } from "../scripts/check-pr-title.ts";

// Expected verdicts come from the rule in CONTRIBUTING.md#pr-title, using titles merged into main.
describe("PR title check", () => {
  it.each([
    "Floor Text-Entry Type On iOS WebKit As Well As Touch",
    "Align The Phone Dial Code With The Typed Number",
    "Paint Brand Wordmarks In currentColor",
    "Add The Nordic Green Energy (`ngfi`) Brand",
    "Round TrøndelagKraft At 1rem Instead Of 0.95rem",
    "Re-Pick The Side When An Open Calendar's Room Changes",
  ])("accepts %s", (title) => {
    expect(prTitleProblems(title)).toEqual([]);
  });

  it.each([
    {
      title: "Re-pick the side when an open calendar's room changes",
      problems: ["Capitalize: Re-pick, the, side, when, an, open, calendar's, room, changes."],
    },
    {
      title: "Add The Nordic Green Energy (ngfi) Brand",
      problems: ["Capitalize: (ngfi)."],
    },
    {
      title: "fix(select): Open Beside The Trigger",
      problems: ["Drop the conventional commit prefix; commit messages keep it, PR titles do not."],
    },
    {
      title: "docs: Require Title Case PR Titles",
      problems: ["Drop the conventional commit prefix; commit messages keep it, PR titles do not."],
    },
    { title: "  ", problems: ["The title is empty."] },
  ])("rejects $title", ({ title, problems }) => {
    expect(prTitleProblems(title)).toEqual(problems);
  });
});
