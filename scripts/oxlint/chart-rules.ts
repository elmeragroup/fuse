import { calledName, constantValue, isOneOf, resolve, spellingBan, staticText } from "./rule-kit.ts";
import type { AnyNode, Context, NodeOf, Rule, Scope } from "./rule-kit.ts";

const CHART_DIR = "/packages/fuse/src/components/chart/";

/** The module that declares the registration hook and the commit classifiers. */
const MOTION_MARK_MODULE = `${CHART_DIR}chart-motion-mark.ts`;

/** The animation loop and its classifier: the only modules that decide a mark's placement. */
const MOTION_OWNERS: readonly string[] = [`${CHART_DIR}chart-motion.ts`, MOTION_MARK_MODULE];

const DISPLAY_NAME_MESSAGE =
  "Set a chart part's displayName through Object.assign: `Part.displayName = …` makes TypeScript emit an untagged namespace beside the @beta part, which api-extractor rejects.";
const EXPORT_WITHOUT_ASSIGN_MESSAGE =
  "Name each exported chart part through Object.assign(Part, { displayName }) at module scope, or export it as Object.assign(function Part…, { displayName }), so the declaration carries no namespace.";

/**
 * A part is an export with an api-extractor release tag, the chart entry's public API: `@beta` now,
 * and `@alpha` or `@public` as a part moves between stages. Shared internal components, hooks and
 * helpers carry no release tag and take no displayName.
 */
const RELEASE_TAG = /@(?:alpha|beta|public)\b/u;

type ObjectAssignCall = NodeOf<"CallExpression">;

/** Whether a call is `Object.assign(…)` on the global `Object`. */
function isObjectAssign(context: Context, node: ObjectAssignCall): boolean {
  const { callee } = node;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Object" &&
    resolve(context, callee.object, "Object", "value") === undefined &&
    callee.property.type === "Identifier" &&
    callee.property.name === "assign"
  );
}

/** Whether an `Object.assign` call's sources name a `displayName`. */
function assignsDisplayName(node: ObjectAssignCall): boolean {
  return node.arguments
    .slice(1)
    .some(
      (source) =>
        source.type === "ObjectExpression" &&
        source.properties.some(
          (property) =>
            property.type === "Property" &&
            !property.computed &&
            ((property.key.type === "Identifier" && property.key.name === "displayName") ||
              (property.key.type === "Literal" && property.key.value === "displayName"))
        )
    );
}

/**
 * Chart parts take their displayName through `Object.assign`, never a namespace assignment. Each
 * released part is judged by its own naming: a module-scope `Object.assign(Part, { displayName })`
 * statement for an exported function, or an `Object.assign(…, { displayName })` initializer.
 */
export const chartPartDisplayName: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Set chart part display names through Object.assign." },
    schema: [],
  },
  create(context) {
    const unnamed = new Map<string, NodeOf<"ExportNamedDeclaration">>();
    const named = new Set<string>();
    return {
      AssignmentExpression(node) {
        const { left } = node;
        if (
          left.type === "MemberExpression" &&
          !left.computed &&
          left.object.type === "Identifier" &&
          left.property.type === "Identifier" &&
          left.property.name === "displayName"
        ) {
          context.report({ node, message: DISPLAY_NAME_MESSAGE });
        }
      },
      ExportNamedDeclaration(node) {
        const { declaration } = node;
        if (node.parent.type !== "Program" || declaration === null) return;
        const isPublic = context.sourceCode
          .getCommentsBefore(node)
          .some(({ type, value }) => type === "Block" && RELEASE_TAG.test(value));
        if (!isPublic) return;
        if (declaration.type === "FunctionDeclaration") {
          if (declaration.id !== null) unnamed.set(declaration.id.name, node);
          return;
        }
        if (declaration.type !== "VariableDeclaration") return;
        for (const declarator of declaration.declarations) {
          if (declarator.id.type !== "Identifier") continue;
          const { init } = declarator;
          const isPart =
            init?.type === "FunctionExpression" ||
            init?.type === "ArrowFunctionExpression" ||
            (init?.type === "CallExpression" && isObjectAssign(context, init));
          const isNamed =
            init?.type === "CallExpression" && isObjectAssign(context, init) && assignsDisplayName(init);
          if (isPart && !isNamed) unnamed.set(declarator.id.name, node);
        }
      },
      ExpressionStatement(node) {
        const { expression } = node;
        if (node.parent.type !== "Program" || expression.type !== "CallExpression") return;
        if (!isObjectAssign(context, expression) || !assignsDisplayName(expression)) return;
        const [target] = expression.arguments;
        if (target?.type === "Identifier") named.add(target.name);
      },
      "Program:exit"() {
        for (const [name, node] of unnamed) {
          if (!named.has(name)) context.report({ node, message: EXPORT_WITHOUT_ASSIGN_MESSAGE });
        }
      },
    };
  },
};

