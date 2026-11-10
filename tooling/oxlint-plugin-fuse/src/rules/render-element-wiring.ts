import type { Rule } from "@oxlint/plugins";

import { jsxName } from "../jsx-name.ts";
import { isTestFile } from "../source-file.ts";

/** Attributes that carry state or wiring a part owns. */
const STATE_OR_WIRING = /^(?:disabled|readOnly|required|id|value|aria-.+)$/u;

/**
 * An inline `render={<Element …/>}` element carries no state or wiring attribute (`disabled`,
 * `readOnly`, `required`, `id`, `value`, `aria-*`) and no spread. A render element's props beat the
 * part's own props and Root or Field state, so a `disabled={false}` there re-enabled a disabled
 * Combobox.Root (#49). State and wiring go on the part; the render element takes presentation.
 */
export const renderElementWiring: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Keep state and wiring off inline render elements." },
    messages: {
      attribute:
        "Put `{{attribute}}` on {{part}}, not on its render element: the render element's props override the part's own state and wiring.",
      spread:
        "Spread props onto {{part}}, not its render element: the render element's props override the part's own state and wiring.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    return {
      JSXAttribute(attribute) {
        if (attribute.name.type !== "JSXIdentifier" || attribute.name.name !== "render") return;
        const value = attribute.value;
        if (value?.type !== "JSXExpressionContainer" || value.expression.type !== "JSXElement") return;
        const owner = attribute.parent;
        const part = owner.type === "JSXOpeningElement" ? jsxName(owner.name) : "the part";
        for (const item of value.expression.openingElement.attributes) {
          if (item.type === "JSXSpreadAttribute") {
            context.report({ node: item, messageId: "spread", data: { part } });
            continue;
          }
          const name = jsxName(item.name);
          if (STATE_OR_WIRING.test(name)) {
            context.report({ node: item, messageId: "attribute", data: { part, attribute: name } });
          }
        }
      },
    };
  },
};
