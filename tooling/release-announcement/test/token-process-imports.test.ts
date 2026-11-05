import { Schema } from "effect";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

// Unit under test: the import graph of the notify step's process, which holds the Slack token.
// Oracle: the fixed list of the Markdown parser's packages (micromark and its mdast utilities),
// which only the notes renderer's own process may load. Node itself resolves the graph: a resolve
// hook records every module the entry's static imports load before the step runs, and Node's type
// stripping drops type-only imports, which load nothing. Lint cannot see a module's transitive
// imports, so this suite records them.

/** The packages that parse Markdown, and theirs. */
const PARSER_PACKAGES = /^(?:micromark|mdast-util-)/u;

/** What the hook records of one resolution. */
const Resolution = Schema.fromJsonString(Schema.Struct({ specifier: Schema.String, url: Schema.String }));

const dir = mkdtempSync(join(tmpdir(), "release-announcement-imports-"));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/**
 * The specifiers and module URLs a Node process of `entry` resolves. The process runs with an
 * empty environment, so a step fails on its first setting, after every static import has loaded.
 */
function resolvedBy(entry: string) {
  const log = join(dir, `${entry}.jsonl`);
  const hook = join(dir, `${entry}.hook.mjs`);
  writeFileSync(log, "");
  writeFileSync(
    hook,
    [
      'import { appendFileSync } from "node:fs";',
      'import { registerHooks } from "node:module";',
      "registerHooks({",
      "  resolve(specifier, context, next) {",
      "    const resolved = next(specifier, context);",
      `    appendFileSync(${JSON.stringify(log)}, JSON.stringify({ specifier, url: resolved.url }) + "\\n");`,
      "    return resolved;",
      "  },",
      "});",
      "",
    ].join("\n")
  );
  const entryPath = new URL(`../src/${entry}`, import.meta.url);
  spawnSync(process.execPath, ["--import", pathToFileURL(hook).href, fileURLToPath(entryPath)], {
    env: {},
    stdio: "ignore",
    timeout: 30_000,
  });
  const records = readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => Schema.decodeUnknownSync(Resolution)(line));
  return { specifiers: records.map((record) => record.specifier), urls: records.map((record) => record.url) };
}

describe("the notify step's process", () => {
  it("loads no Markdown parser package", () => {
    const { specifiers, urls } = resolvedBy("announce-release.ts");
    // The hook saw the step's adapters, so the graph was walked past the entry.
    expect(urls).toContain(new URL("../src/slack-web-api.ts", import.meta.url).href);
    expect(urls).toContain(new URL("../src/isolated-notes.ts", import.meta.url).href);
    expect(specifiers.filter((specifier) => PARSER_PACKAGES.test(specifier))).toEqual([]);
  });

  it("leaves the parser to the renderer's process, where the same hook finds it", () => {
    const { specifiers } = resolvedBy("render-notes.ts");
    expect(specifiers).toEqual(
      expect.arrayContaining([
        "mdast-util-from-markdown",
        "mdast-util-gfm-strikethrough",
        "micromark-extension-gfm-strikethrough",
      ])
    );
  });
});
