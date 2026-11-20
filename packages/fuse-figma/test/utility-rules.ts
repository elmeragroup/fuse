/**
 * The declarations Tailwind compiles each utility to with `fuse.css`, read from the syntax tree of
 * the kit build's own Tailwind build. Tests take it as the oracle for a captured class's
 * declarations and for the tint a synced variable must reproduce.
 */

import { Effect } from "effect";

import { buildConsumerCss, declarationsOf, readCompiledUtilities } from "../src/components/consumer-build.ts";
import type { AstNode, CompiledUtilities, Declaration } from "../src/components/consumer-build.ts";
import { leadingClass } from "../src/components/css-selector.ts";
import { bareUtility } from "./bare-utility.ts";

/** Each bare utility's declarations, by class. A class Tailwind does not know is absent. */
export type UtilityRules = ReadonlyMap<string, readonly Declaration[]>;

/** What one build of a fixture's classes gives. */
export type FixtureCompile = {
  /** The theme values and registrations, as the kit build reads them. */
  readonly compiled: CompiledUtilities;
  /** Each bare utility's declarations. */
  readonly rules: UtilityRules;
};

/**
 * Compile the classes, their bare utilities and the extra classes in one Tailwind build, and read
 * its tree twice: for the theme values and registrations, and for each utility's rule.
 *
 * @param classes - The classes, with or without variants.
 * @param extra - Classes compiled beside them, such as `ring-2`, which registers its custom properties.
 * @returns The compile and the rules.
 */
export async function compileFixture(
  classes: readonly string[],
  extra: readonly string[] = []
): Promise<FixtureCompile> {
  const candidates = new Set([
    ...classes.flatMap((className) => [className, bareUtility(className)]),
    ...extra,
  ]);
  const nodes = await Effect.runPromise(buildConsumerCss([...candidates]));
  return { compiled: readCompiledUtilities(nodes), rules: readUtilityRules(nodes) };
}

/**
 * Compile the classes and their bare utilities, and read each utility's rule.
 *
 * @param classes - The classes, with or without variants.
 * @returns Each bare utility's declarations.
 */
export async function compileUtilityRules(classes: readonly string[]): Promise<UtilityRules> {
  return (await compileFixture(classes)).rules;
}

/**
 * Read each rule whose whole selector is one class, past the `base` layer. A rule inside any
 * other at-rule, such as a variant's `@media (hover: hover)`, stays out. A `@supports` block that
 * tests `color-mix()` adds its declarations after the ones before it, as every browser Fuse
 * supports applies them, and any other nested block, such as `&::before`, stays out.
 */
function readUtilityRules(nodes: readonly AstNode[]): UtilityRules {
  const rules = new Map<string, readonly Declaration[]>();
  const ownDeclarations = (node: AstNode): readonly Declaration[] =>
    node.kind !== "at-rule"
      ? declarationsOf([node])
      : node.name === "@supports" && node.params.includes("color-mix(")
        ? declarationsOf(node.nodes)
        : [];
  const visit = (node: AstNode): void => {
    if (node.kind === "at-rule") {
      if (node.name === "@layer" && node.params !== "base") {
        node.nodes.forEach(visit);
      }
      return;
    }
    if (node.kind !== "rule") {
      return;
    }
    const leading = leadingClass(node.selector);
    if (leading?.rest === "") {
      rules.set(leading.name, node.nodes.flatMap(ownDeclarations));
    }
  };
  nodes.forEach(visit);
  return rules;
}
