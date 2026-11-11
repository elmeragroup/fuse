import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

import { moduleExportName, propertyKeyName } from "./ast-names.ts";
import { descendants, functionNameOf, isFunction, unwrap } from "./ast-walk.ts";
import { allAgree } from "./quantify.ts";
import { staticText } from "./static-text.ts";

/**
 * An abstract evaluator for the test-file rules: every value an expression may hold, read off the
 * file alone. Rules reach every value they judge (a callee, a receiver, a path, an options object,
 * a delay, an expected class, a measurement, a walk) through `evaluate` or `calleeTargets`, every
 * key through `memberName` or `propertyKeyName`, and judge the alternatives through `quantify.ts`.
 *
 * `evaluate` returns alternatives (`Alt`), at most 64; more is `unknown`. Every compound operation
 * maps over the cartesian product of its operands' alternatives through `product`, the one way
 * operands combine, so no operation picks one operand alternative, flattens them, or merges them.
 * The evaluator follows exactly these steps, and nothing else:
 *
 * 1. Wrappers: parentheses, `await`, optional chains, `!` and TypeScript `as`/`satisfies`.
 * 2. A `const`, or a `let`/`var` that is never reassigned, to its initializer, through any chain
 *    of such aliases. A reassigned binding is `unknown`. An object or array literal the code
 *    mutates through its binding (an assigned, updated or deleted member, or a mutating method
 *    such as `push`) stays that literal, but every member read off it is `unknown`.
 * 3. A key destructured from an object pattern (`const { a: b } = value`, `const { "a": b } =
 *    value`) to that member of each alternative of the value, as step 4 reads it.
 * 4. A static member read (`a.b`, `a["b"]`, `` a[`b`] ``, `a[0]`) of each alternative: an object
 *    literal's last property with the key, after its spreads (each spread alternative builds its
 *    own object, last wins inside it; a key a spread the evaluator cannot open may set is
 *    `unknown`, a spread of `null` or `undefined` sets nothing, and a key no property sets is
 *    `undefined`); an array literal's element, after its spreads (an index at or past an unopened
 *    spread is `unknown`); a namespace import's export; and, off any other value, a `member` of it
 *    that keeps the key.
 * 5. A call to a local function (a declaration, or a function bound by step 2) to every value its
 *    body returns: an arrow's expression body, or each `return` in a block body.
 * 6. A call to a static `evaluate`, `evaluateHandle`, `$eval` or `$$eval` member with a function
 *    argument to every value that callback returns.
 * 7. An import to its module and imported name, and a dynamic `import()` of a string to that
 *    module's namespace, whose members step 4 reads.
 * 8. A global name to itself, whatever local binding holds it (`const later = setTimeout` is
 *    `setTimeout`), and a member of `globalThis`, `window` or `self` to the global it names.
 * 9. A condition (`c ? a : b`) or a logical expression (`a || b`, `a ?? b`, `a && b`) to the
 *    alternatives of both operands.
 * 10. Primitive operations with JavaScript semantics on typed primitive alternatives (string,
 *     number, boolean, `null`, `undefined`): template literals and `+` (string conversion when a
 *     side is a string, numeric addition otherwise), `-`, `*`, `/`, `%`, unary `-`; and the string
 *     methods `concat`, `trim`, `trimStart`, `trimEnd`, `toLowerCase`, `toUpperCase`, and an array
 *     literal's `join` (elements converted as `join` does: `null` and `undefined` are empty).
 *     An operation on an alternative that is no typed primitive keeps the expression (`opaque`);
 *     any other method call on a string is `opaque` too.
 *
 * Every walk carries its active path, the bindings and nodes it is inside right now. A step back
 * onto that path is `unknown`, so a self-referencing binding stops, and a call back into a function
 * whose returns are being read is `opaque` (the call itself). Within one file an expression is
 * evaluated once: its alternatives are kept for every later read unless its walk cut a cycle, since
 * only a cut makes a result depend on the path that reached it. A parameter evaluates to itself
 * (`parameter`), a `for…of` or `for…in` binding to its iterable (`loop`), a call the evaluator does
 * not follow to itself (`opaque`), and anything else the list does not name to `opaque`. An
 * alternative reached through a property read (steps 3 and 4) is marked `narrowed`; one reached
 * through a name (a binding in steps 2 and 3, a property of a named value, a return in steps 5 and
 * 6, or a step-10 result with a named operand) is marked `named`.
 */

