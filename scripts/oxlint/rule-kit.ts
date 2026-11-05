import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuleTester } from "oxlint/plugins-dev";

/**
 * A rule of the repository's `fuse` oxlint plugin. oxlint publishes its plugin types only through
 * `RuleTester`'s signature, so the kit reads them from there. The import is type-only, so Node's
 * type stripping erases it and the plugin loads without `oxlint/plugins-dev` at runtime.
 */
export type Rule = Extract<Parameters<RuleTester["run"]>[1], { readonly create: unknown }>;

/** An oxlint JS plugin: its name, which prefixes each rule in the configuration, and its rules. */
export type Plugin = {
  readonly meta: { readonly name: string };
  readonly rules: Readonly<Record<string, Rule>>;
};

/** The context oxlint hands a rule for one file. */
export type Context = Parameters<Rule["create"]>[0];

type Visitor = ReturnType<Rule["create"]>;

/** The AST node a visitor key receives, such as `NodeOf<"CallExpression">`. */
export type NodeOf<K extends string> = NonNullable<Visitor[K]> extends (node: infer N) => void ? N : never;

/** Whether a spelling ban reads comments too, or only the code between them. */
export type CommentReading = "comments-included" | "code-only";

/**
 * The linted file's path with forward slashes, so suffix checks behave on every platform.
 *
 * @param context - The rule context.
 * @returns The normalized absolute path.
 */
export function filenameOf(context: Context): string {
  return context.filename.replaceAll("\\", "/");
}

/**
 * Whether the linted file is one of the owners a rule exempts or holds to a count.
 *
 * @param context - The rule context.
 * @param owners - Repository-rooted paths, each starting with `/`, such as `/packages/fuse/src/x.ts`.
 * @returns `true` when the file's path ends with one of them.
 */
export function isOneOf(context: Context, owners: readonly string[]): boolean {
  const filename = filenameOf(context);
  return owners.some((owner) => filename.endsWith(owner));
}

/**
 * The file's source with every comment blanked to spaces, keeping each offset and line break, so
 * prose that cites a spelling is not a copy of it.
 *
 * @param context - The rule context.
 * @returns The comment-free text, as long as the source.
 */
export function codeOf(context: Context): string {
  const { text } = context.sourceCode;
  let code = "";
  let from = 0;
  for (const comment of context.sourceCode.getAllComments()) {
    code += text.slice(from, comment.start) + text.slice(comment.start, comment.end).replace(/[^\n]/gu, " ");
    from = comment.end;
  }
  return code + text.slice(from);
}

/**
 * Reports a message over a span of the file's text.
 *
 * @param context - The rule context.
 * @param start - The span's first offset.
 * @param end - The offset just past the span.
 * @param message - What to do instead.
 */
export function reportSpan(context: Context, start: number, end: number, message: string): void {
  context.report({
    message,
    loc: {
      start: context.sourceCode.getLocFromIndex(start),
      end: context.sourceCode.getLocFromIndex(end),
    },
  });
}

/**
 * A rule that reports every match of `pattern` in a file, for a spelling that has one owner or none.
 *
 * @param description - The rule's one-line documentation.
 * @param pattern - The banned spelling; a copy with the `g` flag scans the file.
 * @param message - What to do instead, shown at each match.
 * @param reading - Whether comments count as a copy of the spelling.
 * @returns The rule.
 */
