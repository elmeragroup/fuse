import { parseSync, Visitor } from "oxc-parser";
import type { BindingPattern, ParamPattern, Statement, VisitorObject } from "oxc-parser";

/**
 * The hooks that hand a writer to Root's loop, by the index of their writer argument:
 * `useMotionMark` itself, and the shared owners that forward the writer their caller passes.
 */
export const WRITER_HOOKS: ReadonlyMap<string, number> = new Map([
  ["useMotionMark", 1],
  ["usePathMark", 0],
  ["useSeriesPath", 1],
  ["useAttachedMark", 2],
]);

/** One call a module makes to a hook that hands the loop a writer, and the writer it passes. */
export type MotionWriterUse = {
  /** The hook the call names. */
  readonly hook: string;
  /** The writer argument's name, or undefined when it is anything but an identifier. */
  readonly writer: string | undefined;
  /** Whether that name resolves to a binding at the module's top level, past every inner scope. */
  readonly moduleScope: boolean;
  /**
   * Whether the name is the writer parameter of the writer hook that encloses the call, so the
   * hook forwards what its own callers pass, which this check reads at their call sites.
   */
  readonly forwarded: boolean;
  /** The call's source offset, which names it in a failure. */
  readonly at: number;
};

/** The names a binding pattern declares. */
function patternNames(pattern: BindingPattern | ParamPattern): string[] {
  switch (pattern.type) {
    case "Identifier":
      return [pattern.name];
    case "ObjectPattern":
      return pattern.properties.flatMap((property) =>
        patternNames(property.type === "RestElement" ? property.argument : property.value)
      );
    case "ArrayPattern":
      return pattern.elements.flatMap((element) => (element === null ? [] : patternNames(element)));
    case "RestElement":
      return patternNames(pattern.argument);
    case "AssignmentPattern":
      return patternNames(pattern.left);
    case "TSParameterProperty":
      return patternNames(pattern.parameter);
  }
}

/** The names a statement declares in the block that holds it, past an export. */
function declaredBy(statement: Statement): string[] {
  const declaration =
    statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (declaration === null) return [];
  switch (declaration.type) {
    case "FunctionDeclaration":
    case "ClassDeclaration":
      return declaration.id === null ? [] : [declaration.id.name];
    case "VariableDeclaration":
      // A var hoists to its function, which the walk records where it meets the declaration.
      return declaration.kind === "var"
        ? []
        : declaration.declarations.flatMap((declarator) => patternNames(declarator.id));
    case "ImportDeclaration":
      return declaration.specifiers.map((specifier) => specifier.local.name);
    default:
      return [];
  }
}

/**
 * Every call a module makes to a hook in `WRITER_HOOKS`, with its writer: the argument at the
 * hook's writer index, which must resolve to a binding at module scope, so the writer's only inputs
 * are the ones its signature lists. A shared hook that forwards its own writer parameter is checked
 * at its callers instead. A name a component or block binds again shadows the module's, as
 * JavaScript resolves it.
 *
 * @param relativePath - The module's path, which names it in a parse failure.
 * @param source - The module's source.
 * @returns The calls in source order.
 * @throws Error when the module does not parse, a defect in package source.
 */