/** The callee names that run a callback in the page and hand back what it returns. */
export const EVALUATES: ReadonlySet<string> = new Set(["evaluate", "evaluateHandle", "$eval", "$$eval"]);

/** The global objects a global can be read off without changing what it names. */
const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self"]);

/** How many alternatives one evaluation keeps before it gives up as `unknown`. */
const MAX_ALTERNATIVES = 64;

/** The methods that change an array or object in place. */
const MUTATORS = new Set([
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "fill",
  "copyWithin",
  "set",
  "delete",
  "clear",
  "add",
]);

/** The string methods step 10 assembles from a string receiver. */
const STRING_METHODS = new Map<string, (text: string) => string>([
  ["trim", (text) => text.trim()],
  ["trimStart", (text) => text.trimStart()],
  ["trimEnd", (text) => text.trimEnd()],
  ["toLowerCase", (text) => text.toLowerCase()],
  ["toUpperCase", (text) => text.toUpperCase()],
]);

/** A property an object literal alternative sets: its key, its value and the property node. */
type PropertyEntry = {
  readonly _tag: "property";
  readonly key: string;
  readonly value: ESTree.Node;
  readonly property: ESTree.ObjectProperty;
};

/** One entry of an object literal alternative, in source order. */
type Entry = PropertyEntry | { readonly _tag: "unopened-spread" };

/** What one alternative is. */
type AltBody =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "null" }
  | { readonly kind: "undefined" }
  | { readonly kind: "regex"; readonly pattern: string; readonly flags: string }
  | { readonly kind: "object"; readonly node: ESTree.Node; readonly entries: ReadonlyArray<Entry> }
  | {
      readonly kind: "array";
      readonly node: ESTree.Node;
      readonly elements: ReadonlyArray<ESTree.Node | null>;
      readonly complete: boolean;
    }
  | { readonly kind: "function"; readonly fn: ESTree.Node }
  | { readonly kind: "global"; readonly name: string }
  | { readonly kind: "import"; readonly source: string; readonly imported: string }
  | { readonly kind: "member"; readonly object: Alt; readonly key: string }
  | { readonly kind: "parameter"; readonly fn: ESTree.Node; readonly index: number }
  | { readonly kind: "loop"; readonly iterable: ESTree.Node }
  | { readonly kind: "opaque"; readonly node: ESTree.Node }
  | { readonly kind: "unknown" };

/**
 * One value an expression may hold: what it is, whether a property read reached it (`narrowed`),
 * and whether a name reached it (`named`): a binding, a property of a named value, a call's
 * return, or a primitive operation on a named operand.
 */
export type Alt = AltBody & { readonly narrowed: boolean; readonly named: boolean };

/** A callee as the module that exports it and the names read off it. */
export type CalleeTarget = {
  /** The module it is imported from, or `undefined` for a global or a local value. */
  readonly module: string | undefined;
  /**
   * The names after the module: `["setTimeout"]` for `timers.setTimeout` off `node:timers`. A
   * receiver the evaluator cannot name is `*`, so `createRequire(url).resolve` is `["*", "resolve"]`.
   */
  readonly path: ReadonlyArray<string>;
};

/** The bindings and nodes a walk is inside right now. */
export type ActivePath = ReadonlySet<ESTree.Node | Variable>;

/** One file's evaluations, shared by every rule that lints it. */
type Memo = {
  /** Each expression's alternatives, kept only when its walk cut no cycle. */
  readonly values: WeakMap<ESTree.Node, Alt[]>;
  /** How many cycle cuts the file's walks have made, so a walk can tell whether it made one. */
  cuts: number;
};

/** Each file's memo, keyed by its program. */
const MEMOS = new WeakMap<ESTree.Node, Memo>();

/** Each function's returned expressions, which depend on its syntax alone. */
const RETURNS = new WeakMap<ESTree.Node, ESTree.Node[]>();

/** The arithmetic step 10 computes on numbers, by operator; `+` on a string side concatenates first. */
const ARITHMETIC = new Map<string, (left: number, right: number) => number>([
  ["+", (left, right) => left + right],
  ["-", (left, right) => left - right],
  ["*", (left, right) => left * right],
  ["/", (left, right) => left / right],
  ["%", (left, right) => left % right],
]);

