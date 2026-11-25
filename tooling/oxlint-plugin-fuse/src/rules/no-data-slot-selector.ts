import type { Rule } from "@oxlint/plugins";

import { firstViolation } from "../quantify.ts";
import type { TextPart } from "../resolve.ts";
import { evaluate, memberName, textParts } from "../resolve.ts";
import { isTestFile } from "../source-file.ts";

/** The DOM methods that take a selector as their first argument. */
const SELECTOR_METHODS: ReadonlySet<string> = new Set([
  "querySelector",
  "querySelectorAll",
  "closest",
  "matches",
]);

/** The DOM methods that take an attribute name as their first argument. */
const ATTRIBUTE_METHODS: ReadonlySet<string> = new Set(["getAttribute", "hasAttribute"]);

/** The attribute name the rule looks for, lowercase: HTML attribute names match without case. */
const DATA_SLOT = "data-slot";

/** The first character of each two-character attribute operator (`~=`, `|=`, `^=`, `$=`, `*=`). */
const OPERATOR_PREFIXES: ReadonlySet<string> = new Set(["~", "|", "^", "$", "*"]);

/**
 * One UTF-16 code unit of a selector, or `""` for a gap: a part the evaluator could not read. The
 * characters the scan looks for are all ASCII, so code units are enough.
 */
type Unit = string;

/** Whether a unit is CSS whitespace. A gap is not. */
function isWhitespace(unit: Unit | undefined): boolean {
  return unit !== undefined && /^[ \t\n\r\f]$/u.test(unit);
}

/**
 * Whether the units from `start` name `data-slot` as an attribute: optional whitespace, the name,
 * then whitespace, `]` or an operator. A gap anywhere in that span is not a match, so
 * `` `[data-slot${suffix}=x]` `` with an unknown suffix is not one.
 *
 * @param units - The selector's units.
 * @param start - The index right after a `[`.
 * @returns Whether the attribute is `data-slot`.
 */
function namesDataSlotAt(units: ReadonlyArray<Unit>, start: number): boolean {
  let at = start;
  while (isWhitespace(units[at])) at += 1;
  if (!DATA_SLOT.split("").every((char, index) => units[at + index]?.toLowerCase() === char)) return false;
  const next = units[at + DATA_SLOT.length];
  if (next === "]" || next === "=" || isWhitespace(next)) return true;
  return next !== undefined && OPERATOR_PREFIXES.has(next) && units[at + DATA_SLOT.length + 1] === "=";
}

/**
 * Whether a selector, known in full or in parts, has an attribute selector on `data-slot` itself:
 * `[data-slot]`, `[data-slot=x]` or any operator form. Text inside a quoted attribute value and a
 * character after a CSS escape (`\[`, as in an escaped Tailwind class) open no attribute. A gap is
 * neither a quote nor a bracket.
 *
 * @param parts - The selector's text, in order.
 * @returns Whether it selects by `data-slot`.
 */
function selectsDataSlot(parts: ReadonlyArray<TextPart>): boolean {
  const units = parts.flatMap((part): Unit[] => (part._tag === "gap" ? [""] : part.text.split("")));
  let quote: Unit | undefined;
  for (let index = 0; index < units.length; index += 1) {
    const unit = units[index];
    if (unit === "\\") {
      index += 1;
    } else if (quote !== undefined) {
      if (unit === quote) quote = undefined;
    } else if (unit === '"' || unit === "'") {
      quote = unit;
    } else if (unit === "[" && namesDataSlotAt(units, index + 1)) {
      return true;
    }
  }
  return false;
}

/**
 * Component source finds no element through a `data-slot` selector and reads no behavior off an
 * element's `data-slot`. A consumer's props or `render` element can replace the `data-slot` Fuse
 * writes, so a lookup or a read through it breaks for that consumer. The rule flags
 * `querySelector`, `querySelectorAll`, `closest` and `matches` calls whose selector names
 * `[data-slot…]`, and `getAttribute` and `hasAttribute` calls whose attribute name is `data-slot`.
 * Test files may still select and read by slot, and so may styles, which call none of these
 * methods.
 *
 * The rule scans the string alternatives `evaluate` returns for the selector, read with
 * `strings: "partial"`, so it can flag a known `data-slot` attribute name when the rest of the
 * value is dynamic: `` `[data-slot="${slot}"]` `` still shows `[data-slot="`.
 *
 * Scope: a selector or attribute name that arrives as a parameter or an import is not read. An
 * attribute name is flagged when any alternative the rule resolves it to is `"data-slot"`, so
 * `open ? "data-slot" : name` is flagged although `name` is unknown.
 */
export const noDataSlotSelector: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid finding elements through a `data-slot` selector, or reading `data-slot`, in component source.",
    },
    messages: {
      dataSlot:
        "A consumer's props or `render` element can replace `data-slot`, so this lookup can miss. Prefer a ref or registration; failing that, a library-owned marker Fuse writes after the consumer's props.",
      dataSlotRead:
        "A consumer's props or `render` element can replace `data-slot`, so this read can return the consumer's value. Read a library-owned marker Fuse writes after the consumer's props.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    return {
      CallExpression(node) {
        const method = memberName(node.callee);
        const [argument] = node.arguments;
        if (method === undefined || argument === undefined) return;
        if (ATTRIBUTE_METHODS.has(method)) {
          const reads = firstViolation(evaluate(context, argument), (value) =>
            value.kind === "string" && value.value.toLowerCase() === DATA_SLOT ? "dataSlotRead" : undefined
          );
          if (reads !== undefined) context.report({ node: argument, messageId: reads });
          return;
        }
        if (!SELECTOR_METHODS.has(method)) return;
        const messageId = firstViolation(evaluate(context, argument, { strings: "partial" }), (value) => {
          const parts = textParts(value);
          return parts !== undefined && selectsDataSlot(parts) ? "dataSlot" : undefined;
        });
        if (messageId !== undefined) context.report({ node: argument, messageId });
      },
    };
  },
};
