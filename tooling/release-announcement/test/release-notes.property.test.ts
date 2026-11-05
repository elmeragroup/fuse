import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Schema } from "effect";

import * as Announcement from "../src/announcement.ts";
import { Changelog } from "../src/changelog-section.ts";
import { versionNotes } from "../src/release-notes.ts";
import { mrkdwnObjects, repository, sectionTexts, stableRelease } from "./fixtures.ts";

// Unit under test: the stable announcement of generated changelog notes, built by
// ReleaseNotes.versionNotes and Announcement.stable. Oracles, independent of how the notes are
// parsed: Block Kit's limits, Slack's mrkdwn rules (paired fences and marks, escaped angle brackets
// and ampersands, verbatim text, no `<!…>`, `<@…>` or `<#…>` outside a link this code wrote), the
// words of the notes, every one of which shows unless the announcement says it is shortened, and
// Unicode's rules for text: every string well-formed UTF-16, and no line starting inside a
// grapheme cluster (with a combining mark or ZWJ), ending inside one (with a ZWJ) or holding half a
// flag (an odd run of regional indicators).

/** The words generated notes are written in. URLs, info strings and mentions use none of them. */
const VOCABULARY = [
  "alpha",
  "bravo",
  "charlie",
  "delta",
  "echo",
  "foxtrot",
  "golf",
  "hotel",
  "india",
  "juliet",
  "kilo",
  "lima",
  "mike",
  "november",
  "oscar",
  "papa",
  "quebec",
  "romeo",
  "sierra",
  "tango",
] as const;

/** One of `values`. */
function pick<const A extends readonly [string, ...string[]]>(values: A): Arbitrary.Arbitrary<A[number]> {
  return Arbitrary.schema(Schema.Literals(values));
}

/** An integer from `low` to `high`. */
function int(low: number, high: number): Arbitrary.Arbitrary<number> {
  return Arbitrary.schema(Schema.Int.check(Schema.isBetween({ minimum: low, maximum: high })));
}

/** One of the choices, each as likely as its copies in the list. */
function oneOf<A>(
  first: Arbitrary.Arbitrary<A>,
  ...rest: readonly Arbitrary.Arbitrary<A>[]
): Arbitrary.Arbitrary<A> {
  const choices = [first, ...rest];
  return int(0, choices.length - 1).pipe(Arbitrary.flatMap((index) => choices[index] ?? first));
}

/** Between `low` and `high` items, the count drawn first so it does not depend on the run's size. */
function listOf<A>(item: Arbitrary.Arbitrary<A>, low: number, high: number): Arbitrary.Arbitrary<A[]> {
  return int(low, high).pipe(
    Arbitrary.flatMap((count) => Arbitrary.array(item, { minLength: count, maxLength: count }))
  );
}

const word = pick(VOCABULARY);

/** Between `low` and `high` vocabulary words, joined by spaces. */
function words(low: number, high: number): Arbitrary.Arbitrary<string> {
  return listOf(word, low, high).pipe(Arbitrary.map((list) => list.join(" ")));
}

const number = (high: number) => int(0, high).pipe(Arbitrary.map(String));

/**
 * A link target that tries to break out of Slack's `<url|label>`: a `>` then a mention, a `|`, or
 * whitespace, written raw, as a numeric or named entity, or percent-encoded beside a raw one.
 */
const hostileTarget = oneOf(
  Arbitrary.Constant("https://example.test/&#62;&#60;!here&#62;"),
  Arbitrary.Constant("https://example.test/&gt;&lt;@U0123&gt;"),
  Arbitrary.Constant("https://example.test/a%3E&#x3C;#C0123&#x3E;"),
  Arbitrary.Constant("<https://example.test/a b|c><!channel>"),
  Arbitrary.Constant("https://example.test/a&#124;b")
);

const join = (parts: readonly string[]) => parts.join(" ");

/**
 * Characters of one to eight UTF-16 units that a cut must not split: an astral emoji, a flag of
 * two regional indicators, a family of three emoji joined by ZWJs, a letter with a combining
 * accent, a CJK character and an astral letter. None is a vocabulary word.
 */
