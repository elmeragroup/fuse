import * as Schema from "effect/Schema";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Catalog } from "@elmeragroup/docs-catalog";
import type { CatalogDocument } from "@elmeragroup/docs-catalog";

// Unit under test: the `read_doc` hrefs the shipped skills name. Oracle: the catalog that
// `docs#generate` writes, which the server answers from. A skill that names a page or section the
// catalog lacks sends its reader to an error line instead of the fact it needs.

const skillsDirectory = join(import.meta.dirname, "..", "skills");
const catalogFile = join(import.meta.dirname, "..", "..", "docs", "src", "generated", "catalog.json");

const catalog = Schema.decodeSync(Schema.fromJsonString(Catalog))(readFileSync(catalogFile, "utf8"));
const documents = new Map(catalog.documents.map((document) => [document.href, document]));
const components = catalog.documents.filter((document) => document.href.startsWith("/components/"));

/** The path that stands for every component page, as the skills write it. */
const ANY_COMPONENT = "/components/<name>";

/** A code span: the text between two backticks on one line. */
const CODE_SPAN = /`([^`\n]+)`/gu;

/** A site path in prose: a `/` that starts a word, up to the next space, backtick, quote, parenthesis or comma. */
const SITE_PATH = /(?<![\w.:/<@~-])\/[A-Za-z<][^\s`'"(),]*/gu;

/** Whether a code span's text is an href: it starts with a site path. */
const isHref = (span: string) => /^\/[A-Za-z<]/u.test(span);

/**
 * The hrefs a skill names: each code span that is an href, every character kept, as the reader
 * passes it to `read_doc`.
 */
function hrefsIn(text: string): readonly string[] {
  return [...text.matchAll(CODE_SPAN)].map(([, span = ""]) => span).filter(isHref);
}

/**
 * The site paths a skill writes anywhere but in a code span of their own, such as in prose or
 * inside a longer span. {@link hrefsIn} would leave each of them unchecked.
 */
function strayPathsIn(text: string): readonly string[] {
  const rest = text.replace(CODE_SPAN, (span, inner: string) => (isHref(inner) ? " " : span));
  return [...rest.matchAll(SITE_PATH)].map(([path]) => path);
}

/**
 * Every bare fragment in a skill's text, such as `#usage`, which names a section of whichever
 * component page the reader has chosen: each `#` that starts a word and is no part of a path or a
 * heading.
 */
function fragmentsIn(text: string): readonly string[] {
  return [...text.matchAll(/(?<![\w/<>.#-])#([a-z0-9][\w-]*)/gu)].map(([, id = ""]) => id);
}

/** The component pages that lack a section, by href. */
function pagesWithout(fragment: string): readonly string[] {
  return components
    .filter((document) => !document.sections.some((section) => section.id === fragment))
    .map((document) => document.href);
}

/** Why `read_doc` would not answer an href with docs text, or `undefined` when it would. */
function problem(href: string): string | undefined {
  if (href === "/llms.txt") return undefined;
  const [path = "", fragment, ...rest] = href.split("#");
  if (rest.length > 0) return "it has more than one fragment";
  const lacks = (document: CatalogDocument) =>
    fragment !== undefined && !document.sections.some((section) => section.id === fragment);
  if (path === ANY_COMPONENT) {
    const missing = fragment === undefined ? [] : pagesWithout(fragment);
    return missing.length === 0 ? undefined : `#${fragment} is missing from ${missing.join(", ")}`;
  }
  const document = documents.get(path);
  if (document === undefined) return `the catalog has no document ${path}`;
  if (document.sections.length === 0) return `${path} has no markdown, so read_doc answers it with a URL`;
  return lacks(document) ? `${path} has no section #${fragment}` : undefined;
}

const skills = readdirSync(skillsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

it("finds the component pages that a /components/<name> href stands for", () => {
  expect(components.length).toBeGreaterThan(0);
});

describe.each(skills)("the %s skill", (skill) => {
  const text = readFileSync(join(skillsDirectory, skill, "SKILL.md"), "utf8");
  const hrefs = hrefsIn(text);

  it("names at least one read_doc href", () => {
    expect(hrefs.length).toBeGreaterThan(0);
  });

  it("writes every site path as a code span of its own", () => {
    expect(strayPathsIn(text)).toEqual([]);
  });

  it("names only hrefs that read_doc answers with docs text", () => {
    const problems = hrefs.flatMap((href) => {
      const reason = problem(href);
      return reason === undefined ? [] : [`${href}: ${reason}`];
    });
    expect(problems).toEqual([]);
  });

  // A bare fragment stands for a section of any component page, so every one must have it. A
  // section only some pages have is written with its page, such as /components/form#composition.
  it("names only bare fragments that every component page has as a section", () => {
    const problems = fragmentsIn(text).flatMap((id) => {
      const missing = pagesWithout(id);
      return missing.length === 0 ? [] : [`#${id} is missing from ${String(missing.length)} pages`];
    });
    expect(problems).toEqual([]);
  });
});