/** The hook a mark registers on Root's loop through. */
const MOTION_MARK = "useMotionMark";

/** The commit classifier and its follower form, which a registered mark asks once. */
const CLASSIFIERS: ReadonlySet<string> = new Set(["useCommitMotion", "useFollowerPlacement"]);

/** The placements only the loop and its classifier name. */
const LOOP_PLACEMENTS: ReadonlySet<string> = new Set(["move", "settle"]);

const PLACE_MESSAGE =
  "Place a mark on Root's loop through useMotionMark; only chart-motion.ts and chart-motion-mark.ts call motion.place.";
const KIND_MESSAGE =
  'Ask useCommitMotion or useFollowerPlacement how a mark reaches its commit; only the loop and its classifier name the "move" and "settle" placements.';

/**
 * Whether an expression is Root's loop: a `motion` binding, a `.motion` member such as
 * `context.motion`, or a `const` that holds one.
 */
function isLoop(context: Context, node: AnyNode, depth = 4): boolean {
  if (node.type === "MemberExpression") {
    return !node.computed && node.property.type === "Identifier" && node.property.name === "motion";
  }
  if (node.type !== "Identifier") return false;
  if (node.name === "motion") return true;
  const value = depth === 0 ? undefined : constantValue(context, node, node.name);
  return value !== undefined && isLoop(context, value, depth - 1);
}

/**
 * Root's loop and its commit classifier own every placement: a mark registers through
 * `useMotionMark` and asks the classifier once per registration. Calls are read from the AST, through
 * any import alias, with any type arguments, optional chaining included.
 */
export const chartMotionPlacement: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Decide chart mark placements only in the loop and its classifier." },
    schema: [],
  },
  create(context) {
    if (isOneOf(context, [MOTION_MARK_MODULE]))
      return declaresHooks(context, [MOTION_MARK, ...CLASSIFIERS], new Map(), PLACEMENT_DRIFT);
    if (isOneOf(context, MOTION_OWNERS)) return {};
    let marks = 0;
    let asks = 0;
    return {
      CallExpression(node) {
        const { callee } = node;
        const name = calledName(context, callee);
        if (name === MOTION_MARK) marks += 1;
        if (name !== undefined && CLASSIFIERS.has(name)) asks += 1;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          callee.property.type === "Identifier" &&
          callee.property.name === "place" &&
          isLoop(context, callee.object)
        ) {
          context.report({ node: callee, message: PLACE_MESSAGE });
        }
      },
      Property(node) {
        const isKind =
          !node.computed &&
          ((node.key.type === "Identifier" && node.key.name === "kind") ||
            (node.key.type === "Literal" && node.key.value === "kind"));
        if (!isKind || node.parent.type !== "ObjectExpression") return;
        const kind = staticText(context, node.value);
        if (kind !== undefined && LOOP_PLACEMENTS.has(kind)) context.report({ node, message: KIND_MESSAGE });
      },
      "Program:exit"(node) {
        if (marks === asks) return;
        context.report({
          node,
          message: `Each mark registers through useMotionMark once and asks useCommitMotion or useFollowerPlacement once; this module registers ${String(marks)} and asks ${String(asks)}.`,
        });
      },
    };
  },
};

/** A hook that hands a writer to Root's loop: the module that declares it, and its writer's index. */
type WriterHook = { readonly name: string; readonly owner: string; readonly writer: number };

/**
 * The hooks that hand a writer to Root's loop: `useMotionMark` itself, and the shared owners that
 * forward the writer their caller passes. Each owner module must still declare its hook with a
 * `MotionWriter` parameter at that index, so a rename that leaves this table behind fails lint in
 * the owner instead of leaving the rule checking nothing. A new forwarding hook missing from the
 * table is reported at its own `useMotionMark` call, since its writer parameter is not module scope.
 */
const WRITER_HOOKS: readonly WriterHook[] = [
  { name: MOTION_MARK, owner: MOTION_MARK_MODULE, writer: 1 },
  { name: "usePathMark", owner: `${CHART_DIR}chart-series-path.ts`, writer: 0 },
  { name: "useSeriesPath", owner: `${CHART_DIR}chart-series-path.ts`, writer: 1 },
  { name: "useAttachedMark", owner: `${CHART_DIR}chart-attached.ts`, writer: 2 },
];

