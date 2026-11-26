import type { Context, ESTree, Scope, Variable } from "@oxlint/plugins";

import { moduleExportName, propertyKeyName } from "./ast-names.ts";
import { descendants, functionNameOf, isFunction, unwrap } from "./ast-walk.ts";
import { staticText } from "./static-text.ts";

/**
 * An abstract evaluator: every value an expression may hold, read off the file alone. Rules reach
 * every value they judge (a hook's callee, an imported module) through `evaluate`, a callee's name
 * through `calleeName`, every key through `memberName` or `propertyKeyName`, the text a string may
 * hold through `textParts`, and judge the alternatives through `quantify.ts`.
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
 *    `setTimeout`).
 * 9. A condition (`c ? a : b`) or a logical expression (`a || b`, `a ?? b`, `a && b`) to the
 *    alternatives of both operands.
 * 10. Primitive operations with JavaScript semantics on typed primitive alternatives (string,
 *     number, boolean, `null`, `undefined`): template literals and `+` (string conversion when a
 *     side is a string, numeric addition otherwise), `-`, `*`, `/`, `%`, unary `-`; and the string
 *     methods `concat`, `trim`, `trimStart`, `trimEnd`, `toLowerCase`, `toUpperCase`, and an array
 *     literal's `join` (elements converted as `join` does: `null` and `undefined` are empty).
 *     An operation on an alternative that is no typed primitive keeps the expression (`opaque`),
 *     and so does a `join` on an array with an unopened spread; any other method call on a string
 *     is `opaque` too.
 * 11. Only when the caller asks for `strings: "partial"`, a string with parts the evaluator cannot
 *     read is a `text` instead of `opaque`: its known text in order, with a gap for each part that
 *     is no typed primitive, and adjacent gaps as one. Template literals, `+` with a string or
 *     `text` side, `concat` and an array literal's `join` build one. A `join` with a known
 *     separator keeps every element it can read, on both sides of an unopened spread, and puts one
 *     gap where the spread goes. A `text` with no gap is a `string`. A `text` of more than 64 runs
 *     and gaps is `unknown`, so a string doubled through aliases stays small. Every other step 10
 *     operation needs an exact value and is `opaque` on a `text`; a member read off one is a
 *     `member` as for any other value (step 4). By default no `text` exists, so a rule that judges
 *     exact values sees the same alternatives, and as many, as it would without step 11.
 * 12. A call to an imported function (step 7), or to a member read off one through members and
 *     such calls (`describe.each(rows)`), to a `call` that keeps the callee and the call node. Its
 *     value is not known, and step 4 reads members off it as `member`s, as off `opaque`. A member
 *     call step 6 or step 10 follows keeps that step's value instead.
 *
 * Every walk carries its active path, the bindings and nodes it is inside right now. A step back
 * onto that path is `unknown`, so a self-referencing binding stops, and a call back into a function
 * whose returns are being read is `opaque` (the call itself). Within one file an expression is
 * evaluated once: its alternatives are kept for every later read unless its walk cut a cycle, since
 * only a cut makes a result depend on the path that reached it. A parameter, a `for…of` or
 * `for…in` binding, a regular expression, a call no step follows, and anything else
 * the list does not name is `opaque`: a value that exists but is not known, whose members step 4
 * still reads as `member`s. `unknown` is what the evaluator gave up on, and every member of it is
 * `unknown` too.
 */

/** The callee names that run a callback in the page and hand back what it returns. */
const EVALUATES: ReadonlySet<string> = new Set(["evaluate", "evaluateHandle", "$eval", "$$eval"]);

/** How many alternatives one evaluation keeps before it gives up as `unknown`. */
const MAX_ALTERNATIVES = 64;

/** How many runs and gaps one `text` keeps before it gives up as `unknown` (step 11). */
const MAX_FRAGMENTS = 64;

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

/** A property an object literal alternative sets: its key and its value. */
type PropertyEntry = { readonly _tag: "property"; readonly key: string; readonly value: ESTree.Node };

/** An object or array spread the evaluator cannot open. */
type UnopenedSpread = { readonly _tag: "unopened-spread" };

