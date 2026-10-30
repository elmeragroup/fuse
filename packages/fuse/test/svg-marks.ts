import { parseSync, Visitor } from "oxc-parser";
import type { JSXAttributeValue, JSXElementName, StringLiteral } from "oxc-parser";

/** The SVG elements that draw geometry. */
const GEOMETRY: ReadonlySet<string> = new Set([
  "rect",
  "line",
  "path",
  "polygon",
  "polyline",
  "circle",
  "ellipse",
]);

/** The SVG elements whose content paints other elements, so their geometry draws nothing itself. */
const SERVERS: ReadonlySet<string> = new Set([
  "defs",
  "pattern",
  "mask",
  "clipPath",
  "linearGradient",
  "radialGradient",
]);

/** One geometry element a module renders. */
export type SvgMark = {
  /** Its literal `data-slot`, or undefined when it writes none. */
  readonly slot: string | undefined;
  /** Whether it sits inside a paint server or a mask, which draws it nowhere on its own. */
  readonly internal: boolean;
  /** Its source offset, which names it in a failure. */
  readonly at: number;
};

function elementName(name: JSXElementName): string | undefined {
  return name.type === "JSXIdentifier" ? name.name : undefined;
}

/**
 * Whether an AST node is a string literal. ESTree gives every literal kind the one `Literal`
 * type, so the value's runtime type is the only tag a string literal carries.
 */
function isStringLiteral(node: { readonly type: string; readonly value?: unknown }): node is StringLiteral {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- ESTree tags every literal kind `Literal`; the value's type is the only tag a string literal has
  return node.type === "Literal" && typeof node.value === "string";
}

function attributeString(value: JSXAttributeValue | null): string | undefined {
  const literal = value?.type === "JSXExpressionContainer" ? value.expression : value;
  return literal !== null && isStringLiteral(literal) ? literal.value : undefined;
}

/**
 * Every SVG geometry element a module renders in JSX, with its `data-slot` and whether a paint
 * server or a mask holds it.
 *
 * @param relativePath - The module's path, which names it in a parse failure.
 * @param source - The module's source.
 * @returns The geometry elements in source order.
 * @throws Error when the module does not parse, a defect in package source.
 */
export function svgMarks(relativePath: string, source: string): SvgMark[] {
  const parsed = parseSync(relativePath, source);
  if (parsed.errors.length > 0) {
    throw new Error(
      `${relativePath} does not parse: ${parsed.errors.map((error) => error.message).join("; ")}`
    );
  }
  const servers: (readonly [number, number])[] = [];
  const found: { readonly slot: string | undefined; readonly at: number }[] = [];
  new Visitor({
    JSXElement: (element) => {
      const name = elementName(element.openingElement.name);
      if (name !== undefined && SERVERS.has(name)) servers.push([element.start, element.end]);
    },
    JSXOpeningElement: (opening) => {
      const name = elementName(opening.name);
      if (name === undefined || !GEOMETRY.has(name)) return;
      const slot = opening.attributes.flatMap((attribute) =>
        attribute.type === "JSXAttribute" &&
        attribute.name.type === "JSXIdentifier" &&
        attribute.name.name === "data-slot"
          ? [attributeString(attribute.value)]
          : []
      )[0];
      found.push({ slot, at: opening.start });
    },
  }).visit(parsed.program);
  return found.map(({ slot, at }) => ({
    slot,
    at,
    internal: servers.some(([start, end]) => at > start && at < end),
  }));
}