/** The modules the chart rules key on, which the plugin checks the tree still holds. */
export const CHART_OWNERS: readonly string[] = [
  CHART_DIR,
  ...MOTION_OWNERS,
  ...WRITER_HOOKS.map(({ owner }) => owner),
];

const WRITER_INDEX: ReadonlyMap<string, number> = new Map(
  WRITER_HOOKS.map(({ name, writer }) => [name, writer])
);

const WRITER_MESSAGE =
  "Hand Root's loop a writer bound at module scope, so its only inputs are the node, the look and the numbers the loop draws; a writer hook may forward its own writer parameter.";

const WRITER_DRIFT = (name: string): string =>
  `This module no longer declares the writer hook ${name} that scripts/oxlint/chart-rules.ts keys on, with a MotionWriter parameter where WRITER_HOOKS says; update WRITER_HOOKS with the rename, or fuse/chart-motion-writer checks nothing.`;

const PLACEMENT_DRIFT = (name: string): string =>
  `This module no longer declares ${name}, which fuse/chart-motion-placement counts; update scripts/oxlint/chart-rules.ts with the rename, or the rule checks nothing.`;

/** Whether a parameter is typed `MotionWriter<…>`, the writer a hook hands the loop. */
function isWriterParameter(parameter: NodeOf<"FunctionDeclaration">["params"][number] | undefined): boolean {
  const annotation = parameter?.type === "Identifier" ? parameter.typeAnnotation?.typeAnnotation : undefined;
  return (
    annotation?.type === "TSTypeReference" &&
    annotation.typeName.type === "Identifier" &&
    annotation.typeName.name === "MotionWriter"
  );
}

/**
 * The visitors that hold an owner module to the hooks a rule keys on: each name must be declared at
 * module scope, and each name in `writers` with its `MotionWriter` parameter at its index.
 */
function declaresHooks(
  context: Context,
  names: readonly string[],
  writers: ReadonlyMap<string, number>,
  drift: (name: string) => string
): ReturnType<Rule["create"]> {
  const declared = new Map<string, NodeOf<"FunctionDeclaration">>();
  return {
    FunctionDeclaration(node) {
      const atModule = node.parent.type === "Program" || node.parent.type === "ExportNamedDeclaration";
      if (atModule && node.id !== null) declared.set(node.id.name, node);
    },
    "Program:exit"(node) {
      for (const name of names) {
        const declaration = declared.get(name);
        const index = writers.get(name);
        const keeps =
          declaration !== undefined && (index === undefined || isWriterParameter(declaration.params[index]));
        if (!keeps) context.report({ node, message: drift(name) });
      }
    },
  };
}

/** Whether `scope` is a writer hook's function scope and `name` is that hook's writer parameter. */
function forwardsWriter(scope: Scope, name: string): boolean {
  const { block } = scope;
  if (block.type !== "FunctionDeclaration" && block.type !== "FunctionExpression") return false;
  const index = block.id === null ? undefined : WRITER_INDEX.get(block.id.name);
  const parameter = index === undefined ? undefined : block.params[index];
  return parameter?.type === "Identifier" && parameter.name === name;
}

/**
 * Every writer a chart module hands Root's loop resolves to a module-scope value, or is the writer
 * parameter a shared writer hook forwards, which the rule reads at that hook's call sites. In a
 * hook's owner, the rule checks the owner still declares the hook it keys on.
 */
export const chartMotionWriter: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Hand the chart loop only writers bound at module scope." },
    schema: [],
  },
  create(context) {
    const owned = WRITER_HOOKS.filter(({ owner }) => isOneOf(context, [owner])).map(({ name }) => name);
    const drift = declaresHooks(context, owned, WRITER_INDEX, WRITER_DRIFT);
    return {
      ...drift,
      CallExpression(node) {
        const hook = calledName(context, node.callee);
        const index = hook === undefined ? undefined : WRITER_INDEX.get(hook);
        if (index === undefined) return;
        const writer = node.arguments[index];
        if (writer?.type === "Identifier") {
          const scope = resolve(context, writer, writer.name, "value")?.scope;
          if (scope !== undefined && (scope.type === "module" || forwardsWriter(scope, writer.name))) return;
        }
        context.report({ node: writer ?? node, message: WRITER_MESSAGE });
      },
    };
  },
};

/** Chart modules paint through custom properties a user style sheet and forced colours reach. */
export const noChartColourLiteral: Rule = spellingBan(
  "Paint chart marks through custom properties, never a colour literal.",
  /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/iu,
  "Paint chart marks through a --chart-* custom property or a theme role, not a colour literal, so a user style sheet and forced colours reach every mark (CONTRACT.md section 9.11).",
  "code-only"
);
