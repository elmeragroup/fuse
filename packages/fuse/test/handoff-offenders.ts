/**
 * The AST reader behind the central suite's handoff contract: it finds, per source file,
 * the spreads and attributes that bypass or undercut the `internal/part-handoff` seam. The
 * contract, its assertions and its reasons stay in `src/source-contracts.test.ts`; this module
 * only reads, and reports a parse error as an offender rather than failing on it.
 */
import { Visitor, parseSync } from "oxc-parser";
import type {
  CallExpression,
  Expression,
  JSXAttributeName,
  JSXElementName,
  JSXMemberExpressionObject,
  PropertyKey,
} from "oxc-parser";

/** A source file to read: its path relative to `src`, and its text. */
type HandoffSource = { readonly relative: string; readonly source: string };

/** A JSX tag as written, `Primitive.Part` for a member tag. */
function jsxTagName(name: JSXElementName | JSXMemberExpressionObject): string {
  switch (name.type) {
    case "JSXIdentifier":
      return name.name;
    case "JSXMemberExpression":
      return `${jsxTagName(name.object)}.${name.property.name}`;
    case "JSXNamespacedName":
      return `${name.namespace.name}:${name.name.name}`;
  }
}

function lineOf(record: HandoffSource, offset: number): number {
  return record.source.slice(0, offset).split("\n").length;
}

/** A JSX attribute or object key, as its source name. */
function propertyName(key: JSXAttributeName | PropertyKey): string | undefined {
  switch (key.type) {
    case "Identifier":
    case "JSXIdentifier":
      return key.name;
    case "Literal":
      return String(key.value);
    default:
      return undefined;
  }
}

function unparenthesized(expression: Expression): Expression {
  return expression.type === "ParenthesizedExpression" ? unparenthesized(expression.expression) : expression;
}

function isUndefinedIdentifier(node: { readonly type: string }): boolean {
  return node.type === "Identifier" && "name" in node && node.name === "undefined";
}

/** A source range the visitor entered, with what it means for nodes inside it. */
type Scope<T> = { readonly start: number; readonly end: number; readonly value: T };

function enclosing<T>(scopes: readonly Scope<T>[], node: { readonly start: number }): Scope<T> | undefined {
  return scopes.find((scope) => scope.start <= node.start && node.start < scope.end);
}

/** Offenders against the handoff seam in one file. */
export type HandoffOffenders = {
  /** `file: message` for a parse error, since an unparsed file would report no other offender. */
  readonly parseErrors: readonly string[];
  /** `file:line <Tag>` for a spread on a Base UI part that is not a `handoff(…)` result. */
  readonly rawSpreads: readonly string[];
  /** `file:line <Tag>` for a spread inside a JSX element given as a Base UI part's `render`. */
  readonly renderElementSpreads: readonly string[];
  /** `file <Tag> name` for a JSX attribute after the parameter spread in a `handoff` `as` target. */
  readonly afterTargetSpread: readonly string[];
  /** `file:line` for an `aria-labelledby` set to `undefined`, as a JSX attribute or an object key. */
  readonly undefinedLabelledBy: readonly string[];
  /**
   * `file:line <unrecognized …>` for a `handoff` spec, a spread in one, or an `as` in one
   * that the after-target check cannot read, so an unread spec fails instead of passing unchecked.
   */
  readonly unreadableSpecs: readonly string[];
};

/**
 * Find the spreads and attributes in one source file that bypass or undercut the
 * `internal/part-handoff` seam.
 *
 * @param record - The file's path relative to `src`, and its source.
 * @returns The offenders of each kind, each list empty for a clean file.
 */