export function spellingBan(
  description: string,
  pattern: RegExp,
  message: string,
  reading: CommentReading
): Rule {
  const global = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`
  );
  return {
    meta: { type: "problem", docs: { description }, schema: [] },
    create(context) {
      return {
        Program() {
          const text = reading === "code-only" ? codeOf(context) : context.sourceCode.text;
          for (const match of text.matchAll(global)) {
            reportSpan(context, match.index, match.index + match[0].length, message);
          }
        },
      };
    },
  };
}

/** A scope of the linted file, as oxlint's scope manager builds it. */
export type Scope = ReturnType<Context["sourceCode"]["getScope"]>;

/** Any AST node, as the scope manager takes it. */
export type AnyNode = Parameters<Context["sourceCode"]["getScope"]>[0];

/** A binding in a scope: a declaration, a parameter or an import. */
export type Variable = NonNullable<ReturnType<Scope["set"]["get"]>>;

/**
 * The meaning TypeScript resolves a name in: a value, a type, or a namespace, which is what the
 * first name of a qualified type such as `Menu.Input.Props` reads.
 */
export type Namespace = "value" | "type" | "namespace";

/** A name's binding and the scope that holds it. */
export type Binding = {
  /** The scope manager's variable, or undefined for a dotted namespace it does not bind. */
  readonly variable: Variable | undefined;
  readonly scope: Scope;
};

/**
 * The declarations that carry a namespace meaning: an import, which aliases every meaning of what
 * it imports, `namespace` and `module`, and an enum. A type alias, an interface, a class and a plain
 * value carry none, so `Menu.Input` in a type looks past them.
 */
const NAMESPACE_DEFINITIONS: ReadonlySet<string> = new Set(["ImportBinding", "TSModuleName", "TSEnumName"]);

/**
 * What a `namespace` or `module` declaration holds, as TypeScript's binder judges it
 * (`getModuleInstanceState`): nothing at run time, only const enums, or a value. A namespace has a
 * value meaning unless it holds nothing at run time.
 */
type InstanceState = "none" | "const-enum-only" | "instantiated";

type ModuleDeclaration = NodeOf<"TSModuleDeclaration">;
type ModuleStatement = Extract<
  NonNullable<ModuleDeclaration["body"]>,
  { readonly type: "TSModuleBlock" }
>["body"][number];

/**
 * The state a module declaration's body gives it; a body-less `declare module "x";` is a value. oxc
 * gives a dotted `namespace A.B {}` one body under a qualified name, so no body nests a declaration.
 */
function moduleState(node: ModuleDeclaration): InstanceState {
  const { body } = node;
  if (body === null) return "instantiated";
  let state: InstanceState = "none";
  for (const statement of body.body) {
    const inner = statementState(statement);
    if (inner === "instantiated") return inner;
    if (inner === "const-enum-only") state = inner;
  }
  return state;
}

/**
 * The state one statement of a namespace body contributes: types, non-exported imports and empty
 * re-exports contribute nothing, a const enum only itself, a nested namespace its own state, and
 * anything else (a variable, function, class, plain enum, exported `import =` or other statement,
 * declared or not) a value.
 */
function statementState(statement: ModuleStatement): InstanceState {
  const exported = statement.type === "ExportNamedDeclaration";
  const node = exported && statement.declaration !== null ? statement.declaration : statement;
  switch (node.type) {
    case "TSInterfaceDeclaration":
    case "TSTypeAliasDeclaration":
      return "none";
    case "TSEnumDeclaration":
      return node.const ? "const-enum-only" : "instantiated";
    case "TSModuleDeclaration":
      return moduleState(node);
    case "ImportDeclaration":
      return "none";
    case "TSImportEqualsDeclaration":
      return exported ? "instantiated" : "none";
    case "ExportNamedDeclaration":
      return node.specifiers.length === 0 ? "none" : "instantiated";
    default:
      return "instantiated";
  }
}

/**
 * Whether one declaration of a binding gives it a value meaning. typescript-eslint marks every
 * `namespace` value-bearing, which TypeScript does only for one that holds something at run time;
 * every other declaration keeps the scope manager's own mark.
 *
 * @throws When the scope manager no longer marks its definitions, a defect of the installed oxlint.
 */
function declaresValue(definition: Variable["defs"][number]): boolean {
  // A namespace's definition is its declaration; the published types leave its kind out.
  if (definition.node.type === "TSModuleDeclaration") {
    return moduleState(definition.node) !== "none";
  }
  if ("isVariableDefinition" in definition) return definition.isVariableDefinition === true;
  throw new Error(
    "oxlint's scope manager no longer marks value definitions; update scripts/oxlint/rule-kit.ts."
  );
}

/**
 * Whether a binding holds a name in a meaning: `type Menu` holds a type only, a function a value
 * only, and an import all three. A namespace holds a value only once instantiated, as TypeScript
 * rules, so a namespace of interfaces does not hide an imported value of its name. oxlint's scope
 * manager (typescript-eslint's) marks each variable with `isTypeVariable`, though its published
 * types leave the mark out; it marks no namespace meaning, which the declaration kinds give.
 *
 * @throws When the scope manager no longer marks its variables, a defect of the installed oxlint
 *   that would make every resolution here wrong.
 */
function holds(variable: Variable, namespace: Namespace): boolean {
  if (namespace === "namespace") return variable.defs.some(({ type }) => NAMESPACE_DEFINITIONS.has(type));
  if (namespace === "value") return variable.defs.some(declaresValue);
  if ("isTypeVariable" in variable) return variable.isTypeVariable === true;
  throw new Error(
    "oxlint's scope manager no longer marks type variables; update scripts/oxlint/rule-kit.ts."
  );
}

/**
 * The binding that `name` resolves to where `node` reads it in a namespace, as TypeScript resolves
 * it, with the scope that holds it; undefined for a global the file never declares, built-ins such
 * as `Object` and `document` included, which oxlint binds with no declaration. A read looks past a
 * binding of the same name that holds no meaning it reads, as a value read past a type.
 *
 * @param context - The rule context.
 * @param node - The node that reads the name.
 * @param name - The name it reads.
 * @param namespace - The meaning the read resolves the name in.
 * @returns The binding, or undefined.
 */
export function resolve(
  context: Context,
  node: AnyNode,
  name: string,
  namespace: Namespace
): Binding | undefined {
  for (let scope: Scope | null = context.sourceCode.getScope(node); scope !== null; scope = scope.upper) {
    const variable = scope.set.get(name);
    if (variable !== undefined && variable.defs.length > 0 && holds(variable, namespace)) {
      return { variable, scope };
    }
    if (dottedNamespaces(scope, name).some((declaration) => dottedHolds(declaration, namespace))) {
      return { variable: undefined, scope };
    }
  }
  return undefined;
}

/**
 * The dotted `namespace A.B {}` declarations a scope holds whose first name is `name`. Such a
 * declaration declares `A` in the scope, which typescript-eslint's scope manager does not bind, so
 * the resolver reads the scope's own statements: a module's, or a namespace body's.
 */
function dottedNamespaces(scope: Scope, name: string): ModuleDeclaration[] {
  const { block } = scope;
  const statements =
    block.type === "Program"
      ? block.body
      : block.type === "TSModuleDeclaration"
        ? (block.body?.body ?? [])
        : [];
  return statements.flatMap((statement) => {
    const node = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (node?.type !== "TSModuleDeclaration" || node.id.type !== "TSQualifiedName") return [];
    let first: NodeOf<"TSQualifiedName">["left"] = node.id;
    while (first.type === "TSQualifiedName") first = first.left;
    return first.type === "Identifier" && first.name === name ? [node] : [];
  });
}

/** Whether a dotted namespace's first name holds a meaning: a namespace always, a value once instantiated. */
function dottedHolds(declaration: ModuleDeclaration, namespace: Namespace): boolean {
  if (namespace === "namespace") return true;
  return namespace === "value" && moduleState(declaration) !== "none";
}

/**
 * The name a binding imports from its module, such as `useId` for `import { useId as makeId }`, or
 * undefined when the binding is no named import.
 *
 * @param variable - The binding.
 * @returns The imported name, or undefined.
 */
export function importedName(variable: Variable): string | undefined {
  for (const definition of variable.defs) {
    const { node } = definition;
    if (definition.type !== "ImportBinding" || node.type !== "ImportSpecifier") continue;
    return node.imported.type === "Identifier" ? node.imported.name : String(node.imported.value);
  }
  return undefined;
}

/**
 * The name a called identifier stands for: the imported name when it is an import, its own name
 * when it is a global or a local function, and undefined when a parameter, a variable or a catch
 * binding shadows it, since then it is not the module the name usually means.
 *
 * @param context - The rule context.
 * @param callee - The identifier that is called.
 * @param name - The identifier's name.
 * @returns The name it stands for, or undefined.
 */
export function calleeName(context: Context, callee: AnyNode, name: string): string | undefined {
  const variable = resolve(context, callee, name, "value")?.variable;
  if (variable === undefined) return name;
  const imported = importedName(variable);
  if (imported !== undefined) return imported;
  return variable.defs.every(({ type }) => type === "FunctionName") ? name : undefined;
}

/** How deep `staticText` follows constants, so a cycle of names ends. */
const CONSTANT_DEPTH = 4;

/**
 * The text an expression always evaluates to, where the file spells it: a string literal, a
 * template literal with each substitution read as `${}`, a `+` of such parts, or a `const` bound to
 * one. Undefined for anything the file does not fix.
 *
 * @param context - The rule context.
 * @param node - The expression.
 * @param depth - How many more constants to follow.
 * @returns The text, or undefined.
 */
export function staticText(context: Context, node: AnyNode, depth = CONSTANT_DEPTH): string | undefined {
  if (node.type === "Literal") {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree types every literal "Literal", so its value's type is the only thing that tells a string from a number, boolean, null, bigint or RegExp literal.
    return typeof node.value === "string" ? node.value : undefined;
  }
  if (node.type === "TemplateLiteral")
    return node.quasis.map(({ value }) => value.cooked ?? value.raw).join("${}");
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = staticText(context, node.left, depth);
    const right = staticText(context, node.right, depth);
    return left === undefined || right === undefined ? undefined : left + right;
  }
  if (node.type !== "Identifier" || depth === 0) return undefined;
  const value = constantValue(context, node, node.name);
  return value === undefined ? undefined : staticText(context, value, depth - 1);
}

/**
 * The name a call's callee stands for: `calleeName` for an identifier, or the member's name for a
 * member read off a namespace import, such as `useMotionMark` in `Marks.useMotionMark()`.
 *
 * @param context - The rule context.
 * @param callee - The call's callee.
 * @returns The name it stands for, or undefined.
 */
export function calledName(context: Context, callee: NodeOf<"CallExpression">["callee"]): string | undefined {
  if (callee.type === "Identifier") return calleeName(context, callee, callee.name);
  if (
    callee.type !== "MemberExpression" ||
    callee.computed ||
    callee.property.type !== "Identifier" ||
    callee.object.type !== "Identifier"
  ) {
    return undefined;
  }
  const definition = resolve(context, callee.object, callee.object.name, "value")?.variable?.defs[0];
  return definition?.node.type === "ImportNamespaceSpecifier" ? callee.property.name : undefined;
}

/**
 * The expression a `const` binding holds, for a name read where `node` reads it, or undefined for
 * any other binding.
 *
 * @param context - The rule context.
 * @param node - The identifier.
 * @param name - Its name.
 * @returns The bound expression, or undefined.
 */
export function constantValue(context: Context, node: AnyNode, name: string): AnyNode | undefined {
  const definition = resolve(context, node, name, "value")?.variable?.defs[0];
  const declarator = definition?.node;
  if (
    definition?.type !== "Variable" ||
    declarator?.type !== "VariableDeclarator" ||
    definition.parent?.type !== "VariableDeclaration" ||
    definition.parent.kind !== "const" ||
    declarator.init === null
  ) {
    return undefined;
  }
  return declarator.init;
}

/** The repository root: this kit lives in `scripts/oxlint/`. */
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * Check that the tree holds every module and folder the plugin's rules key on, as repository-rooted
 * paths starting with `/`. A rule keyed to an owner the tree no longer holds checks nothing, so a
 * rename that leaves the plugin behind stops lint at load.
 *
 * @param owners - The owner paths.
 * @throws When an owner is missing, naming each missing path.
 */
export function requireOwners(owners: readonly string[]): void {
  const missing = owners.filter((owner) => !existsSync(join(REPO_ROOT, owner)));
  if (missing.length > 0) {
    throw new Error(
      `The fuse lint plugin keys its rules on ${missing.join(", ")}, which this tree does not hold. Update scripts/oxlint/ with the rename.`
    );
  }
}
