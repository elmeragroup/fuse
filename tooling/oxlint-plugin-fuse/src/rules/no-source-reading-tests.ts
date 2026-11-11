import type { ESTree, Rule } from "@oxlint/plugins";

import { descendants, unwrap } from "../ast-walk.ts";
import { anyViolates } from "../quantify.ts";
import { calleeTargets, enter, evaluate, isApi, memberName, product } from "../resolve.ts";
import type { ActivePath, Alt } from "../resolve.ts";
import { staticText, stringLiteral } from "../static-text.ts";
import { callSitesOf, reachOf } from "../test-context.ts";

/** The calls that read a file's text, by their resolved last name. */
const READS = new Set(["readFileSync", "readFile", "readFileString"]);

/** The calls that list a directory, which hand a walk the paths it reads. */
const LISTINGS = new Set(["readdirSync", "readdir", "globSync", "glob", "opendirSync"]);

/** The array methods a walk chains on its listing, whose callbacks filter what it keeps. */
const ARRAY_STEPS = new Set([
  "filter",
  "map",
  "flatMap",
  "sort",
  "toSorted",
  "slice",
  "concat",
  "reverse",
  "toReversed",
]);

/** The calls that build a path from fragments, by their last name. */
const PATH_BUILDERS = new Set(["join", "resolve", "fileURLToPath", "URL"]);

/** A code module's file name: TypeScript or JavaScript, declaration files aside. */
const CODE_FILE = /(?<!\.d)\.[cm]?[jt]sx?$/u;

/** A raw import of a code module, which hands the test its text. */
const RAW_CODE_IMPORT = /(?<!\.d)\.[cm]?[jt]sx?\?raw$/u;

/** Any file extension at the end of a path fragment. */
const EXTENSION = /\.[a-z0-9]+$/iu;

/** A string a file walk keeps code by: a bare extension (`".tsx"`) or a glob (`**\/*.{ts,tsx}`). */
const CODE_KEEP = /^\.[cm]?[jt]sx?$|\*\.(?:[cm]?[jt]sx?|\{[^}]*\b[cm]?[jt]sx?\b[^}]*\})$/u;

/** A regular expression that matches code file names by their end: `\.tsx?$`, `\.(ts|tsx)$`. */
const CODE_PATTERN = /\\\.[^$]{0,12}?[jt]sx?[^$]{0,6}\$/u;

/**
 * What a read's path spells: its literal fragments, and the walk-shaped values (a callback
 * parameter or a loop binding) it is computed from, whose origins decide whether it is code.
 */
type PathSpelling = { readonly fragments: ReadonlyArray<string>; readonly walked: ReadonlyArray<Alt> };

/** Where a walk-shaped path value comes from: a walk to inspect, or a call-site argument to classify. */
type Origin = { readonly kind: "walk" | "argument"; readonly node: ESTree.Node };

/**
 * No source-reading tests: a test does not read a code module's text, by `readFileSync`,
 * `readFile` or `readFileString`, or a static or dynamic `?raw` import, to grep it. A check on how
 * source is spelled goes red on an identifier-only refactor; write it as a rule in
 * `tooling/oxlint-plugin-fuse`, which states the contract once and reports it in the editor. A path
 * counts as code when a fragment it spells ends in a code extension; when it comes through a reader
 * helper's parameter from a call site that passes a code path; or, for a path taken from a loop
 * binding or a callback parameter, when the walk that supplies it lists a directory (`readdirSync`,
 * `glob`) and keeps code files by an extension (`".tsx"`, `**\/*.ts`, `/\.tsx?$/`). A walk read off
 * one property (`paths().logs`, `const { logs } = paths()`) is judged by that property's value
 * alone. Reading JSON (a read the resolved `JSON.parse` takes), CSS, Markdown, declaration files
 * and data the test wrote stays allowed.
 *
 * Scope: follows what `resolve.ts` follows, for the reader (named, aliased, namespace or
 * destructured import) and for the path and its walk, and finds a helper's call sites as
 * `test-context.ts` does. Beyond that: a reader other than `readFileSync`, `readFile` and
 * `readFileString`, and a listing other than `readdirSync`, `readdir`, `glob`, `globSync` and
 * `opendirSync`, are not recognised.
 */