/** An alternative reached neither through a property read nor through a name. */
function plain(body: AltBody): Alt {
  return { ...body, narrowed: false, named: false };
}

/** Alternatives reached through a name. */
function named(values: ReadonlyArray<Alt>): Alt[] {
  return values.map((value) => ({ ...value, named: true }));
}

const UNKNOWN: Alt = plain({ kind: "unknown" });

/**
 * The active path with one more step, or `undefined` when the walk is already inside that step.
 *
 * @param path - The walk's active path.
 * @param step - The binding or node the walk is about to enter.
 * @returns The longer path, or `undefined` for a cycle.
 */
export function enter(path: ActivePath, step: ESTree.Node | Variable): ActivePath | undefined {
  return path.has(step) ? undefined : new Set([...path, step]);
}

/**
 * Alternatives from several sources side by side (a condition's arms, a function's returns),
 * capped: more than `MAX_ALTERNATIVES` is `unknown`.
 *
 * @param lists - Each source's alternatives.
 * @returns All of them, or `[unknown]` past the cap.
 */
function alternatives(...lists: ReadonlyArray<ReadonlyArray<Alt>>): Alt[] {
  const all = lists.flat();
  return all.length > MAX_ALTERNATIVES ? [UNKNOWN] : all;
}

/**
 * The one way operands combine: `combine` runs on every combination of one alternative per
 * operand, and the results are the operation's alternatives. Past `MAX_ALTERNATIVES`
 * combinations or results, the result is `overflow` alone: `unknown` for the evaluator's own
 * operations.
 *
 * @param operands - Each operand's alternatives, in order.
 * @param operation - The operation on one combination.
 * @param overflow - The result past the cap.
 * @returns The operation's alternatives.
 */
export function product<T, R>(
  operands: ReadonlyArray<ReadonlyArray<T>>,
  operation: (combination: ReadonlyArray<T>) => ReadonlyArray<R>,
  overflow: R
): R[] {
  let combinations: T[][] = [[]];
  for (const operand of operands) {
    combinations = combinations.flatMap((before) => operand.map((choice) => [...before, choice]));
    if (combinations.length > MAX_ALTERNATIVES) return [overflow];
  }
  const results = combinations.flatMap((combination) => operation(combination));
  return results.length > MAX_ALTERNATIVES ? [overflow] : results;
}

/** The evaluator's product: past the cap, `unknown`. */
function combine(
  operands: ReadonlyArray<ReadonlyArray<Alt>>,
  operation: (combination: ReadonlyArray<Alt>) => ReadonlyArray<Alt>
): Alt[] {
  return product(operands, operation, UNKNOWN);
}

/**
 * The key a member read names statically: `x` for `a.x`, `a["x"]` or `` a[`x`] ``, `0` for `a[0]`.
 *
 * @param member - Any node.
 * @returns The key, or `undefined` for anything but a static member read.
 */
export function memberName(member: ESTree.Node): string | undefined {
  const expression = unwrap(member);
  return expression.type === "MemberExpression"
    ? propertyKeyName({ key: expression.property, computed: expression.computed })
    : undefined;
}

/**
 * The variable an identifier reads, through the scopes around it. A JSX tag such as `<InlineMenu />`
 * reads the component binding of its name; a lowercase tag such as `<button>` is an intrinsic
 * element and reads none.
 *
 * @param context - The rule context.
 * @param identifier - An identifier reference or a JSX tag name.
 * @returns The variable, or `undefined` for a global or an intrinsic tag.
 */
export function variableOf(context: Context, identifier: ESTree.Node): Variable | undefined {
  if (identifier.type !== "Identifier" && identifier.type !== "JSXIdentifier") return undefined;
  if (identifier.type === "JSXIdentifier" && /^[a-z]/u.test(identifier.name)) return undefined;
  for (
    let scope: Scope | null = context.sourceCode.getScope(identifier);
    scope !== null;
    scope = scope.upper
  ) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) return variable;
  }
  return undefined;
}

/**
 * The values a function returns (step 5): an arrow's expression body, or the argument of each
 * `return` in its block body, nested functions aside.
 *
 * @param context - The rule context.
 * @param fn - A function node.
 * @returns The returned expressions.
 */
