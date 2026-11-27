/**
 * A small hand-written catalog and skills folder, written to a temporary directory, so the suites
 * run the server's real file loading with no dependency on docs generation.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Catalog, CatalogSection } from "@elmeragroup/docs-catalog";

/** A section of exactly `length` characters, holding its heading, a blank line and filler words. */
export function sizedSection(id: string, depth: 2 | 3, heading: string, length: number): CatalogSection {
  const head = `${"#".repeat(depth)} ${heading}\n\n`;
  return { id, depth, markdown: head + "lorem ".repeat(length).slice(0, length - head.length) };
}

/** The `/components/big` examples, three sections of 45,000 characters, 135,017 with their parent. */
const bigExamples = [
  { id: "examples", depth: 2, markdown: "## Examples" },
  sizedSection("first", 3, "First", 45_000),
  sizedSection("second", 3, "Second", 45_000),
  sizedSection("third", 3, "Third", 45_000),
] as const;

/** The docs origin every fixture server uses. */
export const ORIGIN = "https://fuse.elmeragroup.no";

/**
 * The length of the block `read_doc` returns: its `Source:` line, a blank line, the markdown, and
 * for a section a blank line and the page's `Sections:` line.
 */
export function blockLength(href: string, markdownLength: number, sections = ""): number {
  return (
    `Source: ${ORIGIN}${href}\n\n`.length + markdownLength + (sections === "" ? 0 : `\n\n${sections}`.length)
  );
}

/** The `Sections:` line of each fixture page that a test reads a section of. */
export const SECTIONS = {
  button: "Sections: /components/button#overview, #usage, #examples, #api-reference, #tokens-consumed",
  big: "Sections: /components/big#overview, #examples",
  filler: "Sections: /components/filler#first, #gap, #second, #tail",
} as const;

/** The `/components/many` examples: fifty sections of 1,500 characters, whose list of hrefs runs past 2,000 characters. */
export const manyCases = Array.from({ length: 50 }, (_, index) =>
  sizedSection(`case-${String(index + 1)}`, 3, `Case ${String(index + 1)}`, 1_500)
);

/** The length of `/components/filler#first`. */
const FILLER_FIRST_LENGTH = 49_000;

/**
 * The length of `/components/filler#gap`. After `#first` and `#gap`, `/components/big#first` is 20
 * characters too long for what is left of a call, though its markdown alone is shorter than that.
 */
const FILLER_GAP_LENGTH =
  100_000 +
  20 -
  blockLength("/components/big#first", 45_000, SECTIONS.big) -
  blockLength("/components/filler#first", FILLER_FIRST_LENGTH, SECTIONS.filler) -
  blockLength("/components/filler#gap", 0, SECTIONS.filler);

/**
 * The `/components/tiny` sections: twenty headings with nothing under them, so the page's whole
 * block is shorter than the list of sections an answer that does not fit would give.
 */
const tinySections = Array.from({ length: 20 }, (_, index) => ({
  id: `part-${String(index + 1)}`,
  depth: 2 as const,
  markdown: `## Part ${String(index + 1)}`,
}));

/** The length of the block that returns the whole `/components/tiny` page. */
export const TINY_BLOCK_LENGTH = blockLength(
  "/components/tiny",
  tinySections.reduce((sum, section) => sum + section.markdown.length, 0) + 2 * (tinySections.length - 1)
);

/**
 * The length of `/components/filler#second`. `#first`, `#second` and six whole `/components/tiny`
 * pages take exactly 100,000 characters.
 */
const FILLER_SECOND_LENGTH =
  100_000 -
  blockLength("/components/filler#first", FILLER_FIRST_LENGTH, SECTIONS.filler) -
  6 * TINY_BLOCK_LENGTH -
  blockLength("/components/filler#second", 0, SECTIONS.filler);