const cluster = pick(["😀", "🇳🇴", "👨\u200D👩\u200D👧", "e\u0301", "字", "𝒜"]);

/** A run of up to 2,500 such characters with no space, long enough to be cut inside. */
const clusterRun = listOf(cluster, 1, 2500).pipe(Arbitrary.map((list) => list.join("")));

/** The short inline elements. */
const lightInline: readonly Arbitrary.Arbitrary<string>[] = [
  words(1, 6),
  words(1, 3).pipe(Arbitrary.map((text) => `**${text}**`)),
  words(1, 3).pipe(Arbitrary.map((text) => `*${text}*`)),
  words(1, 3).pipe(Arbitrary.map((text) => `_${text}_`)),
  words(1, 3).pipe(Arbitrary.map((text) => `~~${text}~~`)),
  Arbitrary.all([words(1, 2), words(1, 2), words(1, 2)]).pipe(
    Arbitrary.map(([a, b, c]) => `**${a} *${b}* ${c}**`)
  ),
  Arbitrary.all([words(1, 3), number(99)]).pipe(
    Arbitrary.map(([text, n]) => `[${text}](https://example.test/p${n})`)
  ),
  Arbitrary.all([words(1, 3), number(9)]).pipe(Arbitrary.map(([text, n]) => `[${text}](./doc${n}.md)`)),
  Arbitrary.all([words(1, 3), hostileTarget]).pipe(Arbitrary.map(([text, target]) => `[${text}](${target})`)),
  Arbitrary.all([words(1, 3), hostileTarget]).pipe(
    Arbitrary.map(([text, target]) => `![${text}](${target})`)
  ),
  Arbitrary.all([words(1, 3), pick(["ref", "docs", "Hostile"])]).pipe(
    Arbitrary.map(([text, label]) => `[${text}][${label}]`)
  ),
  Arbitrary.all([number(99), word]).pipe(Arbitrary.map(([n, text]) => `https://example.test/u${n} ${text}`)),
  words(1, 3).pipe(Arbitrary.map((text) => `\`${text}\``)),
  Arbitrary.all([words(1, 2), words(1, 2)]).pipe(Arbitrary.map(([a, b]) => `\`\`${a}\`${b}\`\``)),
  Arbitrary.all([words(1, 2), words(1, 2)]).pipe(Arbitrary.map(([a, b]) => `\`\`\`${a}\`\`${b}\`\`\``)),
  Arbitrary.all([word, pick(["<", ">", "&", "&&", "\\`"]), word]).pipe(Arbitrary.map(join)),
  Arbitrary.all([pick(["@here", "@channel", "@everyone", "<!here>", "#general"]), word]).pipe(
    Arbitrary.map(join)
  ),
];

/**
 * Inline Markdown: emphasis, links, relative links, reference links, bare URLs, images, code spans
 * (some holding backticks), link targets that try to post a mention, characters to escape, an
 * escaped backtick, mentions, and, less often, labels and code of hundreds of words, long runs
 * of words, and long runs of emoji and other multi-unit characters as text, code and a label. A
 * vocabulary word follows each run, so a cut inside a run's code or label always loses a word.
 */
const inline: Arbitrary.Arbitrary<string> = oneOf(
  words(1, 6),
  ...lightInline,
  ...lightInline,
  Arbitrary.all([clusterRun, word]).pipe(Arbitrary.map(([run, after]) => `${run} ${after}`)),
  Arbitrary.all([clusterRun, word]).pipe(Arbitrary.map(([run, after]) => `\`${run} ${after}\``)),
  Arbitrary.all([clusterRun, word, number(9)]).pipe(
    Arbitrary.map(([run, after, n]) => `[${run} ${after}](https://example.test/e${n})`)
  ),
  Arbitrary.all([words(100, 600), number(99)]).pipe(
    Arbitrary.map(([text, n]) => `[${text}](https://example.test/l${n})`)
  ),
  words(100, 600).pipe(Arbitrary.map((text) => `\`${text}\``)),
  words(200, 1200)
);