/** The one unopened spread every object and array alternative shares. */
const UNOPENED_SPREAD: UnopenedSpread = { _tag: "unopened-spread" };

/** One entry of an object literal alternative, in source order. */
type Entry = PropertyEntry | UnopenedSpread;

/** One element of an array literal alternative, in source order: a node (`null` for a hole), or a spread it cannot open. */
type Element = { readonly _tag: "element"; readonly node: ESTree.Node | null } | UnopenedSpread;

/** One run of a `text`: characters the evaluator read, or a gap for a part it could not. */
export type TextPart = { readonly _tag: "known"; readonly text: string } | { readonly _tag: "gap" };

/** One value an expression may hold. */
export type Alt =
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "text"; readonly parts: ReadonlyArray<TextPart> }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "null" }
  | { readonly kind: "undefined" }
  | { readonly kind: "object"; readonly entries: ReadonlyArray<Entry> }
  | { readonly kind: "array"; readonly elements: ReadonlyArray<Element> }
  | { readonly kind: "function"; readonly fn: ESTree.Node }
  | { readonly kind: "global"; readonly name: string }
  | { readonly kind: "import"; readonly source: string; readonly imported: string }
  | { readonly kind: "member"; readonly object: Alt; readonly key: string }
  | {
      readonly kind: "call";
      readonly callee: Extract<Alt, { kind: "import" | "member" }>;
      readonly node: ESTree.CallExpression;
    }
  | { readonly kind: "opaque" }
  | { readonly kind: "unknown" };

/** One file's evaluations, shared by every rule that lints it. */
type Memo = {
  /** Each expression's alternatives, kept only when its walk cut no cycle. */
  readonly values: WeakMap<ESTree.Node, Alt[]>;
  /** How many cycle cuts the file's walks have made, so a walk can tell whether it made one. */
  cuts: number;
};

/**
 * Each file's memo, keyed by its program, one per `strings` mode: a node read with partial strings
 * holds `text`s that a default read must not see.
 */
const MEMOS = {
  exact: new WeakMap<ESTree.Node, Memo>(),
  partial: new WeakMap<ESTree.Node, Memo>(),
} as const satisfies Record<Strings, WeakMap<ESTree.Node, Memo>>;

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

/** A value the evaluator gave up on. */
const UNKNOWN: Alt = { kind: "unknown" };

/** A value that exists but that the evaluator does not know. */
const OPAQUE: Alt = { kind: "opaque" };

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
 * The one way operands combine: `operation` runs on every combination of one alternative per
 * operand, and the results are the operation's alternatives. Past `MAX_ALTERNATIVES` combinations
 * or results, the result is `unknown`.
 *
 * @param operands - Each operand's alternatives, in order.
 * @param operation - The operation on one combination.
 * @returns The operation's alternatives.
 */