export const noSourceReadingTests: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid tests that read code modules as text." },
    messages: {
      source:
        "This test reads a code module's text, which a refactor that keeps behavior breaks. State a source contract as a rule in tooling/oxlint-plugin-fuse, or assert the module's behavior through its exports.",
    },
    schema: [],
  },
  create(context) {
    const NOTHING: PathSpelling = { fragments: [], walked: [] };

    /** The last name of each target a callee may name, one per alternative. */
    const lastNames = (callee: ESTree.Node): Array<string | undefined> =>
      calleeTargets(context, callee).map((target) => target?.path.at(-1));

    /** Every spelling of parts in order: one per combination of their alternatives' spellings. */
    const merge = (parts: ReadonlyArray<ESTree.Node | string>, path: ActivePath): PathSpelling[] =>
      product(
        parts.map((part) =>
          // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a template's literal chunk arrives as its text, an expression as its node
          typeof part === "string"
            ? [{ fragments: [part], walked: [] }]
            : evaluate(context, part).flatMap((alternative) => spell(alternative, path))
        ),
        (combination) => [
          {
            fragments: combination.flatMap((spelling) => spelling.fragments),
            walked: combination.flatMap((spelling) => spelling.walked),
          },
        ],
        NOTHING
      );

    /**
     * The spellings of one path alternative: a string is its own fragment; a callback parameter or
     * a loop binding is walked; a template, a `+` or a path builder (`join`, `resolve`,
     * `fileURLToPath`, `new URL`) the evaluator kept is spelled from its parts in order.
     */
    const spell = (alternative: Alt, path: ActivePath): PathSpelling[] => {
      if (alternative.kind === "string") return [{ fragments: [alternative.value], walked: [] }];
      if (alternative.kind === "parameter" || alternative.kind === "loop")
        return [{ fragments: [], walked: [alternative] }];
      if (alternative.kind !== "opaque") return [NOTHING];
      const expression = alternative.node;
      const inner = enter(path, expression);
      if (inner === undefined) return [NOTHING];
      switch (expression.type) {
        case "TemplateLiteral":
          // The template's literal chunks stay in place between its computed parts.
          return merge(
            expression.quasis.flatMap((quasi, index) => {
              const text = staticText(quasi);
              const part = expression.expressions[index];
              return part === undefined ? [text] : [text, part];
            }),
            inner
          );
        case "BinaryExpression":
          return expression.operator === "+" ? merge([expression.left, expression.right], inner) : [NOTHING];
        case "CallExpression":
        case "NewExpression":
          return anyViolates(
            lastNames(expression.callee),
            (name) => name !== undefined && PATH_BUILDERS.has(name)
          )
            ? merge(expression.arguments, inner)
            : [NOTHING];
        default:
          return [NOTHING];
      }
    };

    /**
     * The code a walk's source stands for. Array steps (`.filter(…)`, `.map(…)`) are peeled off
     * and their callbacks kept as evidence. An alternative reached through a property read
     * (`paths().logs`, `const { logs } = paths()`) stands for that property's value alone; an
     * `unknown` one (a reassigned binding) for nothing; any other for the source's own code, so a
     * helper that builds the list (by `push`, which the evaluator does not follow) stays in reach.
     */
    const walkCode = (source: ESTree.Node, path: ActivePath): ESTree.Node[] => {
      const node = unwrap(source);
      const inner = enter(path, node);
      if (inner === undefined) return [];
      if (node.type === "CallExpression" && ARRAY_STEPS.has(memberName(node.callee) ?? "")) {
        const callee = unwrap(node.callee);
        return callee.type === "MemberExpression"
          ? [...node.arguments, ...walkCode(callee.object, inner)]
          : [];
      }
      const code = evaluate(context, node).flatMap((alternative): ESTree.Node[] => {
        if (alternative.kind === "unknown") return [];
        if (!alternative.narrowed || (alternative.kind !== "opaque" && alternative.kind !== "array"))
          return [node];
        const expression = alternative.node;
        const peeled =
          expression.type === "CallExpression" && ARRAY_STEPS.has(memberName(expression.callee) ?? "");
        return peeled ? walkCode(expression, inner) : [expression];
      });
      return [...new Set(code)];
    };

    /**
     * Where a walk-shaped value's paths come from: a loop's iterable or the receiver of the array
     * method a callback parameter belongs to (a `walk`), or, for a helper's parameter, the argument
     * each call site passes (an `argument`, itself a path to classify).
     */
    const originsOf = (value: Alt): Origin[] => {
      if (value.kind === "loop") return [{ kind: "walk", node: value.iterable }];
      if (value.kind !== "parameter") return [];
      const fn = value.fn;
      const holder = fn.parent;
      if (holder?.type === "CallExpression" && holder.arguments.some((argument) => argument === fn)) {
        const callee = unwrap(holder.callee);
        return callee.type === "MemberExpression" ? [{ kind: "walk", node: callee.object }] : [];
      }
      return callSitesOf(context, fn).flatMap((site): Origin[] => {
        const argument = site.arguments[value.index];
        return argument === undefined ? [] : [{ kind: "argument", node: argument }];
      });
    };

    /** Whether the code a walk reaches lists a directory and keeps code files by extension. */
    const walksCode = (sources: ReadonlyArray<ESTree.Node>): boolean => {
      let lists = false;
      let keeps = false;
      for (const region of reachOf(context, sources)) {
        for (const node of descendants(context, region, "into-functions")) {
          if (node.type === "CallExpression") {
            lists ||= anyViolates(lastNames(node.callee), (name) => name !== undefined && LISTINGS.has(name));
          } else if (node.type === "Literal") {
            if ("regex" in node) keeps ||= CODE_PATTERN.test(node.regex.pattern);
            else keeps ||= CODE_KEEP.test(stringLiteral(node) ?? "");
          }
        }
      }
      return lists && keeps;
    };

    /** Whether one spelling names a code module: by its last named file, or by the walk it comes from. */
    const spellsCode = ({ fragments, walked }: PathSpelling, path: ActivePath): boolean => {
      const named = fragments.findLast((fragment) => EXTENSION.test(fragment));
      if (named !== undefined) return CODE_FILE.test(named);
      return walked.some((value) => {
        // A helper's parameter is followed into its call sites once per helper, so recursion stops.
        const inner = value.kind === "parameter" ? enter(path, value.fn) : path;
        if (inner === undefined) return false;
        return originsOf(value).some((origin) =>
          origin.kind === "walk" ? walksCode(walkCode(origin.node, path)) : isCodePath(origin.node, inner)
        );
      });
    };

    /** Whether a path may name a code module: any alternative's spelling does. */
    const isCodePath = (node: ESTree.Node, path: ActivePath): boolean =>
      anyViolates(evaluate(context, node), (alternative) =>
        anyViolates(spell(alternative, path), (spelling) => spellsCode(spelling, path))
      );

    const checkRawImport = (node: ESTree.Node, source: ESTree.Node): void => {
      const raw = (alternative: Alt): boolean =>
        alternative.kind === "string" && RAW_CODE_IMPORT.test(alternative.value);
      if (anyViolates(evaluate(context, source), raw)) context.report({ node, messageId: "source" });
    };

    /**
     * Whether a read's text goes straight into `JSON.parse`: the call that consumes it, past the
     * wrappers that keep its value (`await`, parentheses, `as`), is `JSON.parse` in every
     * alternative of its callee.
     */
    const parsedAsJson = (read: ESTree.Node): boolean => {
      let value: ESTree.Node = read;
      let consumer = value.parent;
      while (consumer !== null && consumer.type !== "CallExpression" && unwrap(consumer) === unwrap(value)) {
        value = consumer;
        consumer = consumer.parent;
      }
      if (consumer?.type !== "CallExpression" || !consumer.arguments.some((argument) => argument === value))
        return false;
      return isApi(context, consumer.callee, "JSON.parse");
    };

    return {
      ImportDeclaration(node) {
        checkRawImport(node, node.source);
      },
      ImportExpression(node) {
        checkRawImport(node, node.source);
      },
      CallExpression(node) {
        const [path] = node.arguments;
        const reads = anyViolates(lastNames(node.callee), (name) => name !== undefined && READS.has(name));
        if (path === undefined || !reads || parsedAsJson(node)) return;
        if (isCodePath(path, new Set())) context.report({ node, messageId: "source" });
      },
    };
  },
};