export function motionWriters(relativePath: string, source: string): MotionWriterUse[] {
  const parsed = parseSync(relativePath, source);
  if (parsed.errors.length > 0) {
    throw new Error(
      `${relativePath} does not parse: ${parsed.errors.map((error) => error.message).join("; ")}`
    );
  }
  // The scopes open at the walk's position, the module's first. A function's scope also gathers
  // the vars below it, which hoist, so each call resolves its writer once the walk ends.
  type Scope = { readonly names: Set<string>; readonly hoists: boolean; readonly forwards?: string };
  const open: Scope[] = [];
  const calls: {
    readonly hook: string;
    readonly writer: string | undefined;
    readonly at: number;
    readonly chain: Scope[];
  }[] = [];
  const enter = (names: readonly string[], hoists = false, forwards?: string): void => {
    open.push(
      forwards === undefined ? { names: new Set(names), hoists } : { names: new Set(names), hoists, forwards }
    );
  };
  const leave = (): void => {
    open.pop();
  };
  const functionScope = (node: {
    readonly type: string;
    readonly id: { readonly name: string } | null;
    readonly params: readonly ParamPattern[];
  }): void => {
    // A function expression's own name binds inside it; a declaration's binds in its block.
    const own = node.type === "FunctionExpression" && node.id !== null ? [node.id.name] : [];
    // A writer hook's own writer parameter, which it forwards.
    const index = node.id === null ? undefined : WRITER_HOOKS.get(node.id.name);
    const param = index === undefined ? undefined : node.params[index];
    const forwards = param?.type === "Identifier" ? param.name : undefined;
    enter([...own, ...node.params.flatMap((param) => patternNames(param))], true, forwards);
  };
  const visitor: VisitorObject = {
    Program: (program) => {
      enter(
        program.body.flatMap((statement) => declaredBy(statement)),
        true
      );
    },
    FunctionDeclaration: functionScope,
    "FunctionDeclaration:exit": leave,
    FunctionExpression: functionScope,
    "FunctionExpression:exit": leave,
    ArrowFunctionExpression: functionScope,
    "ArrowFunctionExpression:exit": leave,
    BlockStatement: (block) => {
      enter(block.body.flatMap((statement) => declaredBy(statement)));
    },
    "BlockStatement:exit": leave,
    StaticBlock: (block) => {
      enter(block.body.flatMap((statement) => declaredBy(statement)));
    },
    "StaticBlock:exit": leave,
    SwitchStatement: (statement) => {
      enter(statement.cases.flatMap((entry) => entry.consequent.flatMap((inner) => declaredBy(inner))));
    },
    "SwitchStatement:exit": leave,
    ForStatement: (statement) => {
      enter(statement.init?.type === "VariableDeclaration" ? declaredBy(statement.init) : []);
    },
    "ForStatement:exit": leave,
    ForInStatement: (statement) => {
      enter(statement.left.type === "VariableDeclaration" ? declaredBy(statement.left) : []);
    },
    "ForInStatement:exit": leave,
    ForOfStatement: (statement) => {
      enter(statement.left.type === "VariableDeclaration" ? declaredBy(statement.left) : []);
    },
    "ForOfStatement:exit": leave,
    CatchClause: (clause) => {
      enter(clause.param === null ? [] : patternNames(clause.param));
    },
    "CatchClause:exit": leave,
    ClassExpression: (node) => {
      enter(node.id === null ? [] : [node.id.name]);
    },
    "ClassExpression:exit": leave,
    VariableDeclaration: (declaration) => {
      if (declaration.kind !== "var") return;
      const owner = open.findLast((scope) => scope.hoists);
      for (const name of declaration.declarations.flatMap((declarator) => patternNames(declarator.id))) {
        owner?.names.add(name);
      }
    },
    CallExpression: (call) => {
      if (call.callee.type !== "Identifier") return;
      const hook = call.callee.name;
      const index = WRITER_HOOKS.get(hook);
      if (index === undefined) return;
      const argument = call.arguments[index];
      const writer = argument?.type === "Identifier" ? argument.name : undefined;
      calls.push({ hook, writer, at: call.start, chain: [...open] });
    },
  };
  new Visitor(visitor).visit(parsed.program);
  const uses: MotionWriterUse[] = calls.map(({ hook, writer, at, chain }) => {
    const binder = writer === undefined ? -1 : chain.findLastIndex(({ names }) => names.has(writer));
    const forwarded = binder > 0 && writer !== undefined && chain[binder]?.forwards === writer;
    return { hook, writer, moduleScope: binder === 0, forwarded, at };
  });
  return uses;
}
