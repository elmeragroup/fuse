/**
 * Compile the classes the captures record against `fuse.css`, as a Tailwind-source consumer does,
 * and read back what the capture cascade resolves values against: the theme values Tailwind emits
 * and the custom properties it registers with `@property`. Tailwind emits a theme value and a
 * registration only for a utility it compiles, so the compile covers every captured class. The
 * same build, in `consumer-build.ts`, gives the comparison page the CSS of the classes a host app
 * compiles itself, and Tailwind's preflight.
 */

import { Effect } from "effect";

import type { KitSourceInvalid, KitToolFailed } from "./build-errors";
import { buildConsumerCss, consumerEntry, readCompiledUtilities } from "./consumer-build";
import type { AstNode, AtRule, CompiledUtilities } from "./consumer-build";
import { leadingClass } from "./css-selector";

/**
 * Compile the classes with `fuse.css` the way a Tailwind-source consumer does.
 *
 * @param classes - The classes, with or without variants.
 * @returns The theme values and registered properties. The Effect fails as `buildConsumerCss` does.
 */
export function compileUtilities(
  classes: readonly string[]
): Effect.Effect<CompiledUtilities, KitSourceInvalid | KitToolFailed> {
  return Effect.map(buildConsumerCss(classes), readCompiledUtilities);
}

/**
 * Compile a host app's own classes with `fuse.css`, as a standalone-CSS host's own Tailwind build
 * does for the classes it passes to Fuse components.
 *
 * @param classes - The host's classes, with or without variants.
 * @returns The rules that select the classes, one per line, each inside the at-rules that wrap it,
 *   such as `@media (hover: hover)`. The rest of the compile, which Fuse's own `styles.css`
 *   already holds, stays out. The Effect fails as {@link compileUtilities} does.
 */
export function compileHostUtilities(
  classes: readonly string[]
): Effect.Effect<string, KitSourceInvalid | KitToolFailed> {
  const wanted = new Set(classes);
  const select = (node: AstNode): AstNode[] => {
    if (node.kind === "rule") {
      return wanted.has(leadingClass(node.selector)?.name ?? "") ? [node] : [];
    }
    if (
      node.kind === "context" ||
      node.kind === "at-root" ||
      (node.kind === "at-rule" && node.name === "@layer")
    ) {
      return node.nodes.flatMap(select);
    }
    if (node.kind !== "at-rule" || node.name === "@property" || node.name === "@keyframes") {
      return [];
    }
    const nodes = node.nodes.flatMap(select);
    return nodes.length === 0 ? [] : [{ ...node, nodes }];
  };
  return Effect.map(buildConsumerCss(classes), (nodes) => nodes.flatMap(select).map(toCss).join("\n"));
}

/** The layer {@link compilePreflight} imports preflight into, so its rules stand apart in the output. */
const PREFLIGHT_LAYER = "fuse-figma-preflight";

/**
 * Compile Tailwind's preflight as a Tailwind-source host's build compiles `@import "tailwindcss"`
 * with `fuse.css`: each `--theme(--name, fallback)` it calls becomes `var(--name, fallback)`. A
 * browser reads an uncompiled `--theme()` as a function no rule defines and drops the declaration,
 * so the capture and comparison pages load this compile, as a host's pages do.
 *
 * @returns Preflight's rules, one per line. The Effect fails as {@link compileUtilities} does.
 */
export function compilePreflight(): Effect.Effect<string, KitSourceInvalid | KitToolFailed> {
  const preflight: AtRule = {
    kind: "at-rule",
    name: "@import",
    params: `"tailwindcss/preflight.css" layer(${PREFLIGHT_LAYER})`,
    nodes: [],
  };
  const [theme, ...rest] = consumerEntry();
  const entry = theme === undefined ? [preflight, ...rest] : [theme, preflight, ...rest];
  const layered = (node: AstNode): AstNode[] =>
    node.kind === "at-rule" && node.name === "@layer" && node.params === PREFLIGHT_LAYER
      ? node.nodes
      : node.kind === "context" || node.kind === "at-root"
        ? node.nodes.flatMap(layered)
        : [];
  return Effect.map(buildConsumerCss([], entry), (nodes) => nodes.flatMap(layered).map(toCss).join("\n"));
}

/**
 * Serialize a node of Tailwind's syntax tree. Tailwind's own printer is not exported. Comments
 * print nothing, and the compiler's context and at-root wrappers print their children.
 */
function toCss(node: AstNode): string {
  switch (node.kind) {
    case "rule":
      return `${node.selector}{${node.nodes.map(toCss).join("")}}`;
    case "at-rule":
      return node.nodes.length === 0
        ? `${node.name} ${node.params};`
        : `${node.name} ${node.params}{${node.nodes.map(toCss).join("")}}`;
    case "declaration":
      return node.value === undefined
        ? ""
        : `${node.property}:${node.value}${node.important ? " !important" : ""};`;
    case "comment":
      return "";
    case "context":
    case "at-root":
      return node.nodes.map(toCss).join("");
  }
}
