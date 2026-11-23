/**
 * The MDX pipeline every slide goes through, in `check`, in `slides list`, in the deck manifest and
 * in the Vite transform. One parse gives the rendered module and everything the deck derives from
 * the slide: its frontmatter, its title and its step count.
 *
 * The step pass numbers each `<Step>` in document order, from 1, as its `index` prop, and reports
 * how many there are. Deep links, keyboard navigation and export then agree on the last step before
 * anything renders. A `<Step>` inside a `{…}` expression would get no number, so it fails the
 * compile. Steps have no `at` prop in v1.
 */

import { compile } from "@mdx-js/mdx";
import type { CompileOptions } from "@mdx-js/mdx";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import type { Node, Root, RootContent } from "mdast";
import type { MdxJsxFlowElementHast, MdxJsxTextElementHast } from "mdast-util-mdx-jsx";
import remarkFrontmatter from "remark-frontmatter";

import { readSlideSource } from "../deck/slide-source.ts";
import type { SlideFrontmatterInvalid, SlideSource } from "../deck/slide-source.ts";
import { MORPH_NAME } from "../deck/vocabulary.ts";

/** What the deck derives from a slide when it compiles it. */
export type SlideMetadata = SlideSource & {
  /** How many `<Step>` elements the slide has. */
  readonly steps: number;
};

/** The JSX name of the step component. */
const STEP = "Step";

/** The JSX name of the morph component. */
const MORPH = "Morph";

/** What the slide pass hands back from inside the compile. */
type Derived = {
  steps: number;
  source: Result.Result<SlideSource, SlideFrontmatterInvalid> | undefined;
};

/** The part of a `VFile` the slide pass uses to stop the compile at a node. */
type CompileFile = { readonly fail: (reason: string, place: Node) => never };

/**
 * The slide pass. It writes each `<Step>`'s ordinal as an `index` attribute, marks a step inside a
 * paragraph `inline`, fails on a `<Step>` inside an expression, and reads the frontmatter and title
 * from the same tree.
 */
function slidePass(id: string, derived: Derived) {
  return () => (tree: Root, file: CompileFile) => {
    let count = 0;
    const visit = (node: Root | RootContent) => {
      if ("data" in node && containsJsx(node.data, STEP)) {
        file.fail(`<${STEP}> must be JSX in the slide body, not inside a {…} expression.`, node);
      }
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        if (containsJsx(node.attributes, STEP)) {
          file.fail(`<${STEP}> must be JSX in the slide body, not inside a {…} expression.`, node);
        }
        if (node.name === STEP) {
          count += 1;
          node.attributes.push({ type: "mdxJsxAttribute", name: "index", value: String(count) });
          if (node.type === "mdxJsxTextElement") {
            node.attributes.push({ type: "mdxJsxAttribute", name: "inline", value: null });
          }
        }
      }
      if ("children" in node) {
        for (const child of node.children) {
          visit(child);
        }
      }
    };
    visit(tree);
    derived.steps = count;
    derived.source = readSlideSource(id, tree);
  };
}

/** A node of the HTML tree MDX builds from a slide's Markdown. */
type HastContent = MdxJsxFlowElementHast["children"][number];

/** A `<Morph>` or another JSX element in the HTML tree. */
type HastJsxElement = MdxJsxFlowElementHast | MdxJsxTextElementHast;

/**
 * The morph pass. It runs on the HTML tree, where Markdown that renders nothing, such as a link
 * definition, is gone, and fails on a `<Morph>` whose literal name or child breaks its rules.
 */
function morphPass() {
  return (tree: { readonly children: readonly HastContent[] }, file: CompileFile) => {
    const seen = new Set<string>();
    const visit = (node: HastContent) => {
      if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") && node.name === MORPH) {
        // MDX keeps the spaces in `<Morph> <span>…</span> </Morph>` as text children, which the
        // component would count as content. They render nothing, so the pass drops them.
        dropWhitespaceText(node);
        const problem = morphProblem(node, seen);
        if (problem !== undefined) {
          file.fail(problem, node);
        }
      }
      if ("children" in node) {
        for (const child of node.children) {
          visit(child);
        }
      }
    };
    for (const node of tree.children) {
      visit(node);
    }
  };
}

/**
 * What is wrong with a `<Morph>`, as far as its literal props and children show. A name or child an
 * expression computes is left to the component, which checks it when the slide renders. A comment
 * in braces renders nothing, so it does not count as a child.
 *
 * @param node - The `<Morph>` element, in the HTML tree.
 * @param seen - The literal names earlier `<Morph>`s on the slide used; this one's is added.
 * @returns The problem, or `undefined` when the element follows the rules.
 */
