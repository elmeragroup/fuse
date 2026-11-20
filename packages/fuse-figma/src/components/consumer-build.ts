/**
 * Fuse-figma's one Tailwind build: the classes compiled with `fuse.css` as a standalone
 * Tailwind-source consumer compiles them, and the theme values and `@property` registrations its
 * syntax tree holds. `utility-css.ts` reads it for the kit build and the comparison page, and the
 * test fixtures read the same tree for each utility's declarations.
 */

import type { Effect } from "effect";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileAst } from "tailwindcss";

import { KitSourceInvalid, runTool } from "./build-errors";
import type { KitToolFailed } from "./build-errors";

/**
 * A node of Tailwind's syntax tree. Tailwind exports `compileAst` but not its node types, so
 * the reader takes them from that function's signature.
 */
export type AstNode = Parameters<typeof compileAst>[0][number];

/** An at-rule node of Tailwind's syntax tree, such as `@import` or `@layer`. */
export type AtRule = Extract<AstNode, { readonly kind: "at-rule" }>;

/** A `property: value` declaration of a block. */
export type Declaration = {
  readonly property: string;
  readonly value: string;
};

/** What the compile produced for a set of classes. */
export type CompiledUtilities = {
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
export function consumerEntry(): AstNode[] {
  return ['"tailwindcss/theme.css"', '"tailwindcss/utilities.css" source(none)', '"./fuse.css"'].map(
    (params): AtRule => ({ kind: "at-rule", name: "@import", params, nodes: [] })
  );
}

/**
 * Build the candidates against the standalone consumer entry and `fuse.css`.
 *
 * @param candidates - The classes Tailwind compiles.
 * @param entry - The stylesheet the build compiles, the consumer's entry unless a caller adds to it.
 * @returns The syntax tree `build` returns. The Effect fails with `KitSourceInvalid` when
 *   `fuse.css` imports what the build cannot load, and with `KitToolFailed` when Tailwind fails
 *   otherwise.
 */
export function buildConsumerCss(
  candidates: readonly string[],
  entry: AstNode[] = consumerEntry()
): Effect.Effect<AstNode[], KitSourceInvalid | KitToolFailed> {
  const stylesheets = new Map<string, string>([
    ["tailwindcss/theme.css", fileURLToPath(import.meta.resolve("tailwindcss/theme.css"))],
    ["tailwindcss/preflight.css", fileURLToPath(import.meta.resolve("tailwindcss/preflight.css"))],
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
    const compiler = await compileAst(entry, {
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
 * Read Tailwind's build output outside the `base` layer: the theme variables it emits on `:root`
 * and each `@property` registration.
 *
 * @param nodes - The syntax tree `build` returns.
 * @returns The theme values and registered properties.
 */
export function readCompiledUtilities(nodes: readonly AstNode[]): CompiledUtilities {
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
    if (node.kind === "rule" && node.selector === ":root, :host") {
      for (const declaration of declarationsOf(node.nodes)) {
        themeValues.set(declaration.property, declaration.value);
      }
    }
  };
  nodes.forEach(visit);
  return { themeValues, registeredProperties };
}

/**
 * The declarations among a block's nodes. An important declaration keeps `!important` in its
 * value, as Tailwind prints it.
 */
export function declarationsOf(nodes: readonly AstNode[]): Declaration[] {
  return nodes.flatMap((node) => {
    if (node.kind !== "declaration" || node.value === undefined) {
      return [];
    }
    const value = node.important ? `${node.value} !important` : node.value;
    return [{ property: node.property, value }];
  });
}