export function returnedValues(context: Context, fn: ESTree.Node): ESTree.Node[] {
  if (!isFunction(fn)) return [];
  const cached = RETURNS.get(fn);
  if (cached !== undefined) return cached;
  const body = fn.body;
  const returned =
    body === null
      ? []
      : body.type !== "BlockStatement"
        ? [body]
        : descendants(context, body, "this-function").flatMap((node) =>
            node.type === "ReturnStatement" && node.argument !== null ? [node.argument] : []
          );
  RETURNS.set(fn, returned);
  return returned;
}

/** The name an import specifier takes from its module: a name, `default` or `*`. */
function importedName(specifier: ESTree.Node): string | undefined {
  if (specifier.type === "ImportDefaultSpecifier") return "default";
  if (specifier.type === "ImportNamespaceSpecifier") return "*";
  return specifier.type === "ImportSpecifier" ? moduleExportName(specifier.imported) : undefined;
}

/** Whether code changes a binding's value in place: assigns, updates or deletes a member, or calls a mutator. */
function isMutated(variable: Variable): boolean {
  return variable.references.some((reference) => {
    const member = reference.identifier.parent;
    if (member.type !== "MemberExpression" || member.object !== reference.identifier) return false;
    const use = member.parent;
    if (use.type === "AssignmentExpression") return use.left === member;
    if (use.type === "UpdateExpression") return true;
    if (use.type === "UnaryExpression") return use.operator === "delete";
    return use.type === "CallExpression" && use.callee === member && MUTATORS.has(memberName(member) ?? "");
  });
}

/** A JavaScript primitive step 10 computes with. */
type Primitive = string | number | boolean | null | undefined;

/** The primitive an alternative holds, boxed so `undefined` is a value; nothing for another kind. */
function primitiveOf(alternative: Alt): ReadonlyArray<{ readonly value: Primitive }> {
  switch (alternative.kind) {
    case "string":
    case "number":
    case "boolean":
      return [{ value: alternative.value }];
    case "null":
      return [{ value: null }];
    case "undefined":
      return [{ value: undefined }];
    default:
      return [];
  }
}

/** An alternative for a primitive JavaScript value, named when an operand it comes from was. */
function fromPrimitive(value: Primitive, from: ReadonlyArray<Alt> = []): Alt {
  const isNamed = from.some((operand) => operand.named);
  const body = (): AltBody => {
    if (value === null) return { kind: "null" };
    if (value === undefined) return { kind: "undefined" };
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a computed primitive carries no other tag than its JavaScript type
    if (typeof value === "string") return { kind: "string", value };
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a computed primitive carries no other tag than its JavaScript type
    if (typeof value === "number") return { kind: "number", value };
    return { kind: "boolean", value };
  };
  return { ...body(), narrowed: false, named: isNamed };
}

/** The values of a combination when every alternative in it is a typed primitive. */
function primitives(combination: ReadonlyArray<Alt>): Primitive[] | undefined {
  const values = combination.flatMap((alternative) => primitiveOf(alternative).map((boxed) => boxed.value));
  return values.length === combination.length ? values : undefined;
}

