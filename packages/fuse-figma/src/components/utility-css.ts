/**
 * Compile the classes the captures record against `fuse.css`, as a Tailwind-source consumer does,
 * and read back what the capture cascade resolves values against: the theme values Tailwind emits,
 * the custom properties it registers with `@property`, and the rules of the `base` layer. Tailwind
 * emits a theme value and a registration only for a utility it compiles, so the compile covers
 * every captured class. The same compile gives the comparison page the CSS of the classes a host
 * app compiles itself.
 */

import { Effect } from "effect";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileAst } from "tailwindcss";

import { KitSourceInvalid, runTool } from "./build-errors";
import type { KitToolFailed } from "./build-errors";
import { splitClassName } from "./class-name";
import { leadingClass } from "./css-selector";

/**
 * A node of Tailwind's syntax tree. Tailwind exports `compileAst` but not its node types, so
 * the reader takes them from that function's signature.
 */
type AstNode = Parameters<typeof compileAst>[0][number];
type AtRule = Extract<AstNode, { readonly kind: "at-rule" }>;

/** A `property: value` declaration of a utility. */
export type UtilityDeclaration = {
  readonly property: string;
  readonly value: string;
};

/** A utility's declarations, as a browser that supports `color-mix()` applies them. */
export type UtilityRule = {
  readonly utility: string;
  readonly declarations: readonly UtilityDeclaration[];
};

/** What the compile produced for a set of classes. */
export type CompiledUtilities = {
  /** Each bare utility Tailwind emitted a rule for. A utility it does not know is absent. */
  readonly rules: ReadonlyMap<string, UtilityRule>;
  /** The theme variables Tailwind emitted on `:root`, such as `--font-weight-medium: 500`. */
  readonly themeValues: ReadonlyMap<string, string>;
  /** Each custom property Tailwind registered with `@property`, such as `--tw-ring-offset-width`. */
  readonly registeredProperties: ReadonlyMap<string, RegisteredProperty>;
};

/**
 * What an `@property` rule says about its custom property: the value an element takes where
 * nothing sets it, and whether a child inherits its parent's value.
 */
export type RegisteredProperty = {
  readonly initialValue: string | undefined;
  /** False only where the rule says `inherits: false`, as Tailwind says for every `--tw-*`. */
  readonly inherits: boolean;
};

/**
 * The entry of a standalone consumer, as in `packages/fuse/test/tailwind-consumer-build.ts`.
 * `compileAst` replaces each `@import` node with the stylesheet it loads, so every compile
 * builds new nodes.
 */
function consumerEntry(): AstNode[] {
  return ['"tailwindcss/theme.css"', '"tailwindcss/utilities.css" source(none)', '"./fuse.css"'].map(
    (params): AtRule => ({ kind: "at-rule", name: "@import", params, nodes: [] })
  );
}

/**
 * Compile the classes and their bare utilities with `fuse.css` the way a Tailwind-source
 * consumer does.
 *
 * @param classes - The classes, with or without variants.
 * @returns The utility rules, theme values and registered properties. The Effect fails with `KitSourceInvalid` when `fuse.css` imports what the build
 *   cannot load, and with `KitToolFailed` when Tailwind fails otherwise.
 */