function morphProblem(node: HastJsxElement, seen: Set<string>): string | undefined {
  const spread = node.attributes.some((attribute) => attribute.type === "mdxJsxExpressionAttribute");
  const name = node.attributes.find(
    (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === "name"
  )?.value;
  if (name === undefined) {
    if (!spread) {
      return `<${MORPH}> needs a name, such as <${MORPH} name="logo">.`;
    }
  } else if (name === null) {
    return `<${MORPH}> needs a name of lowercase letters, digits and dashes, starting with a letter.`;
  } else if (!(name instanceof Object)) {
    if (!MORPH_NAME.test(name)) {
      return `<${MORPH} name="${name}">: a name has lowercase letters, digits and dashes, starting with a letter.`;
    }
    if (seen.has(name)) {
      return `<${MORPH} name="${name}"> appears twice on this slide. Each name pairs one element per slide.`;
    }
    seen.add(name);
  }
  const rendered = node.children.filter((child) => !isEmptyExpression(child));
  const [only] = rendered;
  const host =
    only !== undefined &&
    rendered.length === 1 &&
    only.type !== "text" &&
    (!(only.type === "mdxJsxFlowElement" || only.type === "mdxJsxTextElement") ||
      /^[a-z]/.test(only.name ?? ""));
  return host ? undefined : `<${MORPH}> must wrap exactly one HTML element, such as <img> or <span>.`;
}

/** Whether a node is a `{…}` expression with no statement, such as one that holds only a comment. */
function isEmptyExpression(node: HastContent): boolean {
  return (
    (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") &&
    node.data?.estree?.body.length === 0
  );
}

/** Remove an element's text children that hold only whitespace. */
function dropWhitespaceText(node: HastJsxElement): void {
  for (let index = node.children.length - 1; index >= 0; index -= 1) {
    const child = node.children[index];
    if (child?.type === "text" && child.value.trim() === "") {
      node.children.splice(index, 1);
    }
  }
}

/** Whether an estree value holds a JSX element named `name`. */
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- MDX parser output: one walk over every key reaches a JSX element at any depth of any estree node kind
function containsJsx(value: unknown, name: string): boolean {
  if (!(value instanceof Object)) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsJsx(item, name));
  }
  if (
    "type" in value &&
    value.type === "JSXOpeningElement" &&
    "name" in value &&
    value.name instanceof Object &&
    "name" in value.name &&
    value.name.name === name
  ) {
    return true;
  }
  return Object.entries(value).some(
    ([key, child]) => key !== "loc" && key !== "range" && containsJsx(child, name)
  );
}

/**
 * The MDX options for a slide.
 *
 * @param id - The slide, for its frontmatter error.
 * @param derived - Receives what the compile derives.
 * @param mode - `development` compiles for `react/jsx-dev-runtime`.
 * @returns Options for `@mdx-js/mdx`'s `compile`.
 */
function mdxOptions(id: string, derived: Derived, mode: "development" | "production"): CompileOptions {
  return {
    remarkPlugins: [remarkFrontmatter, slidePass(id, derived)],
    rehypePlugins: [morphPass],
    development: mode === "development",
    jsxImportSource: "react",
  };
}

/** A slide's MDX does not compile. */
export class SlideCompileFailed extends Schema.TaggedError<SlideCompileFailed>()("SlideCompileFailed", {
  message: Schema.String,
  hint: Schema.String,
  id: Schema.String,
  line: Schema.optional(Schema.Finite),
  column: Schema.optional(Schema.Finite),
}) {}

/** The fields of a `VFileMessage` that locate a compile error. */
const CompileMessage = Schema.Struct({
  reason: Schema.String,
  line: Schema.optionalKey(Schema.NullOr(Schema.Finite)),
  column: Schema.optionalKey(Schema.NullOr(Schema.Finite)),
});

const decodeCompileMessage = Schema.decodeUnknownOption(CompileMessage);

/** A compiled slide. */
export type CompiledSlide = {
  /** The JavaScript module. */
  readonly code: string;
  /** What the compile derived. */
  readonly metadata: SlideMetadata;
};

/**
 * Compile a slide through the deck's MDX pipeline.
 *
 * @param id - The slide, for the error.
 * @param path - The slide file, for MDX's messages.
 * @param text - The slide's MDX.
 * @param mode - Which JSX runtime the output imports.
 * @returns The module and its metadata, `SlideCompileFailed` with the line and column, or
 *   `SlideFrontmatterInvalid`.
 */
export const compileSlide = (id: string, path: string, text: string, mode: "development" | "production") =>
  Effect.gen(function* () {
    const derived: Derived = { steps: 0, source: undefined };
    const file = yield* Effect.tryPromise({
      try: () => compile({ path, value: text }, mdxOptions(id, derived, mode)),
      catch: (cause) => {
        const located = decodeCompileMessage(cause);
        const reason = Option.match(located, {
          onNone: () => (cause instanceof Error ? cause.message : String(cause)),
          onSome: (message) => message.reason,
        });
        const line = Option.flatMap(located, (message) => Option.fromNullishOr(message.line));
        const column = Option.flatMap(located, (message) => Option.fromNullishOr(message.column));
        const where = Option.match(line, {
          onNone: () => "",
          onSome: (at) =>
            `:${String(at)}${Option.match(column, { onNone: () => "", onSome: (col) => `:${String(col)}` })}`,
        });
        return new SlideCompileFailed({
          message: `slides/${id}.mdx${where} does not compile: ${reason}`,
          hint: "Fix the MDX at that position. A `<` or `{` in prose must be escaped as `\\<` or `\\{`.",
          id,
          line: Option.getOrUndefined(line),
          column: Option.getOrUndefined(column),
        });
      },
    });
    if (derived.source === undefined) {
      return yield* Effect.die(new Error("The MDX compile finished without running the slide pass."));
    }
    const source = yield* Effect.fromResult(derived.source);
    return {
      code: String(file.value),
      metadata: { ...source, steps: derived.steps },
    } satisfies CompiledSlide;
  }).pipe(Effect.withSpan("compileSlide", { attributes: { id } }));