export function handoffOffenders(record: HandoffSource): HandoffOffenders {
  const parsed = parseSync(record.relative, record.source);
  const parseErrors = parsed.errors.map((error) => `${record.relative}: ${error.message}`);
  const imports = parsed.module.staticImports;
  const baseUiBindings = new Set(
    imports
      .filter((entry) => entry.moduleRequest.value.startsWith("@base-ui/react"))
      .flatMap((entry) => entry.entries.filter((binding) => !binding.isType))
      .map((binding) => binding.localName.value)
  );
  // The callee must be the `internal/part-handoff` import, so a local `handoff` is no pass.
  const handoffBindings = new Set(
    imports
      .filter((entry) => entry.moduleRequest.value.endsWith("internal/part-handoff"))
      .flatMap((entry) => entry.entries)
      .filter((binding) => binding.importName.kind === "Name" && binding.importName.name === "handoff")
      .map((binding) => binding.localName.value)
  );
  function isHandoffCall(expression: Expression): expression is CallExpression {
    return (
      expression.type === "CallExpression" &&
      expression.callee.type === "Identifier" &&
      handoffBindings.has(expression.callee.name)
    );
  }
  // The visitor enters a node before its children, so a scope is recorded before the JSX
  // inside it is visited.
  const renderElements: Scope<string>[] = [];
  const asTargets: Scope<string>[] = [];
  const rawSpreads: string[] = [];
  const renderElementSpreads: string[] = [];
  const afterTargetSpread: string[] = [];
  const undefinedLabelledBy: string[] = [];
  const unreadableSpecs: string[] = [];
  new Visitor({
    CallExpression(node) {
      const spec = node.arguments[1];
      if (!isHandoffCall(node) || spec === undefined) {
        return;
      }
      if (spec.type !== "ObjectExpression") {
        unreadableSpecs.push(`${record.relative}:${lineOf(record, spec.start)} <unrecognized handoff spec>`);
        return;
      }
      for (const property of spec.properties) {
        if (property.type === "SpreadElement") {
          unreadableSpecs.push(
            `${record.relative}:${lineOf(record, property.start)} <unrecognized spec spread>`
          );
          continue;
        }
        if (propertyName(property.key) !== "as") {
          continue;
        }
        const target = property.value;
        const parameter = target.type === "ArrowFunctionExpression" ? target.params[0] : undefined;
        if (parameter?.type === "Identifier") {
          asTargets.push({ start: target.start, end: target.end, value: parameter.name });
        } else {
          unreadableSpecs.push(
            `${record.relative}:${lineOf(record, property.start)} <unrecognized as target>`
          );
        }
      }
    },
    Property(node) {
      if (propertyName(node.key) === "aria-labelledby" && isUndefinedIdentifier(node.value)) {
        undefinedLabelledBy.push(`${record.relative}:${lineOf(record, node.start)}`);
      }
    },
    JSXOpeningElement(node) {
      const tag = jsxTagName(node.name);
      const isBaseUiPart = baseUiBindings.has(tag.split(".")[0] ?? tag);
      const renderElement = enclosing(renderElements, node);
      const target = enclosing(asTargets, node);
      let afterParameterSpread = false;
      for (const attribute of node.attributes) {
        if (attribute.type === "JSXSpreadAttribute") {
          const at = `${record.relative}:${lineOf(record, attribute.start)}`;
          if (isBaseUiPart && !isHandoffCall(attribute.argument)) {
            rawSpreads.push(`${at} <${tag}>`);
          }
          if (renderElement !== undefined) {
            renderElementSpreads.push(`${at} <${renderElement.value}>`);
          }
          if (
            target !== undefined &&
            attribute.argument.type === "Identifier" &&
            attribute.argument.name === target.value
          ) {
            afterParameterSpread = true;
          } else if (afterParameterSpread) {
            afterTargetSpread.push(`${record.relative} <${tag}> {...}`);
          }
          continue;
        }
        const name = propertyName(attribute.name);
        if (afterParameterSpread) {
          afterTargetSpread.push(`${record.relative} <${tag}> ${name ?? "?"}`);
        }
        if (attribute.value?.type !== "JSXExpressionContainer") {
          continue;
        }
        if (name === "aria-labelledby" && isUndefinedIdentifier(attribute.value.expression)) {
          undefinedLabelledBy.push(`${record.relative}:${lineOf(record, attribute.start)}`);
        }
        if (isBaseUiPart && name === "render" && attribute.value.expression.type !== "JSXEmptyExpression") {
          const element = unparenthesized(attribute.value.expression);
          if (element.type === "JSXElement") {
            renderElements.push({ start: element.start, end: element.end, value: tag });
          }
        }
      }
    },
  }).visit(parsed.program);
  return {
    parseErrors,
    rawSpreads,
    renderElementSpreads,
    afterTargetSpread,
    undefinedLabelledBy,
    unreadableSpecs,
  };
}