const sequence = listOf(inline, 1, 6).pipe(Arbitrary.map(join));

/**
 * A fenced block: backtick or tilde, three to five long, with an info string, holding `## ` lines,
 * fences that do not close it and runs followed by a no-break space, at the margin or indented.
 */
const fenced: Arbitrary.Arbitrary<string[]> = Arbitrary.all({
  char: pick(["`", "~"]),
  length: int(3, 5),
  indent: pick(["", "  "]),
  info: pick(["", "ts", "md", "sh"]),
  closer: int(0, 1),
}).pipe(
  Arbitrary.flatMap(({ char, length, indent, info, closer }) => {
    const other = char === "`" ? "~" : "`";
    const line = oneOf(
      words(1, 8),
      words(1, 3).pipe(Arbitrary.map((text) => `## ${text}`)),
      words(1, 2).pipe(Arbitrary.map((text) => `${other.repeat(3)} ${text}`)),
      words(1, 2).pipe(Arbitrary.map((text) => `${length > 3 ? char.repeat(3) : other.repeat(4)} ${text}`)),
      words(1, 2).pipe(Arbitrary.map((text) => `${char.repeat(length)}\u00A0${text}`)),
      words(400, 900),
      Arbitrary.Constant("")
    );
    return listOf(line, 1, 6).pipe(
      Arbitrary.map((body) => [
        `${indent}${char.repeat(length)}${info}`,
        ...body.map((text) => (text === "" ? "" : `${indent}${text}`)),
        `${indent}${char.repeat(length + closer)}`,
      ])
    );
  })
);

/**
 * Content nested `depth` levels deep, up to twice the renderer's 32: quotes, lists, or emphasis
 * spans inside a link, around vocabulary words.
 */
const nested: Arbitrary.Arbitrary<string[]> = Arbitrary.all({
  depth: int(1, 64),
  text: words(1, 4),
  more: words(1, 3),
  alt: words(1, 3),
}).pipe(
  Arbitrary.flatMap(({ depth, text, more, alt }) =>
    oneOf<string[]>(
      Arbitrary.Constant([`${"> ".repeat(depth)}${text}`]),
      Arbitrary.Constant([`${"- ".repeat(depth)}${text}`]),
      Arbitrary.Constant([
        `[${"*a _b ".repeat(depth)}${text}${"_ c* d".repeat(depth)}](https://example.test/n)`,
      ]),
      // A hard break, and an image with alt text, inside the quote.
      Arbitrary.Constant([`${"> ".repeat(depth)}${text}\\`, `${"> ".repeat(depth)}${more}`]),
      Arbitrary.Constant([`${"> ".repeat(depth)}${text} ![${alt}](https://example.test/i.png) ${more}`])
    )
  )
);

/** One block of a version's notes, as its lines; list items are three times as likely. */
const item = sequence.pipe(Arbitrary.map((text) => [`- ${text}`]));
const block: Arbitrary.Arbitrary<string[]> = oneOf(
  item,
  item,
  item,
  Arbitrary.all([sequence, words(1, 6), words(1, 6)]).pipe(
    Arbitrary.map(([text, first, second]) => [`- ${text}`, "", `      ${first}`, `      ${second}`, ""])
  ),
  Arbitrary.all([sequence, words(1, 6)]).pipe(
    Arbitrary.map(([text, code]) => [`- ${text}`, "", "  ```ts", `  ${code}`, "  ```", ""])
  ),
  sequence.pipe(Arbitrary.map((text) => [`  ${text}`])),
  words(1, 4).pipe(Arbitrary.map((text) => [`### ${text}`])),
  sequence.pipe(Arbitrary.map((text) => [`> ${text}`])),
  Arbitrary.Constant([""]),
  fenced,
  nested
);

/**
 * Changelog notes from a small grammar, mostly a few blocks and sometimes up to 40, at sizes around
 * the 3,000 and 12,000 character marks,
 * followed by the definitions its reference links use, one of whose targets tries to post a
 * mention. Every element with content holds a vocabulary word, so content left out always lowers
 * some word's count.
 */
