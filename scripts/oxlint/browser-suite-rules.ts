import { filenameOf, resolve, spellingBan, staticText } from "./rule-kit.ts";
import type { Context, NodeOf, Rule } from "./rule-kit.ts";

/** The package-private hooks tier, whose probes mount no theme and may take the plain harness. */
const HOOKS_TIER = "/packages/fuse/src/hooks/";

/** The shared harnesses the suites mount through, which the plugin checks the tree still holds. */
export const BROWSER_SUITE_OWNERS: readonly string[] = [
  HOOKS_TIER,
  "/packages/fuse/test/themed-browser-render.tsx",
  "/packages/fuse/test/browser-render.ts",
];

const HARNESS_MESSAGE =
  "Mount the suite through test/themed-browser-render, which owns ThemeScope, density and CONTROL_MD; a hooks probe may take render from test/browser-render.";
const THEME_FIXTURES_MESSAGE =
  "Take theme fixtures from test/theme-fixtures through the shared harness; test/theme-browser-fixtures belongs to the theme suites.";
const FKAS_COPY_MESSAGE = "Import fkasPrivate from test/theme-fixtures instead of declaring a local copy.";

/**
 * Every component, react-aria and hooks browser suite mounts through the shared themed harness, and
 * none rebuilds the theme fixtures it owns.
 */
export const browserSuiteHarness: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Mount browser suites through the shared themed harness." },
    schema: [],
  },
  create(context) {
    const harness = filenameOf(context).includes(HOOKS_TIER)
      ? /test\/(?:themed-)?browser-render/u
      : /themed-browser-render/u;
    let mountsThroughHarness = false;
    const readSpecifier = (node: NodeOf<"Program">["body"][number], specifier: string): void => {
      if (harness.test(specifier)) mountsThroughHarness = true;
      if (specifier.includes("theme-browser-fixtures")) {
        context.report({ node, message: THEME_FIXTURES_MESSAGE });
      }
    };
    return {
      ImportDeclaration(node) {
        readSpecifier(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null) readSpecifier(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        readSpecifier(node, node.source.value);
      },
      VariableDeclarator(node) {
        // Every name the declarator binds, a destructured one included.
        if (context.sourceCode.getDeclaredVariables(node).some(({ name }) => name === "fkasPrivate")) {
          context.report({ node, message: FKAS_COPY_MESSAGE });
        }
      },
      "Program:exit"(node) {
        if (!mountsThroughHarness) context.report({ node, message: HARNESS_MESSAGE });
      },
    };
  },
};

/** A comment line that explains a deliberate DOM contract check, as `// DOM audit: why`. */
const DOM_AUDIT_COMMENT = /^\s*\*?\s*DOM audit:\s*\w/mu;
/** How many lines above a locator its DOM audit comment may sit. */
const DOM_AUDIT_WINDOW = 16;

/** The element queries a locator makes. */
const QUERIES: ReadonlySet<string> = new Set(["querySelector", "querySelectorAll", "closest"]);
/** The document roots a document-wide query starts from. */
const DOCUMENT_ROOTS: ReadonlySet<string> = new Set(["body", "head", "documentElement"]);

const LOCATOR_MESSAGE = `Locate by role or label through the shared browser helpers. A deliberate DOM contract check needs a "// DOM audit: <why>" comment on its line or within the ${String(DOM_AUDIT_WINDOW)} lines above.`;

type Lines = { readonly first: number; readonly last: number };

/** Whether `node` is the global `document`, or one of its roots such as `document.body`. */
function isDocumentRoot(context: Context, node: NodeOf<"MemberExpression">["object"]): boolean {
  const isDocument = (candidate: typeof node): boolean =>
    candidate.type === "Identifier" &&
    candidate.name === "document" &&
    resolve(context, candidate, "document", "value") === undefined;
  if (isDocument(node)) return true;
  return (
    node.type === "MemberExpression" &&
    !node.computed &&
    node.property.type === "Identifier" &&
    DOCUMENT_ROOTS.has(node.property.name) &&
    isDocument(node.object)
  );
}

/** Whether a call locates an element by `data-slot`, from a document root, or by a `*` walk. */
function isLocatorCall(context: Context, node: NodeOf<"CallExpression">): boolean {
  const { callee } = node;
  if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") {
    return false;
  }
  const query = callee.property.name;
  if (!QUERIES.has(query)) return false;
  if (query !== "closest" && isDocumentRoot(context, callee.object)) return true;
  const [selector] = node.arguments;
  const text = selector === undefined ? undefined : staticText(context, selector);
  if (text === undefined) return false;
  return text.includes("data-slot") || (query === "querySelectorAll" && text.trim() === "*");
}

/**
 * Browser suites and their shared fixtures locate by role or label. A query by `data-slot`, a
 * document-root `querySelector`, a `*` walk, a `dataset.slot` read or a `bySlot` helper is a DOM
 * contract check, and a `DOM audit:` comment on its line or just above it says why it is one. The
 * rule reads calls and comments from the AST, so a locator spread over lines counts, and query
 * code or audit text inside a string is neither a locator nor an exemption.
 */
export const locateByRole: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Locate by role or label, except documented DOM contract checks." },
    schema: [],
  },
  create(context) {
    const lineOf = (offset: number): number => context.sourceCode.getLocFromIndex(offset).line;
    const audits: Lines[] = context.sourceCode
      .getAllComments()
      .filter(({ value }) => DOM_AUDIT_COMMENT.test(value))
      .map(({ start, end }) => ({ first: lineOf(start), last: lineOf(end) }));
    const check = (
      node: NodeOf<"CallExpression"> | NodeOf<"MemberExpression"> | NodeOf<"FunctionDeclaration">
    ): void => {
      const first = lineOf(node.start);
      const last = lineOf(node.end);
      const audited = audits.some((audit) => audit.last >= first - DOM_AUDIT_WINDOW && audit.first <= last);
      if (!audited) context.report({ node, message: LOCATOR_MESSAGE });
    };
    return {
      CallExpression(node) {
        if (isLocatorCall(context, node)) check(node);
      },
      MemberExpression(node) {
        const { object, property } = node;
        const isSlot = node.computed
          ? staticText(context, property) === "slot"
          : property.type === "Identifier" && property.name === "slot";
        const onDataset =
          object.type === "MemberExpression" &&
          !object.computed &&
          object.property.type === "Identifier" &&
          object.property.name === "dataset";
        if (isSlot && onDataset) check(node);
      },
      FunctionDeclaration(node) {
        if (node.id?.name === "bySlot") check(node);
      },
    };
  },
};

/** Component and react-aria suites assert focus rings only through the shared helper. */
export const noRingShadowInSuites: Rule = spellingBan(
  "Assert focus rings through test/assert-focus-ring.",
  /--tw-ring-shadow/u,
  "Assert focus rings with expectFocusRing or expectNoFocusRing from test/assert-focus-ring.ts; a component suite does not read --tw-ring-shadow itself.",
  "comments-included"
);