function product(
  operands: ReadonlyArray<ReadonlyArray<Alt>>,
  operation: (combination: ReadonlyArray<Alt>) => ReadonlyArray<Alt>
): Alt[] {
  let combinations: Alt[][] = [[]];
  for (const operand of operands) {
    combinations = combinations.flatMap((before) => operand.map((choice) => [...before, choice]));
    if (combinations.length > MAX_ALTERNATIVES) return [UNKNOWN];
  }
  return alternatives(...combinations.map((combination) => operation(combination)));
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

/** Any identifier node: a reference, a binding, a label or a name. */
type Identifier = Extract<ESTree.Node, { readonly type: "Identifier" }>;

/**
 * The variable an identifier reads, through the scopes around it.
 *
 * @param context - The rule context.
 * @param identifier - An identifier reference.
 * @returns The variable, or `undefined` for a global.
 */
function variableOf(context: Context, identifier: Identifier): Variable | undefined {
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
function returnedValues(context: Context, fn: ESTree.Node): ESTree.Node[] {
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

/** An alternative for a primitive JavaScript value. */
function fromPrimitive(value: Primitive): Alt {
  if (value === null) return { kind: "null" };
  if (value === undefined) return { kind: "undefined" };
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a computed primitive carries no other tag than its JavaScript type
  if (typeof value === "string") return { kind: "string", value };
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a computed primitive carries no other tag than its JavaScript type
  if (typeof value === "number") return { kind: "number", value };
  return { kind: "boolean", value };
}

/** A gap in a `text`. */
const GAP: TextPart = { _tag: "gap" };

/**
 * The text one part of a string spells (step 11): a typed primitive's string conversion, a
 * `text`'s parts, and a gap for anything else.
 *
 * @param alternative - One part's alternative.
 * @returns Its parts, in order.
 */
function partsOf(alternative: Alt): ReadonlyArray<TextPart> {
  if (alternative.kind === "text") return alternative.parts;
  const [primitive] = primitiveOf(alternative);
  return primitive === undefined ? [GAP] : [{ _tag: "known", text: String(primitive.value) }];
}

/**
 * The string parts spell (steps 10 and 11): a `string` when no part is a gap. With a gap, an
 * `exact` read is `opaque`, as step 10 has it, and a `partial` read is a `text` with adjacent known
 * runs merged and adjacent gaps as one.
 *
 * @param parts - The parts, in order.
 * @param strings - How the read takes a string with a gap.
 * @returns A `string`; with a gap, `opaque` for an `exact` read, and otherwise a `text`, or
 *   `unknown` past `MAX_FRAGMENTS`.
 */
function fromParts(parts: ReadonlyArray<TextPart>, strings: Strings): Alt {
  if (parts.every((part) => part._tag === "known"))
    return fromPrimitive(parts.map((part) => part.text).join(""));
  if (strings === "exact") return OPAQUE;
  const merged: TextPart[] = [];
  for (const part of parts) {
    const last = merged.at(-1);
    if (part._tag === "known" && last?._tag === "known") {
      merged[merged.length - 1] = { _tag: "known", text: last.text + part.text };
    } else if (part._tag === "gap" ? last?._tag !== "gap" : part.text !== "") {
      merged.push(part);
    }
  }
  return merged.length > MAX_FRAGMENTS ? UNKNOWN : { kind: "text", parts: merged };
}

/** Whether an alternative is a string, known in full or in parts. */
function isText(alternative: Alt): boolean {
  return alternative.kind === "string" || alternative.kind === "text";
}

/** Whether a value is an import, or is read or called off one through members and calls (step 12). */
function importRooted(alternative: Alt): boolean {
  switch (alternative.kind) {
    case "import":
      return true;
    case "member":
      return importRooted(alternative.object);
    case "call":
      return importRooted(alternative.callee);
    default:
      return false;
  }
}

/** The values of a combination when every alternative in it is a typed primitive. */
function primitives(combination: ReadonlyArray<Alt>): Primitive[] | undefined {
  const values = combination.flatMap((alternative) => primitiveOf(alternative).map((boxed) => boxed.value));
  return values.length === combination.length ? values : undefined;
}

/**
 * The evaluator for one walk: the rule context and string mode fixed, the file's memo for that mode
 * shared, its own active path.
 */
function evaluator(context: Context, strings: Strings, memo: Memo) {
  const active = new Set<ESTree.Node | Variable>();

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

  /** An object literal's entries, one list per combination of its spreads' alternatives. */
  const objectAlternatives = (node: ESTree.ObjectExpression): Alt[] => {
    const parts: Array<ReadonlyArray<Alt>> = node.properties.map((property): ReadonlyArray<Alt> => {
      if (property.type === "SpreadElement") return evaluateNode(property.argument);
      const key = propertyKeyName(property);
      return [
        {
          kind: "object",
          entries: key === undefined ? [UNOPENED_SPREAD] : [{ _tag: "property", key, value: property.value }],
        },
      ];
    });
    return product(parts, (combination) => [
      {
        kind: "object",
        entries: combination.flatMap((part): Entry[] => {
          if (part.kind === "object") return [...part.entries];
          // Spreading `null` or `undefined` sets nothing.
          return part.kind === "null" || part.kind === "undefined" ? [] : [UNOPENED_SPREAD];
        }),
      },
    ]);
  };

  /** An array literal's elements, one list per combination of its spreads' alternatives. */
  const arrayAlternatives = (node: ESTree.ArrayExpression): Alt[] => {
    const parts: Array<ReadonlyArray<Alt>> = node.elements.map((element): ReadonlyArray<Alt> =>
      element?.type === "SpreadElement"
        ? evaluateNode(element.argument)
        : [{ kind: "array", elements: [{ _tag: "element", node: element }] }]
    );
    return product(parts, (combination) => [
      {
        kind: "array",
        elements: combination.flatMap((part) => (part.kind === "array" ? part.elements : [UNOPENED_SPREAD])),
      },
    ]);
  };

  /** What one alternative holds under a key (step 4). */
  const memberOf = (container: Alt, key: string): Alt[] => {
    switch (container.kind) {
      case "object": {
        const entry = entryFor(container, key);
        if (entry === "unknown") return [UNKNOWN];
        return entry === undefined ? [{ kind: "undefined" }] : evaluateNode(entry.value);
      }
      case "array": {
        const index = Number(key);
        if (!Number.isInteger(index)) return [{ kind: "member", object: container, key }];
        if (index < 0) return [{ kind: "undefined" }];
        const before = container.elements.slice(0, index + 1);
        if (before.some((element) => element._tag === "unopened-spread")) return [UNKNOWN];
        const element = before[index];
        return element?._tag !== "element" || element.node === null
          ? [{ kind: "undefined" }]
          : evaluateNode(element.node);
      }
      case "import":
        return container.imported === "*"
          ? [{ kind: "import", source: container.source, imported: key }]
          : [{ kind: "member", object: container, key }];
      case "unknown":
        return [UNKNOWN];
      default:
        return [{ kind: "member", object: container, key }];
    }
  };

  /** Every value a function returns, each evaluated, with the function on the active path. */
  const returnsOf = (fn: ESTree.Node): Alt[] =>
    step(fn, () => alternatives(...returnedValues(context, fn).map((value) => evaluateNode(value))));

  /** One callee alternative called with the call's arguments (steps 5, 6, 10 and 12). */
  const callOne = (call: ESTree.CallExpression, callee: Alt): Alt[] => {
    if (callee.kind === "function") {
      // Checked here, not by `step`, so a memoized value of the callee cannot turn the cut `unknown`.
      if (active.has(callee.fn)) {
        memo.cuts += 1;
        return [OPAQUE];
      }
      return returnsOf(callee.fn);
    }
    if (callee.kind === "import" && callee.imported !== "*") return [{ kind: "call", callee, node: call }];
    if (callee.kind !== "member") return [OPAQUE];
    const receiver = callee.object;
    if (EVALUATES.has(callee.key)) {
      const callbacks = product(
        call.arguments.map((argument) => evaluateNode(argument)),
        (combination) => combination.filter((argument) => argument.kind === "function")
      );
      if (callbacks.length > 0) {
        return alternatives(
          ...callbacks.map((callback) => (callback.kind === "function" ? returnsOf(callback.fn) : [UNKNOWN]))
        );
      }
      return [OPAQUE];
    }
    const map = STRING_METHODS.get(callee.key);
    if (map !== undefined && receiver.kind === "string") return [fromPrimitive(map(receiver.value))];
    if (callee.key === "concat" && isText(receiver)) {
      return product(
        call.arguments.map((argument) => evaluateNode(argument)),
        (combination) => [fromParts([...partsOf(receiver), ...combination.flatMap(partsOf)], strings)]
      );
    }
    if (callee.key === "join" && receiver.kind === "array") {
      const spread = receiver.elements.some((element) => element._tag === "unopened-spread");
      if (spread && strings === "exact") return [OPAQUE];
      const [separatorArgument] = call.arguments;
      // An element is followed by the separator exactly when an element comes later, since an
      // item then follows it whatever the spreads between hold. A spread's gap stands for its
      // items and each separator that depends on whether it is empty: the one after each item,
      // or, past the last element, the one before each.
      const lastElement = receiver.elements.findLastIndex((element) => element._tag === "element");
      return product(
        [
          separatorArgument === undefined ? [fromPrimitive(",")] : evaluateNode(separatorArgument),
          ...receiver.elements.map((element): ReadonlyArray<Alt> => {
            if (element._tag === "unopened-spread") return [OPAQUE];
            return element.node === null ? [fromPrimitive(undefined)] : evaluateNode(element.node);
          }),
        ],
        ([glue, ...items]) => {
          if (glue?.kind !== "string") return [OPAQUE];
          const separator: TextPart = { _tag: "known", text: glue.value };
          const parts = receiver.elements.flatMap((element, index): ReadonlyArray<TextPart> => {
            if (element._tag === "unopened-spread") return [GAP];
            const item = items[index];
            const text =
              item === undefined || item.kind === "null" || item.kind === "undefined" ? [] : partsOf(item);
            return index < lastElement ? [...text, separator] : text;
          });
          return [fromParts(parts, strings)];
        }
      );
    }
    return importRooted(receiver) ? [{ kind: "call", callee, node: call }] : [OPAQUE];
  };

  /** A template literal's values (step 10). */
  const templateOf = (node: ESTree.TemplateLiteral): Alt[] =>
    product(
      node.expressions.map((part) => evaluateNode(part)),
      (combination) => [
        fromParts(
          node.quasis.flatMap((quasi, index): TextPart[] => {
            const substitution = combination[index];
            return [
              { _tag: "known", text: staticText(quasi) },
              ...(substitution === undefined ? [] : partsOf(substitution)),
            ];
          }),
          strings
        ),
      ]
    );

  /** A binary operation's values (step 10). */
  const binaryOf = (node: ESTree.BinaryExpression | ESTree.PrivateInExpression): Alt[] => {
    const arithmetic = ARITHMETIC.get(node.operator);
    if (node.left.type === "PrivateIdentifier" || arithmetic === undefined) return [OPAQUE];
    return product([evaluateNode(node.left), evaluateNode(node.right)], (combination) => {
      const [left, right] = combination;
      if (left === undefined || right === undefined) return [UNKNOWN];
      // `+` converts both sides to strings exactly when a side is a string.
      if (node.operator === "+" && (isText(left) || isText(right)))
        return [fromParts([...partsOf(left), ...partsOf(right)], strings)];
      const values = primitives(combination);
      if (values === undefined) return [OPAQUE];
      const [leftValue, rightValue] = values;
      return [fromPrimitive(arithmetic(Number(leftValue), Number(rightValue)))];
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
          ? [{ kind: "import", source: declaration.source.value, imported }]
          : [UNKNOWN];
      }
      case "Parameter":
        return [OPAQUE];
      case "FunctionName":
        return [{ kind: "function", fn: def.node }];
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
      return loop?.type === "ForOfStatement" || loop?.type === "ForInStatement" ? [OPAQUE] : [UNKNOWN];
    }
    if (declarator.id.type === "Identifier") {
      const values = evaluateNode(declarator.init);
      if (!isMutated(variable)) return values;
      // A mutated literal keeps its identity, but nothing it holds is known.
      return values.map((value): Alt => {
        if (value.kind === "array") return { ...value, elements: [UNOPENED_SPREAD] };
        if (value.kind === "object") return { ...value, entries: [UNOPENED_SPREAD] };
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
      return product([evaluateNode(init)], ([container]) =>
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
      return [{ kind: "global", name: identifier.name }];
    return step(variable, () => definitionOf(variable));
  };

  /** Every value one unwrapped expression may hold, the expression already on the active path. */
  const expressionOf = (expression: ESTree.Node): Alt[] => {
    if (isFunction(expression)) return [{ kind: "function", fn: expression }];
    switch (expression.type) {
      case "Literal": {
        if ("regex" in expression) return [OPAQUE];
        const value = expression.value;
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree tags every literal kind `Literal`; the value's type is the only tag a bigint literal has
        if (typeof value === "bigint") return [OPAQUE];
        return [fromPrimitive(value)];
      }
      case "Identifier":
        return bindingOf(expression);
      case "MemberExpression": {
        const key = memberName(expression);
        if (key === undefined) return [OPAQUE];
        return product([evaluateNode(expression.object)], ([container]) =>
          container === undefined ? [UNKNOWN] : memberOf(container, key)
        );
      }
      case "CallExpression":
        return product([evaluateNode(expression.callee)], ([callee]) =>
          callee === undefined ? [UNKNOWN] : callOne(expression, callee)
        );
      case "ConditionalExpression":
        return alternatives(evaluateNode(expression.consequent), evaluateNode(expression.alternate));
      case "LogicalExpression":
        return alternatives(evaluateNode(expression.left), evaluateNode(expression.right));
      case "ImportExpression":
        return product([evaluateNode(expression.source)], ([source]) =>
          source?.kind === "string" ? [{ kind: "import", source: source.value, imported: "*" }] : [OPAQUE]
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
        if (expression.operator !== "-") return [OPAQUE];
        return product([evaluateNode(expression.argument)], ([operand]) =>
          operand?.kind === "number" ? [fromPrimitive(-operand.value)] : [OPAQUE]
        );
      default:
        return [OPAQUE];
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

/** How `evaluate` reads. */
export type EvaluateOptions = {
  /**
   * How a string with parts the evaluator cannot read comes back: `"exact"` (the default) makes it
   * `opaque`, and `"partial"` makes it a `text` of its known runs and gaps (step 11).
   */
  readonly strings: "exact" | "partial";
};

/** How a read takes a string with parts it cannot read. */
type Strings = EvaluateOptions["strings"];

/** The default read: exact strings only. */
const EXACT: EvaluateOptions = { strings: "exact" };

/**
 * Every value an expression may hold, by the steps in this module's contract.
 *
 * @param context - The rule context.
 * @param node - Any expression.
 * @param options - How to read strings; by default, exact strings only.
 * @returns The alternatives, never empty, at most 64.
 */
export function evaluate(context: Context, node: ESTree.Node, options: EvaluateOptions = EXACT): Alt[] {
  const program = context.sourceCode.ast;
  const memos = MEMOS[options.strings];
  const memo = memos.get(program) ?? { values: new WeakMap(), cuts: 0 };
  memos.set(program, memo);
  const values = evaluator(context, options.strings, memo)(node);
  return values.length === 0 ? [UNKNOWN] : [...values];
}

/**
 * The text a string alternative may hold, in order: a `string` as one known run, a `text` as its
 * runs and gaps (step 11).
 *
 * @param alternative - Any alternative.
 * @returns The parts, or `undefined` for an alternative that is no string.
 */
export function textParts(alternative: Alt): ReadonlyArray<TextPart> | undefined {
  return isText(alternative) ? partsOf(alternative) : undefined;
}

/**
 * The entry that sets a key on an object alternative: its last property with the key, after its
 * spreads; `unknown` when an unopened spread may set it; `undefined` when nothing sets it.
 *
 * @param object - An alternative.
 * @param key - The property key.
 * @returns The setting property, `"unknown"`, or `undefined`.
 */
function entryFor(object: Alt, key: string): PropertyEntry | "unknown" | undefined {
  if (object.kind !== "object") return "unknown";
  for (const entry of [...object.entries].toReversed()) {
    if (entry._tag === "unopened-spread") return "unknown";
    if (entry.key === key) return entry;
  }
  return undefined;
}

/**
 * The name one callee alternative calls by: an import's export name, a global's name, a named
 * local function's name, or the key a member reads (`React.useId` is `useId`, whatever it is read
 * off).
 *
 * @param alternative - An alternative of a callee.
 * @returns The name, or `undefined` for a namespace or default import, an anonymous function, or
 *   any alternative that names no function.
 */
export function calleeName(alternative: Alt): string | undefined {
  switch (alternative.kind) {
    case "import":
      return alternative.imported === "*" || alternative.imported === "default"
        ? undefined
        : alternative.imported;
    case "global":
      return alternative.name;
    case "function": {
      const name = functionNameOf(alternative.fn);
      return name?.type === "Identifier" ? name.name : undefined;
    }
    case "member":
      return alternative.key;
    default:
      return undefined;
  }
}