/** The fixture catalog. */
export const catalog: Catalog = {
  documents: [
    {
      href: "/components/button",
      title: "Button",
      group: "Components",
      description: "Triggers an action.",
      keywords: ["button", "@elmeragroup/fuse/button", "Pending", "Disabled"],
      sections: [
        { id: "overview", depth: 2, markdown: "# Button\n\nTriggers an action." },
        {
          id: "usage",
          depth: 2,
          markdown: '## Usage\n\n```tsx\nimport { Button } from "@elmeragroup/fuse/button";\n```',
        },
        { id: "examples", depth: 2, markdown: "## Examples" },
        {
          id: "pending",
          depth: 3,
          markdown: '### Pending\n\nA "pending" button shows a spinner while an action runs.',
        },
        { id: "disabled", depth: 3, markdown: "### Disabled\n\nA disabled button ignores presses." },
        { id: "api-reference", depth: 2, markdown: "## API reference" },
        {
          id: "api-button",
          depth: 3,
          markdown:
            "### Button\n\n| Prop | Type | Description |\n| --- | --- | --- |\n| `isPending` | `boolean` | Whether an action is in flight. A pending button blocks presses. |",
        },
        { id: "tokens-consumed", depth: 2, markdown: "## Tokens consumed\n\n- `--primary`" },
      ],
    },
    {
      href: "/components/select",
      title: "Select",
      group: "Components",
      description: "Picks one option from a list in a popup.",
      keywords: ["select", "@elmeragroup/fuse/select", "Select.Root"],
      sections: [
        { id: "overview", depth: 2, markdown: "# Select\n\nPicks one option from a list in a popup." },
        { id: "api-reference", depth: 2, markdown: "## API reference" },
        {
          id: "api-select-root",
          depth: 3,
          markdown:
            "### Select.Root\n\n| Prop | Type | Description |\n| --- | --- | --- |\n| `onValueChange` | `function` | Called when the chosen option changes. |",
        },
      ],
    },
    {
      href: "/components/big",
      title: "Big",
      group: "Components",
      description: "A page too large for one call.",
      keywords: ["big"],
      sections: [
        { id: "overview", depth: 2, markdown: "# Big\n\nA page too large for one call." },
        ...bigExamples,
      ],
    },
    {
      href: "/components/many",
      title: "Many",
      group: "Components",
      description: "A page with many examples.",
      keywords: ["many"],
      sections: [
        { id: "overview", depth: 2, markdown: "# Many\n\nA page with many examples." },
        { id: "examples", depth: 2, markdown: "## Examples" },
        ...manyCases,
      ],
    },
    {
      href: "/components/filler",
      title: "Filler",
      group: "Components",
      description: "Sections sized to fill a call.",
      keywords: ["filler"],
      sections: [
        sizedSection("first", 2, "First", FILLER_FIRST_LENGTH),
        sizedSection("gap", 2, "Gap", FILLER_GAP_LENGTH),
        sizedSection("second", 2, "Second", FILLER_SECOND_LENGTH),
        sizedSection("tail", 2, "Tail", 8_000),
      ],
    },
    {
      href: "/components/tiny",
      title: "Tiny",
      group: "Components",
      description: "Headings with nothing under them.",
      keywords: ["tiny"],
      sections: tinySections,
    },
    {
      href: "/quick-start",
      title: "Quick start",
      group: "Overview",
      description: "Install the library and mount the providers.",
      keywords: ["/quick-start"],
      sections: [],
    },
  ],
  index: "# Fuse\n\n- [Button](/components/button): Triggers an action.\n",
};

/** A skill file the Skills extension accepts, whose frontmatter name is its folder's. */
function skillFile(name: string, description: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\nRead /components/button#usage first.\n`;
}

/** Where a fixture server reads its files. */
export type FixtureFiles = {
  readonly catalogFile: string;
  readonly skillsDirectory: string;
};

/**
 * Writes the fixture catalog and a skills folder to a new temporary directory.
 *
 * @param skills - The skill folders to write, each with its `SKILL.md`. `fuse-setup` also gets a
 *   `references/notes.md`.
 * @returns The paths a server's settings name.
 */
export function writeFixtures(skills: readonly string[]): FixtureFiles {
  const root = mkdtempSync(join(tmpdir(), "fuse-mcp-"));
  const catalogFile = join(root, "catalog.json");
  writeFileSync(catalogFile, JSON.stringify(catalog));
  const skillsDirectory = join(root, "skills");
  mkdirSync(skillsDirectory);
  writeFileSync(join(skillsDirectory, ".gitkeep"), "");
  for (const name of skills) {
    mkdirSync(join(skillsDirectory, name, "references"), { recursive: true });
    writeFileSync(
      join(skillsDirectory, name, "SKILL.md"),
      skillFile(name, `Fuse (\`@elmeragroup/fuse\`) ${name}.`)
    );
    if (name === "fuse-setup")
      writeFileSync(join(skillsDirectory, name, "references", "notes.md"), "Notes.\n");
  }
  return { catalogFile, skillsDirectory };
}
