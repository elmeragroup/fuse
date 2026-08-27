/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- optional origin facts preserve the backend contract. */

import type { CallExpression, Node } from "typescript/unstable/ast";
import { isElementAccessExpression, isStringLiteral } from "typescript/unstable/ast/is";

import type { BackendNodeFacts } from "../contracts.ts";
import type { TsgoFactsSession } from "./facts.ts";
import { moduleOriginResolutionOfExpression, moduleOriginResolutionOfSymbol } from "./module-origin.ts";
import { symbolFacts } from "./symbol-facts.ts";

/**
 * Normalizes the generic relation exposed by a call expression. The parser
 * decides which callees have meaningful wrapper semantics; this adapter only
 * reports the syntax node and the checker symbol behind it.
 */
export function callExpressionFacts(
  session: TsgoFactsSession,
  node: CallExpression
): Pick<BackendNodeFacts, "arguments" | "callee" | "calleeFacts"> {
  const calleeSymbol = calleeSymbolAt(session, node.expression);
  const result = {
    arguments: node.arguments.map((argument) => session.nodeHandle(argument)),
    callee: session.nodeHandle(node.expression),
  };
  if (calleeSymbol === undefined) return result;
  const facts = symbolFacts(session, calleeSymbol);
  // Expression syntax can recover a namespace root that the property symbol
  // no longer carries. Only a genuinely missing expression relation may fall
  // back to the symbol relation; an ambiguous expression must stay ambiguous
  // instead of being erased by a convenient optional-origin fallback.
  const expressionOrigin = moduleOriginResolutionOfExpression(session, node.expression);
  const moduleOrigin =
    expressionOrigin.status === "resolved"
      ? expressionOrigin.origin
      : expressionOrigin.status === "missing"
        ? (() => {
            const symbolOrigin = moduleOriginResolutionOfSymbol(
              session,
              session.symbol(calleeSymbol, "callExpressionFacts")
            );
            return symbolOrigin.status === "resolved" ? symbolOrigin.origin : undefined;
          })()
        : undefined;
  return {
    ...result,
    calleeFacts: {
      symbol: calleeSymbol,
      ...(moduleOrigin === undefined ? {} : { moduleOrigin }),
      ...(facts.identity === undefined ? {} : { identity: facts.identity }),
    },
  };
}

/**
 * The checker does not attach a symbol to an element-access expression even
 * when its key is a literal (`React["memo"]`). Resolve only that static form
 * through the receiver's type; an identifier, template, or other computed
 * key remains unresolved so wrapper policy cannot turn dynamic dispatch into
 * a React fact.
 */
function calleeSymbolAt(session: TsgoFactsSession, expression: Node) {
  const direct = session.symbolAt(expression);
  if (direct !== undefined) return direct;
  if (!isElementAccessExpression(expression) || !isStringLiteral(expression.argumentExpression)) {
    return undefined;
  }
  const receiverType = session.checker.getTypeAtLocation(expression.expression);
  if (receiverType === undefined) return undefined;
  const symbol = session.checker.getPropertyOfType(receiverType, expression.argumentExpression.text);
  return symbol === undefined ? undefined : session.symbolHandle(symbol);
}
