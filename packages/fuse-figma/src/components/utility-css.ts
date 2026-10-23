/**
 * Compile recipe classes against `fuse.css` and read back each bare utility's declarations, and
 * where each full class sits in the output and how specific its selector is. The spec builder
 * decides from a class's variants whether it holds in a cell, so it reads the declarations of
 * the bare utility. It orders the classes that hold as the browser does, by the full class's
 * selector specificity and then its place in the output. Tailwind's own compiler resolves the
 * classes, which keeps the spec on the exact CSS a consumer ships, and the reader walks the
 * compiler's own syntax tree. The same compile gives the comparison page the CSS of the classes a
 * host app compiles itself.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compileAst } from "tailwindcss";

import { splitClassName } from "./class-name";
import { namedClasses } from "./css-selector";
import { splitTopLevel } from "./css-values";
import { compareSpecificity, specificityOf } from "./specificity";
import type { Specificity } from "./specificity";

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

/**
 * Where a full class, variants included, sits in Tailwind's output and how specific its selector
 * is. In one cascade layer the more specific rule wins a property, and a later one breaks a tie.
 */
export type ClassPlacement = {
  /** The position of the class's first rule in Tailwind's output. */
  readonly order: number;
  /** The specificity of its most specific selector. */
  readonly specificity: Specificity;
};

/** What the compile produced for a set of classes. */
export type CompiledUtilities = {
  /** Each bare utility Tailwind emitted a rule for. A utility it does not know is absent. */
  readonly rules: ReadonlyMap<string, UtilityRule>;
  /** Each full class Tailwind emitted a rule for, such as `data-checked:border-primary`. */
  readonly classes: ReadonlyMap<string, ClassPlacement>;
  /**
   * The selector of every rule that names a class outside a pseudo-class's parentheses, by that
   * class, whatever the selector starts with. `item-described:` compiles to a selector that starts
   * with `:where()`, which places no class, and a part's presence check still reads it here.
   */
  readonly rulesByClass: ReadonlyMap<string, readonly string[]>;
  /** The theme variables Tailwind emitted on `:root`, such as `--font-weight-medium: 500`. */
  readonly themeValues: ReadonlyMap<string, string>;
  /** Each custom property Tailwind registered with `@property`, such as `--tw-ring-offset-width`. */
  readonly registeredProperties: ReadonlyMap<string, RegisteredProperty>;
  /** The rules of the `base` layer, such as the one in `fuse.css` that colors every border. */
  readonly baseRules: readonly BaseRule[];
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
 * Compile the classes and their bare utilities with `fuse.css` the way a Tailwind-source
 * consumer does.
 *
 * @param classes - Recipe classes, with or without variants.
 * @returns Each bare utility's declarations, each full class's placement, and the variables
 *   they read.
 */
export async function compileUtilities(classes: readonly string[]): Promise<CompiledUtilities> {
  const candidates = new Set(classes.flatMap((className) => [className, splitClassName(className).utility]));
  return readCompiledUtilities(await buildConsumerCss([...candidates]));
}

/**
 * Compile a host app's own classes with `fuse.css`, as a standalone-CSS host's own Tailwind build
 * does for the classes it passes to Fuse components.
 *
 * @param classes - The host's classes, with or without variants.
 * @returns The rules that select the classes, one per line, each inside the at-rules that wrap it,
 *   such as `@media (hover: hover)`. The rest of the compile, which Fuse's own `styles.css`
 *   already holds, stays out.
 */
export async function compileHostUtilities(classes: readonly string[]): Promise<string> {
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
  return (await buildConsumerCss(classes)).flatMap(select).map(toCss).join("\n");
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
async function buildConsumerCss(candidates: readonly string[]): Promise<AstNode[]> {
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
  return compiler.build([...candidates]);
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
 * Every rule whose selector starts with a class places that class, at the top level or inside
 * an at-rule such as the `@media (hover: hover)` around `enabled-hover:`, and so does a `*:` rule,
 * `:is(.class > *)…`, for the class whose children it styles. Its first rule gives
 * its order, and its most specific selector its specificity. Every rule also lists its selector
 * under each class it names, wherever the class sits in the selector.
 *
 * @param nodes - The syntax tree `build` returns.
 * @returns The utility rules, class placements, theme values and registered properties.
 */
function readCompiledUtilities(nodes: readonly AstNode[]): CompiledUtilities {
  const rules = new Map<string, UtilityRule>();
  const classes = new Map<string, ClassPlacement>();
  const rulesByClass = new Map<string, string[]>();
  const themeValues = new Map<string, string>();
  const registeredProperties = new Map<string, RegisteredProperty>();
  const baseRules: BaseRule[] = [];
  let order = 0;
  const place = (node: AstNode): void => {
    if (node.kind === "at-rule" && node.name !== "@property" && node.name !== "@keyframes") {
      if (!(node.name === "@layer" && node.params === "base")) {
        node.nodes.forEach(place);
      }
      return;
    }
    if (node.kind === "rule") {
      for (const name of new Set(namedClasses(node.selector))) {
        rulesByClass.set(name, [...(rulesByClass.get(name) ?? []), node.selector]);
      }
    }
    const leading =
      node.kind === "rule" ? (leadingClass(node.selector) ?? childrenClass(node.selector)) : undefined;
    if (node.kind !== "rule" || leading === undefined) {
      return;
    }
    const specificity = specificityOf(node.selector);
    const placed = classes.get(leading.name);
    if (placed === undefined) {
      classes.set(leading.name, { order, specificity });
      order += 1;
    } else if (compareSpecificity(specificity, placed.specificity) > 0) {
      classes.set(leading.name, { ...placed, specificity });
    }
  };
  nodes.forEach(place);
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
    const leading = leadingClass(node.selector);
    if (leading?.rest === "") {
      rules.set(leading.name, { utility: leading.name, declarations: effectiveDeclarations(node.nodes) });
    }
  };
  nodes.forEach(visit);
  return { rules, classes, rulesByClass, themeValues, registeredProperties, baseRules };
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
 * The class a `*:` rule styles the children of, as Tailwind compiles `*:data-[slot=x]:flex` to
 * `:is(.\*\:data-\[slot\=x\]\:flex > *)[data-slot="x"]`, which selects each child of the element
 * that carries the class.
 */
function childrenClass(selector: string): { readonly name: string; readonly rest: string } | undefined {
  const opening = ":is(";
  const inner = selector.startsWith(opening) ? leadingClass(selector.slice(opening.length)) : undefined;
  return inner?.rest.startsWith(" > *)") === true ? inner : undefined;
}

/**
 * The class a selector starts with, unescaped, such as `bg-primary/80` for `.bg-primary\/80`,
 * and the rest of the selector after it, empty for a rule that selects one class.
 */
function leadingClass(selector: string): { readonly name: string; readonly rest: string } | undefined {
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
      return { name, rest: selector.slice(index) };
    }
  }
  return { name, rest: "" };
}