/** The evaluator for one walk: the rule context fixed, the file's memo shared, its own active path. */
function evaluator(context: Context, memo: Memo) {
  const active = new Set<ESTree.Node | Variable>();
  const opaque = (node: ESTree.Node): Alt[] => [plain({ kind: "opaque", node })];

  /** Run one step with it on the active path; a step already on it is a cycle, cut to `unknown`. */
  const step = (at: ESTree.Node | Variable, run: () => Alt[]): Alt[] => {
    if (active.has(at)) {
      memo.cuts += 1;
      return [UNKNOWN];
    }
    active.add(at);
    const values = run();
    active.delete(at);
    return values;
  };

  /** A property's values, reached through a read off a container: named when the container is. */
  const narrow = (values: ReadonlyArray<Alt>, container: Alt): Alt[] =>
    values.map((value) => ({ ...value, narrowed: true, named: value.named || container.named }));

  /** An object literal's entries, one list per combination of its spreads' alternatives. */
  const objectAlternatives = (node: ESTree.ObjectExpression): Alt[] => {
    const parts: Array<ReadonlyArray<Alt>> = node.properties.map((property): ReadonlyArray<Alt> => {
      if (property.type === "SpreadElement") return evaluateNode(property.argument);
      const key = propertyKeyName(property);
      return [
        plain({
          kind: "object",
          node: property,
          entries:
            key === undefined
              ? [{ _tag: "unopened-spread" }]
              : [{ _tag: "property", key, value: property.value, property }],
        }),
      ];
    });
    return combine(parts, (combination) => [
      plain({
        kind: "object",
        node,
        entries: combination.flatMap((part): Entry[] => {
          if (part.kind === "object") return [...part.entries];
          // Spreading `null` or `undefined` sets nothing.
          return part.kind === "null" || part.kind === "undefined" ? [] : [{ _tag: "unopened-spread" }];
        }),
      }),
    ]);
  };

  /** An array literal's elements, one list per combination of its spreads' alternatives. */
  const arrayAlternatives = (node: ESTree.ArrayExpression): Alt[] => {
    const parts: Array<ReadonlyArray<Alt>> = node.elements.map((element): ReadonlyArray<Alt> =>
      element?.type === "SpreadElement"
        ? evaluateNode(element.argument)
        : [plain({ kind: "array", node, elements: [element], complete: true })]
    );
    return combine(parts, (combination) => {
      const elements: Array<ESTree.Node | null> = [];
      for (const part of combination) {
        if (part.kind !== "array") return [plain({ kind: "array", node, elements, complete: false })];
        elements.push(...part.elements);
        if (!part.complete) return [plain({ kind: "array", node, elements, complete: false })];
      }
      return [plain({ kind: "array", node, elements, complete: true })];
    });
  };

  /** What one alternative holds under a key (step 4). */
  const memberOf = (container: Alt, key: string): Alt[] => {
    switch (container.kind) {
      case "object": {
        const entry = entryFor(container, key);
        if (entry === "unknown") return [UNKNOWN];
        return entry === undefined
          ? [plain({ kind: "undefined" })]
          : narrow(evaluateNode(entry.value), container);
      }
      case "array": {
        const index = Number(key);
        if (!Number.isInteger(index)) return [plain({ kind: "member", object: container, key })];
        if (index >= container.elements.length)
          return container.complete ? [plain({ kind: "undefined" })] : [UNKNOWN];
        const element = container.elements[index];
        return element === null || element === undefined
          ? [plain({ kind: "undefined" })]
          : narrow(evaluateNode(element), container);
      }
      case "import":
        return container.imported === "*"
          ? [plain({ kind: "import", source: container.source, imported: key })]
          : [plain({ kind: "member", object: container, key })];
      case "unknown":
        return [UNKNOWN];
      default:
        return [plain({ kind: "member", object: container, key })];
    }
  };

  /** Every value a function returns, each evaluated, with the function on the active path. */
  const returnsOf = (fn: ESTree.Node): Alt[] =>
    step(fn, () => named(alternatives(...returnedValues(context, fn).map((value) => evaluateNode(value)))));

  /** One callee alternative called with the call's arguments (steps 5, 6 and 10). */
  const callOne = (call: ESTree.CallExpression, callee: Alt): Alt[] => {
    if (callee.kind === "function") {
      // Checked here, not by `step`, so a memoized value of the callee cannot turn the cut `unknown`.
      if (active.has(callee.fn)) {
        memo.cuts += 1;
        return opaque(call);
      }
      return returnsOf(callee.fn);
    }
    if (callee.kind !== "member") return opaque(call);
    const receiver = callee.object;
    if (EVALUATES.has(callee.key)) {
      const callbacks = combine(
        call.arguments.map((argument) => evaluateNode(argument)),
        (combination) => combination.filter((argument) => argument.kind === "function")
      );
      if (callbacks.length > 0) {
        return alternatives(
          ...callbacks.map((callback) => (callback.kind === "function" ? returnsOf(callback.fn) : [UNKNOWN]))
        );
      }
      return opaque(call);
    }
    const map = STRING_METHODS.get(callee.key);
    if (map !== undefined && receiver.kind === "string")
      return [fromPrimitive(map(receiver.value), [receiver])];
    if (callee.key === "concat" && receiver.kind === "string") {
      return combine(
        call.arguments.map((argument) => evaluateNode(argument)),
        (combination) => {
          const values = primitives(combination);
          return values === undefined
            ? opaque(call)
            : [fromPrimitive(receiver.value.concat(...values.map(String)), [receiver, ...combination])];
        }
      );
    }
    if (callee.key === "join" && receiver.kind === "array") {
      if (!receiver.complete) return opaque(call);
      const [separator] = call.arguments;
      return combine(
        [
          separator === undefined ? [fromPrimitive(",")] : evaluateNode(separator),
          ...receiver.elements.map((element) =>
            element === null ? [plain({ kind: "undefined" })] : evaluateNode(element)
          ),
        ],
        ([glue, ...items]) => {
          const values = primitives(items);
          if (glue?.kind !== "string" || values === undefined) return opaque(call);
          const text = values
            .map((value) => (value === null || value === undefined ? "" : String(value)))
            .join(glue.value);
          return [fromPrimitive(text, [glue, ...items])];
        }
      );
    }
    return opaque(call);
  };

  /** A template literal's values (step 10). */
  const templateOf = (node: ESTree.TemplateLiteral): Alt[] =>
    combine(
      node.expressions.map((part) => evaluateNode(part)),
      (combination) => {
        const values = primitives(combination);
        if (values === undefined) return opaque(node);
        let text = "";
        node.quasis.forEach((quasi, index) => {
          text += staticText(quasi);
          if (index < values.length) text += String(values[index]);
        });
        return [fromPrimitive(text, combination)];
      }
    );

  /** A binary operation's values (step 10). */
  const binaryOf = (node: ESTree.BinaryExpression | ESTree.PrivateInExpression): Alt[] => {
    const arithmetic = ARITHMETIC.get(node.operator);
    if (node.left.type === "PrivateIdentifier" || arithmetic === undefined) return opaque(node);
    return combine([evaluateNode(node.left), evaluateNode(node.right)], (combination) => {
      const values = primitives(combination);
      if (values === undefined) return opaque(node);
      const [left, right] = values;
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- step 10's `+` converts to strings exactly when a side is a string
      if (node.operator === "+" && (typeof left === "string" || typeof right === "string")) {
        return [fromPrimitive(String(left) + String(right), combination)];
      }
      return [fromPrimitive(arithmetic(Number(left), Number(right)), combination)];
    });
  };

  /** What a variable's single definition holds (steps 2, 3 and 7), the variable on the active path. */
  const definitionOf = (variable: Variable): Alt[] => {
    const [def, ...others] = variable.defs;
    if (def === undefined || others.length > 0) return [UNKNOWN];
    switch (def.type) {
      case "ImportBinding": {
        const declaration = def.parent;
        const imported = importedName(def.node);
        return declaration?.type === "ImportDeclaration" && imported !== undefined
          ? [plain({ kind: "import", source: declaration.source.value, imported })]
          : [UNKNOWN];
      }
      case "Parameter": {
        const params = isFunction(def.node) ? def.node.params : [];
        const index = params.findIndex(
          (param) => param === def.name || (param.type === "AssignmentPattern" && param.left === def.name)
        );
        return [plain({ kind: "parameter", fn: def.node, index })];
      }
      case "FunctionName":
        return [plain({ kind: "function", fn: def.node })];
      case "Variable":
        break;
      default:
        return [UNKNOWN];
    }
    const declarator = def.node;
    if (declarator.type !== "VariableDeclarator") return [UNKNOWN];
    if (variable.references.some((reference) => reference.isWrite() && !reference.init)) return [UNKNOWN];
    if (declarator.init === null) {
      const loop = declarator.parent.parent;
      return loop?.type === "ForOfStatement" || loop?.type === "ForInStatement"
        ? [plain({ kind: "loop", iterable: loop.right })]
        : [UNKNOWN];
    }
    if (declarator.id.type === "Identifier") {
      const values = named(evaluateNode(declarator.init));
      if (!isMutated(variable)) return values;
      // A mutated literal keeps its identity, but nothing it holds is known.
      return values.map((value): Alt => {
        if (value.kind === "array") return { ...value, elements: [], complete: false };
        if (value.kind === "object") return { ...value, entries: [{ _tag: "unopened-spread" }] };
        return value;
      });
    }
    if (declarator.id.type !== "ObjectPattern") return [UNKNOWN];
    const init = declarator.init;
    for (const property of declarator.id.properties) {
      if (property.type !== "Property") continue;
      const target = property.value.type === "AssignmentPattern" ? property.value.left : property.value;
      if (target !== def.name) continue;
      const key = propertyKeyName(property);
      if (key === undefined) return [UNKNOWN];
      return combine([named(evaluateNode(init))], ([container]) =>
        container === undefined ? [UNKNOWN] : memberOf(container, key)
      );
    }
    return [UNKNOWN];
  };

  /** What an identifier's binding holds (steps 2, 3, 7 and 8). */
  const bindingOf = (identifier: ESTree.Node): Alt[] => {
    if (identifier.type !== "Identifier") return [UNKNOWN];
    const variable = variableOf(context, identifier);
    // An environment global (the config's `env` or `globals`) has a variable with no definition.
    if (variable === undefined || variable.defs.length === 0)
      return [plain({ kind: "global", name: identifier.name })];
    return step(variable, () => definitionOf(variable));
  };

  /** Every value one unwrapped expression may hold, the expression already on the active path. */
  const expressionOf = (expression: ESTree.Node): Alt[] => {
    if (isFunction(expression)) return [plain({ kind: "function", fn: expression })];
    switch (expression.type) {
      case "Literal": {
        if ("regex" in expression) {
          return [plain({ kind: "regex", pattern: expression.regex.pattern, flags: expression.regex.flags })];
        }
        const value = expression.value;
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree tags every literal kind `Literal`; the value's type is the only tag a bigint literal has
        if (typeof value === "bigint") return opaque(expression);
        return [fromPrimitive(value)];
      }
      case "Identifier":
        return bindingOf(expression);
      case "MemberExpression": {
        const key = memberName(expression);
        if (key === undefined) return opaque(expression);
        return combine([evaluateNode(expression.object)], ([container]) =>
          container === undefined ? [UNKNOWN] : memberOf(container, key)
        );
      }
      case "CallExpression":
        return combine([evaluateNode(expression.callee)], ([callee]) =>
          callee === undefined ? [UNKNOWN] : callOne(expression, callee)
        );
      case "ConditionalExpression":
        return alternatives(evaluateNode(expression.consequent), evaluateNode(expression.alternate));
      case "LogicalExpression":
        return alternatives(evaluateNode(expression.left), evaluateNode(expression.right));
      case "ImportExpression":
        return combine([evaluateNode(expression.source)], ([source]) =>
          source?.kind === "string"
            ? [plain({ kind: "import", source: source.value, imported: "*" })]
            : opaque(expression)
        );
      case "ObjectExpression":
        return objectAlternatives(expression);
      case "ArrayExpression":
        return arrayAlternatives(expression);
      case "TemplateLiteral":
        return templateOf(expression);
      case "BinaryExpression":
        return binaryOf(expression);
      case "UnaryExpression":
        if (expression.operator !== "-") return opaque(expression);
        return combine([evaluateNode(expression.argument)], ([operand]) =>
          operand?.kind === "number" ? [fromPrimitive(-operand.value, [operand])] : opaque(expression)
        );
      default:
        return opaque(expression);
    }
  };

  /**
   * Every value an expression may hold, read from the file's memo when an earlier walk kept it.
   * A node on the active path is a cycle before it is a memo hit, so the cut lands where it would
   * without the memo.
   */
  const evaluateNode = (node: ESTree.Node): Alt[] => {
    const expression = unwrap(node);
    const known = active.has(expression) ? undefined : memo.values.get(expression);
    if (known !== undefined) return known;
    const cutsBefore = memo.cuts;
    const values = step(expression, () => expressionOf(expression));
    if (memo.cuts === cutsBefore) memo.values.set(expression, values);
    return values;
  };

  return evaluateNode;
}

