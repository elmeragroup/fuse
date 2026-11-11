import type { ESTree, Rule } from "@oxlint/plugins";

import { nameChain } from "../ast-names.ts";

/**
 * Every interactive chart demo that mounts a chart family's `Root` also mounts that family's
 * `Table`, the data table alternative Chartability heuristic 30 asks for (CONTRACT.md section
 * 9.11). The config scopes this rule to the demo folders of the chart pages whose family layer has
 * landed.
 *
 * Scope: follows nothing from `resolve.ts`; it reads the JSX tags spelled in the demo file. Beyond
 * that: a family namespace imported under another name, or a Root or Table rendered by a helper
 * component in another file, is not seen.
 */
export const chartDemoTable: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require a chart demo that mounts a chart Root to mount its Table." },
    messages: {
      missing:
        "This demo mounts `{{family}}.Root` without `{{family}}.Table`. Mount the family's Table so the chart has its data table alternative.",
    },
    schema: [],
  },
  create(context) {
    const roots = new Map<string, ESTree.Node>();
    const tables = new Set<string>();
    return {
      JSXOpeningElement(node) {
        const [family, part, ...rest] = nameChain(node.name);
        // A chart family's namespace: `Chart`, `BarChart`, `PieChart` and the rest.
        if (family?.endsWith("Chart") !== true || rest.length > 0) return;
        if (part === "Root" && !roots.has(family)) roots.set(family, node);
        if (part === "Table") tables.add(family);
      },
      "Program:exit"() {
        for (const [family, node] of roots) {
          if (!tables.has(family)) context.report({ node, messageId: "missing", data: { family } });
        }
      },
    };
  },
};
