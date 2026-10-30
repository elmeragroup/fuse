import { parseSync, Visitor } from "oxc-parser";
import type { Program, Statement } from "oxc-parser";

/** One `useMotionMark` call a module makes, and the writer it hands the loop. */
export type MotionWriterUse = {
  /** The writer argument's name, or undefined when it is anything but an identifier. */
  readonly writer: string | undefined;
  /** Whether that name is bound at the module's top level. */
  readonly moduleScope: boolean;
  /** The call's source offset, which names it in a failure. */
  readonly at: number;
};

/** The names a statement binds at a module's top level. */
function boundBy(statement: Statement | Program["body"][number]): string[] {
  const declaration =
    statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (declaration === null) return [];
  if (declaration.type === "FunctionDeclaration") return declaration.id === null ? [] : [declaration.id.name];
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.type === "Identifier" ? [declarator.id.name] : []
    );
  }
  if (declaration.type === "ImportDeclaration") {
    return declaration.specifiers.map((specifier) => specifier.local.name);
  }
  return [];
}

/**
 * Every `useMotionMark` call a module makes, with its writer: the call's second argument, which
 * must be a name bound at module scope, so the writer's only inputs are the ones its signature lists.
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
  const topLevel = new Set(parsed.program.body.flatMap((statement) => boundBy(statement)));
  const uses: MotionWriterUse[] = [];
  new Visitor({
    CallExpression: (call) => {
      if (call.callee.type !== "Identifier" || call.callee.name !== "useMotionMark") return;
      const argument = call.arguments[1];
      const writer = argument?.type === "Identifier" ? argument.name : undefined;
      uses.push({ writer, moduleScope: writer !== undefined && topLevel.has(writer), at: call.start });
    },
  }).visit(parsed.program);
  return uses;
}
