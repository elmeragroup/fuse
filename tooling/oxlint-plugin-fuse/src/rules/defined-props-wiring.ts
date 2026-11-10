import type { ESTree, Rule } from "@oxlint/plugins";

import { isTestFile } from "../source-file.ts";

/**
 * The Base UI parts that read Field or Labelable context, plus Button (`aria-disabled`) and the
 * Dialog and Drawer popups (dialog ARIA), by the name the package exports and the member rendered.
 * `self` is the export rendered as an element itself, such as `<InputPrimitive>`.
 */
const WIRING_PARTS = new Map(
  Object.entries({
    Autocomplete: ["Trigger", "Clear", "Input"],
    Button: ["self"],
    Checkbox: ["Root"],
    CheckboxGroup: ["self"],
    Combobox: ["Trigger", "Clear", "Input"],
    Dialog: ["Popup"],
    Drawer: ["Popup"],
    Field: ["Label", "Control", "Description", "Error", "Item"],
    Fieldset: ["Root", "Legend"],
    Input: ["self"],
    NumberField: ["Root", "Input", "Decrement", "Increment"],
    Radio: ["Root"],
    RadioGroup: ["self"],
    Slider: ["Root", "Thumb"],
    Switch: ["Root"],
  })
);

/** Whether a spread filters the consumer's props through `definedProps(…)`. */
function isDefinedProps(expression: ESTree.Expression): boolean {
  if (expression.type !== "CallExpression" || expression.callee.type !== "Identifier") return false;
  if (expression.callee.name === "definedProps") return true;
  // `mergeProps(defaults, definedProps(props))`: the part's own handlers merge first, so the
  // consumer's run first and can cancel them, and the consumer's props are still filtered.
  const last = expression.arguments.at(-1);
  return (
    expression.callee.name === "mergeProps" &&
    last !== undefined &&
    last.type !== "SpreadElement" &&
    isDefinedProps(last)
  );
}

/**
 * A module that renders a Base UI part reading Field or Labelable context, Button or a dialog
 * popup spreads consumer props onto it only through `definedProps(…)`. Base UI's `mergeProps`
 * copies a present `undefined` over the part's own value, so a forwarded
 * `aria-labelledby={undefined}` erased Field's label (#62). The module that renders the part
 * filters; the wrappers above it spread raw.
 */
export const definedPropsWiring: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require definedProps on spreads onto Base UI wiring parts." },
    messages: {
      raw: "Spread `definedProps(…)` onto {{part}}: a raw spread lets an `undefined` prop erase the part's own Field, label or ARIA wiring.",
    },
    schema: [],
  },
  create(context) {
    if (isTestFile(context.filename)) return {};
    /** Local name of each imported Base UI export, mapped to its wiring members. */
    const parts = new Map<string, readonly string[]>();
    return {
      ImportDeclaration(declaration) {
        if (declaration.importKind === "type" || !declaration.source.value.startsWith("@base-ui/react"))
          return;
        for (const specifier of declaration.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          const imported =
            specifier.imported.type === "Literal" ? specifier.imported.value : specifier.imported.name;
          const members = WIRING_PARTS.get(imported);
          if (members !== undefined) parts.set(specifier.local.name, members);
        }
      },
      JSXOpeningElement(element) {
        const name = element.name;
        let local: string;
        let member: string;
        if (name.type === "JSXIdentifier") {
          local = name.name;
          member = "self";
        } else if (name.type === "JSXMemberExpression" && name.object.type === "JSXIdentifier") {
          local = name.object.name;
          member = name.property.name;
        } else {
          return;
        }
        if (parts.get(local)?.includes(member) !== true) return;
        const part = member === "self" ? local : `${local}.${member}`;
        for (const attribute of element.attributes) {
          if (attribute.type === "JSXSpreadAttribute" && !isDefinedProps(attribute.argument)) {
            context.report({ node: attribute, messageId: "raw", data: { part } });
          }
        }
      },
    };
  },
};