/**
 * Every value an expression may hold, by the steps in this module's contract.
 *
 * @param context - The rule context.
 * @param node - Any expression.
 * @returns The alternatives, never empty, at most 64.
 */
export function evaluate(context: Context, node: ESTree.Node): Alt[] {
  const program = context.sourceCode.ast;
  const memo = MEMOS.get(program) ?? { values: new WeakMap(), cuts: 0 };
  MEMOS.set(program, memo);
  const values = evaluator(context, memo)(node);
  return values.length === 0 ? [UNKNOWN] : [...values];
}

/**
 * The entry that sets a key on an object alternative: its last property with the key, after its
 * spreads; `unknown` when an unopened spread may set it; `undefined` when nothing sets it.
 *
 * @param object - An alternative.
 * @param key - The property key.
 * @returns The setting property, `"unknown"`, or `undefined`.
 */
export function entryFor(object: Alt, key: string): PropertyEntry | "unknown" | undefined {
  if (object.kind !== "object") return "unknown";
  for (const entry of [...object.entries].toReversed()) {
    if (entry._tag === "unopened-spread") return "unknown";
    if (entry.key === key) return entry;
  }
  return undefined;
}

/** A target with one more name read off it; a name off a global object is that global. */
function append(base: CalleeTarget, key: string): CalleeTarget {
  const [only, ...rest] = base.path;
  if (base.module === undefined && rest.length === 0 && only !== undefined && GLOBAL_OBJECTS.has(only)) {
    return { module: undefined, path: [key] };
  }
  return { module: base.module, path: [...base.path, key] };
}