const notes = oneOf(int(1, 6), int(1, 6), int(1, 6), int(7, 40)).pipe(
  Arbitrary.flatMap((count) => Arbitrary.array(block, { minLength: count, maxLength: count })),
  Arbitrary.map((blocks) =>
    [
      ...blocks.flat(),
      "",
      "[ref]: https://example.test/ref",
      "[docs]: ./docs.md",
      "[hostile]: https://example.test/&#62;&#60;!here&#62;",
    ].join("\n")
  )
);

/** How often each vocabulary word occurs in a text. */
function vocabularyCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const vocabulary: ReadonlySet<string> = new Set(VOCABULARY);
  for (const found of text.match(/[a-z]+/gu) ?? []) {
    if (vocabulary.has(found)) counts.set(found, (counts.get(found) ?? 0) + 1);
  }
  return counts;
}

/**
 * The problems a section has as Slack mrkdwn, by rules independent of how it was made: its
 * length, paired fences, no stray backtick, `*`, `_` or `~` outside code and link targets, and no
 * `<`, `>` or `&` outside links and entities.
 */
function sectionProblems(text: string): string[] {
  const problems: string[] = [];
  if (text.length > 3000) problems.push(`is ${String(text.length)} characters`);
  // Slack reads `<!here>`, `<@U…>` and `<#C…>` as mentions even in verbatim text, and every
  // literal `<` this code writes is escaped, so any of them is an injected mention.
  if (/<[!@#]/u.test(text)) problems.push("posts a mention");
  const lines = text.split("\n");
  const fences = lines.filter((line) => line === "```").length;
  if (fences % 2 !== 0) problems.push("has an unpaired fence");
  if ((text.match(/```/gu) ?? []).length !== fences) problems.push("has three backticks inside a line");
  let inCode = false;
  const prose = lines
    .filter((line) => {
      if (line === "```") inCode = !inCode;
      return !inCode && line !== "```";
    })
    .join("\n")
    .replaceAll(/`[^`\n]*`/gu, "");
  if (prose.includes("`")) problems.push("has a stray backtick");
  const labels = prose
    .replaceAll(/<(?:https?:\/\/|mailto:)[^<>|\s]*\|([^<>]*)>/gu, "$1")
    .replaceAll(/<(?:https?:\/\/|mailto:)[^<>\s]*>/gu, "");
  for (const mark of ["*", "_", "~"]) {
    if (labels.split(mark).length % 2 === 0) problems.push(`has an unpaired ${mark}`);
  }
  // A quote marker is `>` at a line's start, before a space or the line's end; a nested quote
  // repeats it, as Markdown writes one.
  const bare = labels.replaceAll(/^(?:>(?: |$))+/gmu, "");
  if (/[<>]/u.test(bare)) problems.push("has an unescaped angle bracket");
  if (/&(?!amp;|lt;|gt;)/u.test(bare)) problems.push("has an unescaped &");
  return problems;
}

/**
 * Whether a section holds an opening fence followed at once by its own closing fence. A closing
 * fence followed by the next block's opening fence is two blocks, not an empty one.
 */
function hasEmptyCodeBlock(text: string): boolean {
  const lines = text.split("\n");
  let inCode = false;
  for (const [index, line] of lines.entries()) {
    if (line !== "```") continue;
    if (!inCode && lines[index + 1] === "```") return true;
    inCode = !inCode;
  }
  return false;
}

/**
 * Whether the generated notes nest past the renderer's 32 levels, read from the generator's own
 * shapes: 33 quote or list markers at a line's start, or 16 pairs of emphasis inside a link,
 * whose label is the first level.
 */
function deeplyNested(markdown: string): boolean {
  return (
    /^(?:> ){33}/mu.test(markdown) || /^(?:- ){33}/mu.test(markdown) || /(?:\*a _b ){16}/u.test(markdown)
  );
}

/** Every text a message posts: its notification text and each block's text. */
function textsOf(message: Announcement.Message): string[] {
  return [
    message.text,
    ...message.blocks.flatMap((block) =>
      block.type === "context" ? block.elements.map((element) => element.text) : [block.text.text]
    ),
  ];
}

/** The problems a line has as Unicode text, by Unicode's rules rather than a segmenter's. */
function unicodeProblems(text: string): string[] {
  const problems: string[] = [];
  if (!text.isWellFormed()) problems.push("is not well-formed UTF-16");
  for (const line of text.split("\n")) {
    if (/^[\p{M}\u200D]/u.test(line)) problems.push("has a line starting inside a character");
    if (/\u200D$/u.test(line)) problems.push("has a line ending inside a character");
    for (const run of line.match(/[\u{1F1E6}-\u{1F1FF}]+/gu) ?? []) {
      // Each regional indicator is two units, and a flag is two of them.
      if (run.length % 4 !== 0) problems.push("splits a flag");
    }
  }
  return problems;
}

/** Every rule the announcement of `markdown` breaks. */
function announcementProblems(markdown: string): string[] {
  // Every generated changelog opens with this note, so notes that lose everything fail.
  const text = `# @elmeragroup/fuse\n\n## 1.0.0\n\n- First note.\n\n${markdown}\n\n## 0.9.0\n\n- Old.\n`;
  const notes = versionNotes(Changelog.Whole({ text }), "1.0.0");
  const message = Announcement.stable(stableRelease("1.0.0"), notes, repository);
  // Flattening keeps every word, so notes shortened only by nesting must show them all.
  const flattenedOnly =
    notes._tag === "Notes" && notes.extent._tag === "Shortened" && notes.extent.by === "nesting";
  const texts = sectionTexts(message);
  const problems: string[] = [];
  if (texts.length === 0 || texts.length > 4) problems.push(`has ${String(texts.length)} sections`);
  for (const [at, section] of texts.entries()) {
    for (const problem of sectionProblems(section)) problems.push(`section ${String(at + 1)} ${problem}`);
  }
  if (texts.some(hasEmptyCodeBlock)) problems.push("has an empty code block");
  for (const text of textsOf(message)) for (const problem of unicodeProblems(text)) problems.push(problem);
  if (mrkdwnObjects(message).some((object) => !object.verbatim)) problems.push("has a parsed text");
  const json = JSON.stringify(message);
  if (!(texts[0] ?? "").startsWith("• First note.")) problems.push("does not show the first note first");
  if (json.includes("Old.")) problems.push("shows the older version's notes");
  const cut = json.includes("These notes are shortened.");
  if (cut && !json.includes("CHANGELOG.md#100|Read them in full"))
    problems.push("cut without the full-notes link");
  const shown = vocabularyCounts(texts.join("\n"));
  const counts = [...vocabularyCounts(markdown)];
  for (const [found, count] of counts) {
    const kept = shown.get(found) ?? 0;
    if (cut && !flattenedOnly ? kept > count : kept !== count)
      problems.push(`shows ${found} ${String(kept)} times, not ${String(count)}`);
  }
  // Every element with content holds a vocabulary word, so a cut that kept every word is false,
  // unless content nested past 32 levels was shown flattened, which keeps its words.
  const nestedTooDeep = deeplyNested(markdown);
  if (cut && !nestedTooDeep && counts.every(([found, count]) => shown.get(found) === count)) {
    problems.push("says it is shortened but kept every word");
  }
  if (nestedTooDeep && !cut) problems.push("flattens content nested past 32 levels without saying so");
  return problems;
}

describe("generated notes", () => {
  it.prop(
    "keep Slack's rules and every word unless the announcement says they are shortened",
    { markdown: notes },
    ({ markdown }) => {
      const problems = announcementProblems(markdown);
      assert.deepStrictEqual(problems, [], problems.join("; "));
    },
    // A fixed seed generates the same notes on every run, and a failure prints its replay token.
    // `maxShrinks` bounds the shrink search after a failure by a count of candidates, not by time,
    // so a failing property reports a small counterexample after at most 50 more checks. The test
    // timeout only guards against a hang.
    { timeout: 120_000, arbitrary: { seed: 20_261_105, runs: 240, maxShrinks: 50 } }
  );
});