export function compileUtilities(
  classes: readonly string[]
): Effect.Effect<CompiledUtilities, KitSourceInvalid | KitToolFailed> {
  const candidates = new Set(classes.flatMap((className) => [className, splitClassName(className).utility]));
  return Effect.map(buildConsumerCss([...candidates]), readCompiledUtilities);
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

/** Build the candidates against the standalone consumer entry and `fuse.css`. */
function buildConsumerCss(
  candidates: readonly string[]
): Effect.Effect<AstNode[], KitSourceInvalid | KitToolFailed> {
  const stylesheets = new Map<string, string>([
    ["tailwindcss/theme.css", fileURLToPath(import.meta.resolve("tailwindcss/theme.css"))],
    ["tailwindcss/utilities.css", fileURLToPath(import.meta.resolve("tailwindcss/utilities.css"))],
    ["./fuse.css", fileURLToPath(import.meta.resolve("@elmeragroup/fuse/css"))],
    // `fuse.css` imports its private sheets from beside itself.
    [
      "./frame-variants.css",
      fileURLToPath(new URL("frame-variants.css", import.meta.resolve("@elmeragroup/fuse/css"))),
    ],
    [
      "./skeleton-reveal.css",
      fileURLToPath(new URL("skeleton-reveal.css", import.meta.resolve("@elmeragroup/fuse/css"))),
    ],
    [
      "tw-animate-css",
      fileURLToPath(new URL("../../node_modules/tw-animate-css/dist/tw-animate.css", import.meta.url)),
    ],
  ]);
  return runTool("tailwindcss", async () => {
    const compiler = await compileAst(consumerEntry(), {
      base: "/",
      loadStylesheet: async (id, base) => {
        const path = stylesheets.get(id);
        if (path === undefined) {
          throw new KitSourceInvalid({ message: `fuse.css imports no stylesheet named ${id}` });
        }
        return { path: id, base, content: await readFile(path, "utf8") };
      },
      loadModule: (id) =>
        Promise.reject(new KitSourceInvalid({ message: `fuse.css loads no plugin, received ${id}` })),
    });
    return compiler.build([...candidates]);
  });
}

/**
 * Read Tailwind's build output: each rule whose whole selector is one class, that utility's rule,
 * the theme variables it emits on `:root` and each `@property` registration, past the `base` layer,
 * which no class selects. A `@supports` block that tests `color-mix()` overrides the
 * declarations before it, because every browser Fuse supports passes that test.
 *
 * @param nodes - The syntax tree `build` returns.
 * @returns The utility rules, theme values and registered properties.
 */
function readCompiledUtilities(nodes: readonly AstNode[]): CompiledUtilities {
  const rules = new Map<string, UtilityRule>();
  const themeValues = new Map<string, string>();
  const registeredProperties = new Map<string, RegisteredProperty>();
  const visit = (node: AstNode): void => {
    if (node.kind === "at-rule") {
      if (node.name === "@property") {
        const descriptors = declarationsOf(node.nodes);
        const descriptor = (name: string) =>
          descriptors.find((declaration) => declaration.property === name)?.value.trim();
        registeredProperties.set(node.params, {
          initialValue: descriptor("initial-value"),
          inherits: descriptor("inherits") !== "false",
        });
        return;
      }
      if (node.name === "@layer" && node.params !== "base") {
        node.nodes.forEach(visit);
      }
      return;
    }
    if (node.kind !== "rule") {
      return;
    }
    if (node.selector === ":root, :host") {
      for (const declaration of declarationsOf(node.nodes)) {
        themeValues.set(declaration.property, declaration.value);
      }
      return;
    }
    const leading = leadingClass(node.selector);
    if (leading?.rest === "") {
      rules.set(leading.name, { utility: leading.name, declarations: effectiveDeclarations(node.nodes) });
    }
  };
  nodes.forEach(visit);
  return { rules, themeValues, registeredProperties };
}

/**
 * The declarations among a block's nodes. An important declaration keeps `!important` in its
 * value, as Tailwind prints it.
 */
function declarationsOf(nodes: readonly AstNode[]): UtilityDeclaration[] {
  return nodes.flatMap((node) => {
    if (node.kind !== "declaration" || node.value === undefined) {
      return [];
    }
    const value = node.important ? `${node.value} !important` : node.value;
    return [{ property: node.property, value }];
  });
}

function effectiveDeclarations(nodes: readonly AstNode[]): readonly UtilityDeclaration[] {
  return nodes.flatMap((node) => {
    if (node.kind === "at-rule") {
      return node.name === "@supports" && node.params.includes("color-mix(")
        ? declarationsOf(node.nodes)
        : [];
    }
    return declarationsOf([node]);
  });
}
