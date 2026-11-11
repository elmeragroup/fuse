import type { Rule } from "@oxlint/plugins";

/**
 * A server-visible module carries no `"use client"` directive. The config scopes this rule to the
 * namespace indexes and the chart namespaces, parts modules and pure `format/` and `layout/`
 * folders, and to the server half of the selection rows: with the directive, `Dialog.Root`
 * becomes an opaque client reference a server component cannot dot into, a pure module stops
 * being callable from the server, and a server-written `SelectionItem.SubSection` lands inside
 * the label (see `partitionSubSections`).
 */
export const noUseClient: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Forbid the `use client` directive in server-visible namespace and pure modules." },
    messages: {
      directive:
        "This module is server-visible: a server component reads its parts. Move the client code into the implementation module and keep this file directive-free.",
    },
    schema: [],
  },
  create(context) {
    return {
      Program(program) {
        for (const statement of program.body) {
          if ("directive" in statement && statement.directive === "use client") {
            context.report({ node: statement, messageId: "directive" });
          }
        }
      },
    };
  },
};
