/**
 * Compile bare Tailwind utilities against `fuse.css` and read back each utility's
 * declarations. The spec builder strips a class's variants first and decides the state from
 * them itself, so it compiles only the utility. Tailwind's own compiler resolves the
 * utility, which keeps the spec on the exact CSS a consumer ships.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";

import { parseCss } from "./css-tree";
import type { CssDeclaration, CssNode } from "./css-tree";

/** A utility's declarations, as a browser that supports `color-mix()` applies them. */
export type UtilityRule = {
  readonly utility: string;
  /** The rule's position in Tailwind's output. A later rule wins a property tie. */
  readonly order: number;
  readonly declarations: readonly CssDeclaration[];
};

/** What the compile produced for a set of utilities. */
export type CompiledUtilities = {
  /** Each utility Tailwind emitted a rule for. A utility it does not know is absent. */
  readonly rules: ReadonlyMap<string, UtilityRule>;
  /** The theme variables Tailwind emitted on `:root`, such as `--font-weight-medium: 500`. */
  readonly themeValues: ReadonlyMap<string, string>;
  /** The `initial-value` of each `@property` Tailwind registered, such as `--tw-ring-offset-width`. */
  readonly propertyInitials: ReadonlyMap<string, string>;
};

/** The entry of a standalone consumer, as in `packages/fuse/test/tailwind-consumer-build.ts`. */
const CONSUMER_ENTRY =
  '@import "tailwindcss/theme.css";\n@import "tailwindcss/utilities.css" source(none);\n@import "./fuse.css";';

/**
 * Compile the utilities with `fuse.css` the way a Tailwind-source consumer does.
 *
 * @param utilities - Bare utilities, without variants.
 * @returns Each utility's declarations and the variables they read.
 */
export async function compileUtilities(utilities: readonly string[]): Promise<CompiledUtilities> {
  const stylesheets = new Map<string, string>([
    ["tailwindcss/theme.css", fileURLToPath(import.meta.resolve("tailwindcss/theme.css"))],
    ["tailwindcss/utilities.css", fileURLToPath(import.meta.resolve("tailwindcss/utilities.css"))],
    ["./fuse.css", fileURLToPath(import.meta.resolve("@elmeragroup/fuse/css"))],
    [
      "tw-animate-css",
      fileURLToPath(new URL("../../node_modules/tw-animate-css/dist/tw-animate.css", import.meta.url)),
    ],
  ]);
  const compiler = await compile(CONSUMER_ENTRY, {
    base: "/",
    loadStylesheet: async (id, base) => {
      const path = stylesheets.get(id);
      if (path === undefined) {
        throw new Error(`fuse.css imports no stylesheet named ${id}`);
      }
      return { path: id, base, content: await readFile(path, "utf8") };
    },
    loadModule: async (id, base) => {
      if (id !== "tailwindcss-react-aria-components") {
        throw new Error(`fuse.css loads no plugin but tailwindcss-react-aria-components, received ${id}`);
      }
      return { path: id, base, module: (await import("tailwindcss-react-aria-components")).default };
    },
  });
  return readCompiledUtilities(parseCss(compiler.build([...utilities])));
}

/**
 * Read Tailwind's parsed output. A rule whose whole selector is one class is that utility's
 * rule. A `@supports` block that tests `color-mix()` overrides the declarations before it,
 * because every browser Fuse supports passes that test. Any other nested block, such as
 * `@media (forced-colors: active)`, describes a mode Figma does not show and is skipped.
 *
 * @param nodes - The parsed build output.
 * @returns The utility rules, theme values and registered property defaults.
 */
export function readCompiledUtilities(nodes: readonly CssNode[]): CompiledUtilities {
  const rules = new Map<string, UtilityRule>();
  const themeValues = new Map<string, string>();
  const propertyInitials = new Map<string, string>();
  let order = 0;
  const visit = (node: CssNode): void => {
    if (node.type === "at-rule") {
      if (node.name === "property") {
        const initial = node.children?.find(
          (child): child is CssDeclaration =>
            child.type === "declaration" && child.property === "initial-value"
        );
        if (initial !== undefined) {
          propertyInitials.set(node.params, initial.value);
        }
        return;
      }
      if (node.name === "layer") {
        node.children?.forEach(visit);
      }
      return;
    }
    if (node.type !== "rule") {
      return;
    }
    if (node.selector === ":root, :host") {
      for (const child of node.children) {
        if (child.type === "declaration") {
          themeValues.set(child.property, child.value);
        }
      }
      return;
    }
    const utility = singleClassSelector(node.selector);
    if (utility !== undefined) {
      rules.set(utility, { utility, order, declarations: effectiveDeclarations(node.children) });
      order += 1;
    }
  };
  nodes.forEach(visit);
  return { rules, themeValues, propertyInitials };
}

function effectiveDeclarations(children: readonly CssNode[]): readonly CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const child of children) {
    if (child.type === "declaration") {
      declarations.push(child);
    } else if (child.type === "at-rule" && child.name === "supports" && child.params.includes("color-mix(")) {
      for (const nested of child.children ?? []) {
        if (nested.type === "declaration") {
          declarations.push(nested);
        }
      }
    }
  }
  return declarations;
}

/**
 * The class name of a selector that is exactly one class, unescaped, such as `bg-primary/80`
 * for `.bg-primary\/80`.
 */
function singleClassSelector(selector: string): string | undefined {
  if (!selector.startsWith(".")) {
    return undefined;
  }
  let name = "";
  for (let index = 1; index < selector.length; index += 1) {
    const char = selector.charAt(index);
    if (char === "\\") {
      const hex = /^[0-9a-fA-F]{1,6} ?/.exec(selector.slice(index + 1));
      if (hex === null) {
        name += selector.charAt(index + 1);
        index += 1;
      } else {
        name += String.fromCodePoint(Number.parseInt(hex[0].trim(), 16));
        index += hex[0].length;
      }
    } else if (/[\w-]/.test(char) || char.charCodeAt(0) > 0x7f) {
      name += char;
    } else {
      return undefined;
    }
  }
  return name;
}
