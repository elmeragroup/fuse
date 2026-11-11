import type { Rule } from "@oxlint/plugins";

/**
 * A chart part sets its `displayName` through `Object.assign(Part, { displayName })`, never
 * `Part.displayName = …`. The assignment makes TypeScript emit an untagged `declare namespace
 * Part` beside each `@beta` part in the `.d.ts`, which the chart entry's API report rejects as a
 * missing and a different release tag; `Object.assign` sets the same runtime name and emits none.
 */
export const noDisplayNameAssignment: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require Object.assign for a chart part's displayName." },
    messages: {
      assignment:
        "Set displayName through `Object.assign(Part, { displayName: … })`: the assignment emits an untagged namespace the API report rejects.",
    },
    schema: [],
  },
  create(context) {
    return {
      AssignmentExpression(node) {
        const target = node.left;
        if (
          target.type === "MemberExpression" &&
          !target.computed &&
          target.property.type === "Identifier" &&
          target.property.name === "displayName"
        ) {
          context.report({ node, messageId: "assignment" });
        }
      },
    };
  },
};
