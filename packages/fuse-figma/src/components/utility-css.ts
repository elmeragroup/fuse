/**
 * Compile bare Tailwind utilities against `fuse.css` and read back each utility's
 * declarations. The spec builder strips a class's variants first and decides the state from
 * them itself, so it compiles only the utility. Tailwind's own compiler resolves the
 * utility, which keeps the spec on the exact CSS a consumer ships, and the reader walks the
 * compiler's own syntax tree.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileAst } from "tailwindcss";

import { splitTopLevel } from "./css-values";

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
  /** The rule's position in Tailwind's output. A later rule wins a property tie. */
  readonly order: number;
  readonly declarations: readonly UtilityDeclaration[];
};

/** What the compile produced for a set of utilities. */
export type CompiledUtilities = {
  /** Each utility Tailwind emitted a rule for. A utility it does not know is absent. */
  readonly rules: ReadonlyMap<string, UtilityRule>;
  /** The theme variables Tailwind emitted on `:root`, such as `--font-weight-medium: 500`. */
  readonly themeValues: ReadonlyMap<string, string>;
  /** The `initial-value` of each `@property` Tailwind registered, such as `--tw-ring-offset-width`. */
  readonly propertyInitials: ReadonlyMap<string, string>;
  /** The rules of the `base` layer, such as the one in `fuse.css` that colors every border. */
  readonly baseRules: readonly BaseRule[];
};

/** A rule of the `base` layer: its whole selector list and its declarations. */
export type BaseRule = {
  readonly selector: string;
  readonly declarations: readonly UtilityDeclaration[];
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
  const compiler = await compileAst(consumerEntry(), {
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
  return readCompiledUtilities(compiler.build([...utilities]));
}

/**
 * The arm of `fuse.css`'s base-layer border rule that matches every element except a native form
 * widget without a `data-slot`. Every Fuse part carries a `data-slot`, so it matches each one.
 */
const PART_ARM = ":where(:not(:is(button, input, select, textarea, meter, progress):not([data-slot])))";

/**
 * The border color `fuse.css`'s base layer gives every Fuse part, which makes every border the
 * `border` role where no utility colors it.
 *
 * @param compiled - A compile against `fuse.css`.
 * @returns The `border-color` declaration of the base rule whose selector list holds the arm
 *   every part matches.
 * @throws When the base layer has no rule with that arm, or the rule sets no border color.
 */
export function baseBorderColor(compiled: CompiledUtilities): UtilityDeclaration {
  const rule = compiled.baseRules.find((candidate) =>
    splitTopLevel(candidate.selector, ",").includes(PART_ARM)
  );
  if (rule === undefined) {
    throw new Error(`fuse.css's base layer has no rule for ${PART_ARM}`);
  }
  const borderColor = rule.declarations.findLast((declaration) => declaration.property === "border-color");
  if (borderColor === undefined) {
    throw new Error(`fuse.css's base-layer rule for ${PART_ARM} sets no border-color`);
  }
  return borderColor;
}

/**
 * Read Tailwind's build output. A rule whose whole selector is one class is that utility's
 * rule. A `@supports` block that tests `color-mix()` overrides the declarations before it,
 * because every browser Fuse supports passes that test. Any other nested block, such as
 * `@media (forced-colors: active)`, describes a mode Figma does not show and is skipped. The
 * rules of the `base` layer are kept apart, since no class selects them.
 *
 * @param nodes - The syntax tree `build` returns.
 * @returns The utility rules, theme values and registered property defaults.
 */
function readCompiledUtilities(nodes: readonly AstNode[]): CompiledUtilities {
  const rules = new Map<string, UtilityRule>();
  const themeValues = new Map<string, string>();
  const propertyInitials = new Map<string, string>();
  const baseRules: BaseRule[] = [];
  let order = 0;
  const visit = (node: AstNode): void => {
    if (node.kind === "at-rule") {
      if (node.name === "@property") {
        const initial = declarationsOf(node.nodes).find(
          (declaration) => declaration.property === "initial-value"
        );
        if (initial !== undefined) {
          propertyInitials.set(node.params, initial.value);
        }
        return;
      }
      if (node.name === "@layer" && node.params === "base") {
        for (const child of node.nodes) {
          if (child.kind === "rule") {
            baseRules.push({ selector: child.selector, declarations: declarationsOf(child.nodes) });
          }
        }
      } else if (node.name === "@layer") {
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
    const utility = singleClassSelector(node.selector);
    if (utility !== undefined) {
      rules.set(utility, { utility, order, declarations: effectiveDeclarations(node.nodes) });
      order += 1;
    }
  };
  nodes.forEach(visit);
  return { rules, themeValues, propertyInitials, baseRules };
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
