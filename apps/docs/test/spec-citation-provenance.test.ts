import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(here, "../../..");
const specRoot = join(workspaceRoot, "docs/spec");
const adrRoot = join(workspaceRoot, "docs/adr");

// `\b(?!-)` keeps `ruling 2026-09-02` as a dated event, not citation id 2026 / 202.
const CITATION = /\b(?<kind>ticket|ruling)\s+(?<id>\d+[a-z]?)\b(?!-)/gi;
const DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const DATED_PHRASE = /\b(?:ticket|ruling)\s+\d+[a-z]?\b(?!-)\s*[,:(]\s*\d{4}-\d{2}-\d{2}/i;
const REQUIRED_IDS = ["74b", "79", "82"] as const;

type CitationHit = {
  readonly file: string;
  readonly line: number;
  readonly kind: string;
  readonly id: string;
  readonly text: string;
};

function markdownFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...markdownFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path);
    }
  }
  return files;
}

function collectCitations(root: string): CitationHit[] {
  const hits: CitationHit[] = [];
  for (const file of markdownFiles(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((text, index) => {
      CITATION.lastIndex = 0;
      for (const match of text.matchAll(CITATION)) {
        const kind = match.groups?.kind ?? "";
        const id = match.groups?.id ?? "";
        const prefix = text.slice(0, match.index);
        if (kind.toLowerCase() === "ticket" && /\bwayfinder\s+$/i.test(prefix)) {
          continue;
        }
        hits.push({
          file: relative(workspaceRoot, file),
          line: index + 1,
          kind,
          id,
          text,
        });
      }
    });
  }
  return hits;
}

function substanceLength(line: string): number {
  return line
    .replace(CITATION, " ")
    .replace(DATE, " ")
    .replace(/[_*`[\]()#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}

describe("spec citation provenance", () => {
  const citations = [...collectCitations(specRoot), ...collectCitations(adrRoot)];

  it("places every ticket/ruling citation on a dated line with one-sentence substance", () => {
    expect(citations.length, "expected dated 74b/79/82 citations to exist").toBeGreaterThan(0);
    const missing = citations.filter((hit) => !DATED_PHRASE.test(hit.text) || substanceLength(hit.text) < 40);
    expect(
      missing,
      missing.map((hit) => `${hit.file}:${String(hit.line)} ${hit.kind} ${hit.id}`).join("\n")
    ).toEqual([]);
  });

  it("records rulings 74b, 79, and 82 as dated self-contained citations", () => {
    const ids = new Set(citations.map((hit) => hit.id.toLowerCase()));
    expect(
      REQUIRED_IDS.filter((id) => !ids.has(id)),
      "docs/spec and docs/adr must cite 74b, 79, and 82 with a date and substance"
    ).toEqual([]);
  });
});
