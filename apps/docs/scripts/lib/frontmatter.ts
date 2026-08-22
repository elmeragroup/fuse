/**
 * Frontmatter for the docs MDX pipeline.
 *
 * Deliberately a purpose-built parser for the small, fixed schema a component shell
 * declares, rather than a general YAML reader: the schema is closed, so unknown keys
 * and unsupported shapes are build failures instead of silently ignored input.
 */

/** A demo entry, in spec §10 scenario order. */
export type ShellDemo = {
  id: string;
  title: string;
  file: string;
};

/** The editorial half of a component page: everything generation cannot derive. */
export type ShellFrontmatter = {
  title: string;
  lede: string;
  entry: string | null;
  exportName: string | null;
  source: string | null;
  demos: readonly ShellDemo[];
};

export type SplitDocument = {
  frontmatter: string;
  /** MDX body with the frontmatter block replaced by blank lines, so line numbers survive. */
  body: string;
};

const FENCE = "---";
const SCALAR_KEYS = ["title", "lede", "entry", "export", "source"] as const;

/**
 * Splits a `---` fenced frontmatter block off the top of an MDX file. The block is
 * replaced with blank lines rather than removed so compiler diagnostics keep pointing
 * at the authored line numbers.
 */
export function splitFrontmatter(source: string): SplitDocument {
  const normalised = source.startsWith("﻿") ? source.slice(1) : source;
  if (!normalised.startsWith(`${FENCE}\n`)) {
    return { frontmatter: "", body: normalised };
  }
  const end = normalised.indexOf(`\n${FENCE}`, FENCE.length);
  if (end === -1) {
    return { frontmatter: "", body: normalised };
  }
  const frontmatter = normalised.slice(FENCE.length + 1, end);
  const consumedLength = end + 1 + FENCE.length;
  const consumed = normalised.slice(0, consumedLength);
  const blanks = "\n".repeat(consumed.split("\n").length - 1);
  return { frontmatter, body: `${blanks}${normalised.slice(consumedLength)}` };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isBlankOrComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed === "" || trimmed.startsWith("#");
}

type FoldedBlock = {
  value: string;
  nextIndex: number;
};

function readFoldedBlock(lines: readonly string[], start: number, fold: boolean): FoldedBlock {
  const collected: string[] = [];
  let index = start;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim() !== "" && !line.startsWith("  ")) {
      break;
    }
    collected.push(line.trim());
    index += 1;
  }
  while (collected.length > 0 && collected[collected.length - 1] === "") {
    collected.pop();
  }
  return { value: fold ? collected.join(" ").trim() : collected.join("\n"), nextIndex: index };
}

function isScalarKey(key: string): boolean {
  return SCALAR_KEYS.some((known) => known === key);
}

type MutableDemo = {
  id: string;
  title: string;
  file: string;
};

function setDemoField(demo: MutableDemo, key: string, value: string, file: string): void {
  if (key === "id") {
    demo.id = value;
    return;
  }
  if (key === "title") {
    demo.title = value;
    return;
  }
  if (key === "file") {
    demo.file = value;
    return;
  }
  throw new Error(`${file}: unknown demo key "${key}"`);
}

function requireDemoField(demo: MutableDemo, field: "id" | "title" | "file", file: string): void {
  if (demo[field] === "") {
    throw new Error(`${file}: frontmatter demo entry is missing "${field}"`);
  }
}

/** Parses and validates the frontmatter of one component MDX shell. */
export function parseShellFrontmatter(frontmatter: string, file: string): ShellFrontmatter {
  if (frontmatter.trim() === "") {
    throw new Error(`${file}: component pages require a frontmatter block`);
  }
  const scalars = new Map<string, string>();
  const demos: MutableDemo[] = [];
  const lines = frontmatter.split("\n");

  let index = 0;
  let inDemos = false;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isBlankOrComment(line)) {
      index += 1;
      continue;
    }
    const itemMatch = /^ {2}-\s+([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    const nestedMatch = /^ {4}([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    const topMatch = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);

    if (itemMatch !== null && inDemos) {
      const demo: MutableDemo = { id: "", title: "", file: "" };
      setDemoField(demo, itemMatch[1] ?? "", unquote(itemMatch[2] ?? ""), file);
      demos.push(demo);
      index += 1;
      continue;
    }
    if (nestedMatch !== null && inDemos) {
      const current = demos[demos.length - 1];
      if (current === undefined) {
        throw new Error(`${file}: demo field appears outside a list item`);
      }
      setDemoField(current, nestedMatch[1] ?? "", unquote(nestedMatch[2] ?? ""), file);
      index += 1;
      continue;
    }
    if (topMatch === null) {
      throw new Error(`${file}: unparsable frontmatter line: ${line}`);
    }

    const key = topMatch[1] ?? "";
    const rawValue = (topMatch[2] ?? "").trim();
    if (key === "demos") {
      if (rawValue !== "") {
        throw new Error(`${file}: frontmatter key "demos" must be followed by a list`);
      }
      inDemos = true;
      index += 1;
      continue;
    }
    inDemos = false;
    if (!isScalarKey(key)) {
      throw new Error(`${file}: unknown frontmatter key "${key}"`);
    }
    if (rawValue === ">" || rawValue === "|") {
      const block = readFoldedBlock(lines, index + 1, rawValue === ">");
      scalars.set(key, block.value);
      index = block.nextIndex;
      continue;
    }
    scalars.set(key, unquote(rawValue));
    index += 1;
  }

  for (const demo of demos) {
    requireDemoField(demo, "id", file);
    requireDemoField(demo, "title", file);
    requireDemoField(demo, "file", file);
  }

  const title = scalars.get("title") ?? "";
  const lede = scalars.get("lede") ?? "";
  if (title === "") {
    throw new Error(`${file}: frontmatter key "title" is required`);
  }
  if (lede === "") {
    throw new Error(`${file}: frontmatter key "lede" is required`);
  }

  return {
    title,
    lede,
    entry: scalars.get("entry") ?? null,
    exportName: scalars.get("export") ?? null,
    source: scalars.get("source") ?? null,
    demos,
  };
}