/**
 * The function one alternative names, as the module that exports it and the names read off it:
 * a global, an import, a named local function, or a key read off any of those; a key read off a
 * value with no name is read off `*`.
 *
 * @param alternative - An alternative of a callee.
 * @returns The target, or `undefined` for an alternative that names no function.
 */
export function targetOf(alternative: Alt): CalleeTarget | undefined {
  switch (alternative.kind) {
    case "import":
      return alternative.imported === "*" || alternative.imported === "default"
        ? { module: alternative.source, path: [] }
        : { module: alternative.source, path: [alternative.imported] };
    case "global":
      return { module: undefined, path: [alternative.name] };
    case "function": {
      const name = functionNameOf(alternative.fn);
      return name?.type === "Identifier" ? { module: undefined, path: [name.name] } : undefined;
    }
    case "member":
      return append(targetOf(alternative.object) ?? { module: undefined, path: ["*"] }, alternative.key);
    default:
      return undefined;
  }
}

/**
 * The target of every alternative a callee may hold, in order: one entry per alternative, with
 * `undefined` for an alternative that names no function, so a rule can tell whether every
 * alternative is the same API.
 *
 * @param context - The rule context.
 * @param callee - A call's callee, or any expression that names a function.
 * @returns One target, or `undefined`, per alternative.
 */
