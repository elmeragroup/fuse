import type { Rule } from "@oxlint/plugins";
import { readdirSync } from "node:fs";
import { basename, dirname } from "node:path";

/** A browser test's name: its stem, and the lane between the stem and `.browser.test`. */
const BROWSER_TEST = /^(?<stem>.+?)(?:\.(?<lane>engines|clipboard))?\.browser\.test\.[cm]?[jt]sx?$/u;

/** A production code module's name. */
const CODE_MODULE = /^(?<stem>.+)\.[cm]?[jt]sx?$/u;

/** A stylesheet's name, which a browser test can be named after but which owns no prefix. */
const STYLESHEET = /^(?<stem>.+)\.css$/u;

/** A test file of any project, which is never a production module. */
const TEST_FILE = /\.test(?:-d)?\.[cm]?[jt]sx?$/u;

/** One browser test file beside the linted one, read off its name. */
type BrowserFile = { readonly file: string; readonly stem: string; readonly lane: string };

/**
 * Each production module keeps its browser cases in one file per lane, named after it:
 * `<module>.browser.test.tsx`. A browser file's owner is the module it is named after, or else the
 * longest code module whose name its stem extends (`button-keyboard` belongs to `button.tsx`).
 * When one owner has more than one browser file in a lane, every file not named after the owner
 * is reported, so two split files with no canonical file both are. The `*.engines.browser.test.*`
 * and `*.clipboard.browser.test.*` lanes are counted on their own. A file that needs a page its
 * module's file cannot share, such as one without `themes.css`, carries a file-level disable
 * comment naming that page.
 *
 * Scope: follows nothing from `resolve.ts`; it reads file names only. Beyond that: only the linted
 * file's own directory is read, a browser file whose stem extends no module's name (`chart-keyboard`
 * beside no `chart.tsx`) has no owner and is not counted, and a stylesheet owns only the file named
 * exactly after it.
 */
export const oneBrowserTestPerModule: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid a second browser test file for one module." },
    messages: {
      second:
        "`{{file}}` is one of {{count}} browser test files for `{{owner}}`. Move its cases into `{{owner}}.browser.test.tsx` as a describe block; a page it cannot share goes in a file-level disable reason.",
    },
    schema: [],
  },
  create(context) {
    const file = basename(context.filename);
    const match = BROWSER_TEST.exec(file);
    const stem = match?.groups?.stem;
    if (stem === undefined) return {};
    const lane = match?.groups?.lane ?? "browser";
    const siblings = readdirSync(dirname(context.filename));
    const production = siblings.filter((sibling) => !TEST_FILE.test(sibling));
    const codeStems = new Set(production.flatMap((sibling) => CODE_MODULE.exec(sibling)?.groups?.stem ?? []));
    const sheetStems = new Set(production.flatMap((sibling) => STYLESHEET.exec(sibling)?.groups?.stem ?? []));
    const ownerOf = (name: string): string | undefined => {
      if (codeStems.has(name) || sheetStems.has(name)) return name;
      return [...codeStems]
        .filter((module) => name.startsWith(`${module}-`))
        .toSorted((left, right) => right.length - left.length)[0];
    };
    const owner = ownerOf(stem);
    if (owner === undefined || owner === stem) return {};
    const group = siblings.flatMap((sibling): BrowserFile[] => {
      const other = BROWSER_TEST.exec(sibling);
      const otherStem = other?.groups?.stem;
      if (otherStem === undefined || (other?.groups?.lane ?? "browser") !== lane) return [];
      return ownerOf(otherStem) === owner ? [{ file: sibling, stem: otherStem, lane }] : [];
    });
    if (!group.some((entry) => entry.file === file)) group.push({ file, stem, lane });
    if (group.length < 2) return {};
    return {
      Program(node) {
        context.report({ node, messageId: "second", data: { file, owner, count: String(group.length) } });
      },
    };
  },
};