export function calleeTargets(context: Context, callee: ESTree.Node): Array<CalleeTarget | undefined> {
  return evaluate(context, callee).map(targetOf);
}

/**
 * The API each alternative of a callee names in full, module left off, such as
 * `vi.useFakeTimers`: one entry per alternative, `undefined` for one that names no function.
 *
 * @param context - The rule context.
 * @param callee - A call's callee.
 * @returns One API, or `undefined`, per alternative.
 */
export function calleeApis(context: Context, callee: ESTree.Node): Array<string | undefined> {
  return calleeTargets(context, callee).map((target) => target?.path.join("."));
}

/**
 * Whether a callee is one API in every alternative, such as `Math.abs` or `JSON.parse`.
 *
 * @param context - The rule context.
 * @param callee - A call's callee.
 * @param api - The API's dotted name, module left off.
 * @returns Whether every alternative names that API.
 */
export function isApi(context: Context, callee: ESTree.Node, api: string): boolean {
  return allAgree(calleeApis(context, callee)) === api;
}

/**
 * The dotted names a callee's alternatives have, module left off, one per alternative that names a
 * function: `["vi.useFakeTimers"]`.
 *
 * @param context - The rule context.
 * @param callee - A call's callee.
 * @returns The names.
 */
export function calleeNames(context: Context, callee: ESTree.Node): string[] {
  return calleeTargets(context, callee).flatMap((target) =>
    target === undefined ? [] : [target.path.join(".")]
  );
}

/**
 * The strings an expression may be: the value of each alternative that is a string. A consumer
 * that needs every alternative to be a string quantifies the alternatives itself.
 *
 * @param alternatives - An expression's alternatives.
 * @returns The string values.
 */
export function stringValues(alternatives: ReadonlyArray<Alt>): string[] {
  return alternatives.flatMap((alternative) => (alternative.kind === "string" ? [alternative.value] : []));
}
