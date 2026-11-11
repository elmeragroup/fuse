import type { ESTree, Rule, Scope, SourceCode, Variable } from "@oxlint/plugins";

import { moduleExportName, nameChain, propertyKeyName } from "../ast-names.ts";
import { constantString } from "../static-text.ts";

/** The attribute that controls whether a part's popup shows. */
type StateAttribute = "open" | "isOpen" | "pageSizeOpen" | "value";

/** The value each state attribute takes while the popup is closed. */
const CLOSED = {
  open: false,
  isOpen: false,
  pageSizeOpen: false,
  value: null,
} as const satisfies Record<StateAttribute, false | null>;

/**
 * A literal attribute that makes a part render no popup at all, so it is no overlay. Only a value
 * the part's source proves popup-free counts.
 */
type PopupFree = { readonly attribute: string; readonly value: string };

/** An overlay part: how its open state is held, and a literal attribute that removes its popup. */
type OverlayPart = {
  /** The controlling attribute, or `internal` for a part that keeps its open state inside. */
  readonly state: StateAttribute | "internal";
  readonly popupFree?: PopupFree;
};

/**
 * Every Fuse part that renders a popup, by the path it is exported under (`Sheet.Root`,
 * `SelectField`), and how it is controlled. A modal popup (Dialog, AlertDialog, Sheet, Menu,
 * Select, a React Aria picker's popover, a ListDetail below its breakpoint) keeps the page's scroll
 * locked and the shown side hidden from assistive technology; a non-modal one (Popover, Combobox,
 * Autocomplete, a date picker's popup, a nav panel) stays on screen over the side that replaced it.
 * A ListDetail shows its detail as a Sheet over the list below its breakpoint and as a pane beside
 * it above; `ListDetail.Detail` needs no row, because its Sheet reads the Root's `open`.
 *
 * `internal` parts keep their popup's state inside: `SelectField`, `PhoneNumberField` and
 * `DataTable.RowActions` take no open state, `Sidebar.Root` holds its phone Sheet's in the
 * provider, and `DataTableFilter` and `PopoverInfoButton` own theirs. `Sidebar.Root` with
 * `collapsible="none"` renders a plain panel (`sidebar.tsx` returns a `div` for it), the only
 * popup-free form a literal proves. Base UI's `inline` on a Combobox or Autocomplete Root is not
 * one: a `Content` inside it still renders a popup, so an inline Root is checked like any other.
 *
 * The inventory was taken from every Fuse module that renders a Base UI or Fuse popup root. Parts
 * left out render none (ConfirmButton arms in place, Pagination is a list of links) or show only
 * while pointed at: a tooltip closes when the press that flips the window moves hover and focus
 * off its trigger, and a toast sits in the Dashboard's own viewport and dismisses itself.
 *
 * `Command.Root` and `NavigationMenu.Root` always count. Whether a Command opens a dialog depends on
 * a `Command.Content` anywhere below it, possibly in another module, and whether a nav menu shows a
 * panel depends on its items' content; neither is decidable from the Root. A Root that renders no
 * popup is a reviewed exception: disable the rule there and say why.
 */
const FUSE_OVERLAYS: ReadonlyMap<string, OverlayPart> = new Map(
  Object.entries<OverlayPart>({
    "AlertDialog.Root": { state: "open" },
    "Autocomplete.Root": { state: "open" },
    AutocompleteField: { state: "open" },
    "Combobox.Root": { state: "open" },
    ComboboxField: { state: "open" },
    "Command.Root": { state: "open" },
    "DataTable.ColumnToggle": { state: "open" },
    "DataTable.Pagination": { state: "pageSizeOpen" },
    "DataTable.RowActions": { state: "internal" },
    "DataTableFilter.Root": { state: "internal" },
    "DatePicker.Root": { state: "open" },
    DatePickerField: { state: "isOpen" },
    "DateRangePicker.Root": { state: "open" },
    DateRangePickerField: { state: "isOpen" },
    "Dialog.Root": { state: "open" },
    "DropdownMenu.Root": { state: "open" },
    "ListDetail.Root": { state: "open" },
    "NavigationMenu.Root": { state: "value" },
    PhoneNumberField: { state: "internal" },
    "Popover.Root": { state: "open" },
    PopoverInfoButton: { state: "internal" },
    "Select.Root": { state: "open" },
    SelectField: { state: "internal" },
    "Sheet.Root": { state: "open" },
    "Sidebar.Root": { state: "internal", popupFree: { attribute: "collapsible", value: "none" } },
  })
);

/** The React Aria entries' overlay parts, which take React Aria's `isOpen`. */
const REACT_ARIA_OVERLAYS: ReadonlyMap<string, OverlayPart> = new Map(
  Object.entries<OverlayPart>({
    DatePicker: { state: "isOpen" },
    DateRangePicker: { state: "isOpen" },
  })
);

/**
 * The DataTable parts a `createFuseTableHook` table renders as `table.ColumnToggle` and
 * `table.Pagination`. Any dotted tag on a local root ending in one of these names counts as that
 * part: the table is a local value the rule cannot trace to the hook.
 */
const REGISTERED: ReadonlyMap<string, string> = new Map([
  ["ColumnToggle", "DataTable.ColumnToggle"],
  ["Pagination", "DataTable.Pagination"],
]);

/** The module that owns the hook, as an import source ends with it. */
const HOOK_MODULE = "/window-side";

/** The hook whose state closes an overlay when its side hides. */
const HOOK = "useSideOverlay";

/**
 * The factory that builds `DataTable.RowActions` cells, whose menu keeps its open state inside. It
 * is a function, never a tag, so any use of it counts.
 */
const ROW_ACTIONS_FACTORY = "actionsColumn";

/**
 * A prop name that forwards an overlay's open state: `open`, `isOpen`, `sheetOpen`. Every value of
 * that name passed to a local component must carry side state too, so a chain of props starts at
 * the hook. `defaultOpen` seeds an uncontrolled overlay, and `setOpen` or `onOpen` passes a setter
 * or handler, so none of them is forwarded state. Forwarded state is boolean: closed is `false`.
 */
const FORWARDED_STATE = /^(?:open|isOpen|(?!(?:default|set|on)[A-Z])[a-z][A-Za-z]*Open)$/u;

/** The operators whose result is always a boolean, so `state && a < b` stays boolean. */
const BOOLEAN_OPERATOR = /^(?:[=!]==?|[<>]=?|in|instanceof)$/u;

/** The variable a name reads, found from the innermost scope outward. */
function resolve(scope: Scope, name: string): Variable | undefined {
  for (let current: Scope | null = scope; current !== null; current = current.upper) {
    const variable = current.set.get(name);
    if (variable !== undefined) return variable;
  }
  return undefined;
}

/**
 * The value import a variable is bound by: its module source, and the export it names, or
 * `namespace` for `import * as`. A default import, a type-only import and any other binding give
 * `undefined`.
 */
type ImportOf = {
  readonly source: string;
  readonly imported: ESTree.ImportSpecifier["imported"] | "namespace";
};

/** The value import a variable is bound by, or `undefined` for any other binding. */
function importOf(variable: Variable | undefined): ImportOf | undefined {
  const definition = variable?.defs[0];
  const declaration = definition?.parent;
  if (definition?.type !== "ImportBinding" || declaration?.type !== "ImportDeclaration") return undefined;
  if (declaration.importKind === "type") return undefined;
  const source = declaration.source.value;
  const specifier = definition.node;
  if (specifier.type === "ImportNamespaceSpecifier") return { source, imported: "namespace" };
  if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") return undefined;
  return { source, imported: specifier.imported };
}

/** A Fuse import a name resolves to: the export path it names, and its entry family. */
type FuseImport = { readonly path: readonly string[]; readonly reactAria: boolean };

/**
 * The Fuse import a variable is bound by: `["Sheet"]` for `import { Sheet as S }`, `[]` for a
 * namespace import, or `undefined` for any other binding, a shadowing local included.
 */
function fuseImport(variable: Variable | undefined): FuseImport | undefined {
  const binding = importOf(variable);
  if (binding === undefined || !isFuseSource(binding.source)) return undefined;
  const reactAria = binding.source.startsWith("@elmeragroup/fuse/react-aria/");
  const imported = binding.imported;
  if (imported === "namespace") return { path: [], reactAria };
  return { path: [moduleExportName(imported)], reactAria };
}

/** Whether an export path names an overlay part or a namespace holding one. */
function reachesOverlay(path: readonly string[], reactAria: boolean): boolean {
  const prefix = path.join(".");
  return [...(reactAria ? REACT_ARIA_OVERLAYS : FUSE_OVERLAYS).keys()].some(
    (key) => prefix === "" || key === prefix || key.startsWith(`${prefix}.`)
  );
}

/**
 * What a JSX name renders: a Fuse overlay part, `local` for a local component, or `undefined` for a
 * tag or another Fuse export. Only a bare lowercase name is a tag; any other name resolves through
 * the binding its root reads in scope.
 */
function rendered(segments: readonly string[], scope: Scope): OverlayPart | "local" | undefined {
  const [head, ...members] = segments;
  if (head === undefined || (members.length === 0 && /^[a-z]/u.test(head))) return undefined;
  const imported = fuseImport(resolve(scope, head));
  if (imported !== undefined) {
    const table = imported.reactAria ? REACT_ARIA_OVERLAYS : FUSE_OVERLAYS;
    return table.get([...imported.path, ...members].join("."));
  }
  const registered = REGISTERED.get(members.at(-1) ?? "");
  return registered === undefined ? "local" : FUSE_OVERLAYS.get(registered);
}

/**
 * Whether a variable is `useSideOverlay`, imported by its identifier name from the window-side
 * module.
 */
function isSideOverlayHook(variable: Variable | undefined): boolean {
  const binding = importOf(variable);
  return (
    binding !== undefined &&
    binding.imported !== "namespace" &&
    binding.imported.type === "Identifier" &&
    binding.imported.name === HOOK &&
    binding.source.endsWith(HOOK_MODULE)
  );
}

/** Whether a node is the literal a state attribute takes while closed: `false` or `null`. */
function isClosedLiteral(node: ESTree.Node | null | undefined, closed: false | null): boolean {
  return node?.type === "Literal" && node.raw === String(closed);
}

/** A prop a component destructures from its first parameter: its key and its default, if any. */
type DestructuredProp = { readonly key: string; readonly fallback: ESTree.Node | undefined };

/** The object a function destructures from its first parameter, and how the function is bound. */
type ComponentProps = {
  /** The first parameter's object pattern, past any default. */
  readonly pattern: ESTree.ObjectPattern;
  /** Whether the function is bound under a capitalized name, as a component is. */
  readonly capitalized: boolean;
  /** Whether the first parameter has a default of its own, as in `({ open } = {}) => …`. */
  readonly defaulted: boolean;
};

/**
 * The props a function destructures from its first parameter, as in `function Sheet({ open })` or
 * `const Panel = ({ sheetOpen } = {}) => …`, or `undefined` for a node that is no function or
 * whose first parameter destructures no object.
 */
function componentProps(fn: ESTree.Node | null | undefined): ComponentProps | undefined {
  if (
    fn?.type !== "FunctionDeclaration" &&
    fn?.type !== "FunctionExpression" &&
    fn?.type !== "ArrowFunctionExpression"
  ) {
    return undefined;
  }
  const [first] = fn.params;
  const defaulted = first?.type === "AssignmentPattern";
  const pattern = defaulted ? first.left : first;
  if (pattern?.type !== "ObjectPattern") return undefined;
  const binding = fn.type === "FunctionDeclaration" ? fn.id : fn.parent;
  const name =
    binding?.type === "Identifier"
      ? binding.name
      : binding?.type === "VariableDeclarator" && binding.id.type === "Identifier"
        ? binding.id.name
        : undefined;
  return { pattern, capitalized: name !== undefined && /^[A-Z]/u.test(name), defaulted };
}

/**
 * The prop a parameter binding destructures from a component's first parameter, as in
 * `function Sheet({ open = false })` or `({ sheetOpen: shown = false }) => …`, or `undefined` for
 * any other binding. A props object with a default of its own is not read.
 */
function destructuredProp(identifier: ESTree.Node, fn: ESTree.Node): DestructuredProp | undefined {
  const props = componentProps(fn);
  if (props === undefined || !props.capitalized || props.defaulted) return undefined;
  const assignment = identifier.parent?.type === "AssignmentPattern" ? identifier.parent : undefined;
  const property = (assignment ?? identifier).parent;
  if (property?.type !== "Property" || property.parent !== props.pattern) return undefined;
  const key = propertyKeyName(property);
  return key === undefined ? undefined : { key, fallback: assignment?.right };
}

/** Why a value is not side state, as a message and its data. */
type Problem = { readonly messageId: string; readonly data?: Record<string, string> };

/** The rule's catch-all: the value is none of the shapes it accepts. */
const UNTRACED: Problem = { messageId: "untraced" };

/**
 * Why an identifier is not side state that reads `closed` while its side hides, or `undefined`
 * when it is. Two shapes count, each never written after its declaration: the first binding of
 * `useSideOverlay(closed)`, and a boolean prop a component destructures with the default `false`.
 * NavigationMenu's `value` takes only the hook's state: a forwarded prop is boolean.
 */
function identifierProblem(
  expression: ESTree.Node,
  closed: false | null,
  sourceCode: SourceCode
): Problem | undefined {
  if (expression.type !== "Identifier") return UNTRACED;
  const scope = sourceCode.getScope(expression);
  const variable = resolve(scope, expression.name);
  const definition = variable?.defs[0];
  if (variable === undefined || definition === undefined) return UNTRACED;
  if (variable.references.some((reference) => reference.isWrite() && !reference.init)) {
    return { messageId: "reassigned" };
  }
  if (definition.type === "Parameter") {
    const prop = destructuredProp(definition.name, definition.node);
    if (closed !== false || prop === undefined || !FORWARDED_STATE.test(prop.key)) return UNTRACED;
    return isClosedLiteral(prop.fallback, false)
      ? undefined
      : { messageId: "openDefault", data: { prop: prop.key } };
  }
  const declarator = definition.node;
  if (definition.type !== "Variable" || declarator.type !== "VariableDeclarator") return UNTRACED;
  const init = declarator.init;
  if (
    declarator.id.type !== "ArrayPattern" ||
    declarator.id.elements[0] !== definition.name ||
    init?.type !== "CallExpression" ||
    init.callee.type !== "Identifier" ||
    !isSideOverlayHook(resolve(scope, init.callee.name))
  ) {
    return UNTRACED;
  }
  return isClosedLiteral(init.arguments[0], closed)
    ? undefined
    : { messageId: "closedValue", data: { closed: closed === null ? "null" : "false" } };
}

/** Whether an expression is always a boolean: a comparison, a negation or a boolean literal. */
function isBooleanExpression(node: ESTree.Node): boolean {
  if (node.type === "BinaryExpression") return BOOLEAN_OPERATOR.test(node.operator);
  if (node.type === "UnaryExpression") return node.operator === "!";
  return node.type === "Literal" && (node.value === true || node.value === false);
}

/**
 * Why a state value is not side state, or `undefined` when it is: a side-state identifier, or, for
 * a boolean attribute, `state && <boolean>`, which is `false` whenever the state is and a boolean
 * otherwise, so it can only be more closed.
 */
function stateProblem(value: ESTree.Node, closed: false | null, sourceCode: SourceCode): Problem | undefined {
  if (
    closed === false &&
    value.type === "LogicalExpression" &&
    value.operator === "&&" &&
    isBooleanExpression(value.right)
  ) {
    return identifierProblem(value.left, closed, sourceCode);
  }
  return identifierProblem(value, closed, sourceCode);
}

/**
 * Whether a spread onto a local component can carry no open state: an object literal, or a `const`
 * bound to one that the module only ever spreads, with plain keys, none of them forwarded state.
 */
function isStatelessSpread(argument: ESTree.Node, sourceCode: SourceCode): boolean {
  let object = argument;
  if (argument.type === "Identifier") {
    const variable = resolve(sourceCode.getScope(argument), argument.name);
    const definition = variable?.defs[0];
    const declaration = definition?.parent;
    if (
      definition?.type !== "Variable" ||
      declaration?.type !== "VariableDeclaration" ||
      declaration.kind !== "const" ||
      definition.node.type !== "VariableDeclarator" ||
      definition.node.init === null ||
      variable?.references.every(
        (reference) => reference.init || reference.identifier.parent.type === "JSXSpreadAttribute"
      ) !== true
    ) {
      return false;
    }
    object = definition.node.init;
  }
  if (object.type !== "ObjectExpression") return false;
  return object.properties.every((property) => {
    if (property.type === "SpreadElement") return false;
    const key = propertyKeyName(property);
    return key !== undefined && !FORWARDED_STATE.test(key);
  });
}

/** A JSX attribute's name: `open`, or `xlink:href` for a namespaced one. */
function attributeName(attribute: ESTree.JSXAttribute): string {
  const name = attribute.name;
  return name.type === "JSXNamespacedName" ? `${name.namespace.name}:${name.name.name}` : name.name;
}

/** An attribute's value as the rule reads it: its expression, or the attribute for a bare or literal one. */
function attributeValue(attribute: ESTree.JSXAttribute): ESTree.Node {
  const value = attribute.value;
  return value?.type === "JSXExpressionContainer" && value.expression.type !== "JSXEmptyExpression"
    ? value.expression
    : attribute;
}

/** Whether a name is a reference rather than a key, a member name, an import binding or a type. */
function isValueReference(identifier: ESTree.Node): boolean {
  const parent = identifier.parent;
  if (parent === null) return false;
  switch (parent.type) {
    case "ImportSpecifier":
    case "ImportNamespaceSpecifier":
    case "TSQualifiedName":
    case "TSTypeQuery":
      return false;
    case "MemberExpression":
      return parent.object === identifier;
    case "Property":
      return parent.value === identifier;
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "VariableDeclarator":
      return parent.id !== identifier;
    case "ExportSpecifier":
      return parent.local === identifier;
    default:
      return true;
  }
}

/** Whether a module source is Fuse's package root or one of its subpaths. */
function isFuseSource(source: string): boolean {
  return source === "@elmeragroup/fuse" || source.startsWith("@elmeragroup/fuse/");
}

/**
 * Whether a variable is a component of this module that destructures a forwarded open-state prop
 * from its first parameter, so the rule trusts that prop only because it checks every JSX caller.
 */
function forwardsState(variable: Variable | undefined): boolean {
  const definition = variable?.defs[0];
  const node = definition?.node;
  const fn =
    node?.type === "VariableDeclarator" ? node.init : definition?.type === "FunctionName" ? node : undefined;
  return (
    componentProps(fn)?.pattern.properties.some((property) => {
      const key = property.type === "Property" ? propertyKeyName(property) : undefined;
      return key !== undefined && FORWARDED_STATE.test(key);
    }) === true
  );
}

/**
 * Every overlay on a side of the landing's hero window takes its open state from `useSideOverlay`,
 * so it closes in the render that hides its side (see `landing/window-side.tsx`). The rule accepts
 * a few plainly safe shapes and reports everything else; a reviewed exception is an
 * `oxlint-disable` with its reason.
 *
 * - An overlay part is controlled through its state attribute (`open`, NavigationMenu's `value`,
 *   React Aria's `isOpen`, `DataTable.Pagination`'s `pageSizeOpen`), with no spread after it.
 * - That attribute reads, by name, state never reassigned: the first binding of
 *   `useSideOverlay(false)` (`null` for a nav value), or, for a boolean attribute, a prop named
 *   `open`, `isOpen` or `…Open` that the component destructures with the default `false`. A boolean
 *   attribute may also read `state && <comparison, negation or boolean literal>`.
 * - Every such prop passed to a local component is held to the same rule, and a spread onto a local
 *   component must be a plain object without one, so a chain of props starts at the hook.
 * - An overlay part is rendered only as a JSX tag: an alias (`const Modal = Sheet.Root`) or any
 *   other use of an overlay export or a Fuse namespace outside a tag hides the part from the rule,
 *   and so does reading or destructuring a registered `ColumnToggle` or `Pagination` off any value.
 * - Fuse is imported statically and not re-exported: a dynamic `import()` of it, or of a specifier
 *   that is not a string literal, loads parts the rule cannot name, and a re-export hands them to
 *   modules that see a local component.
 * - A component that destructures a forwarded open-state prop is rendered only as a JSX tag, where
 *   its callers are checked; `createElement(Panel, props)` or `memo(Panel)` would bypass them.
 * - A part that keeps its open state inside, such as `Sidebar.Root`'s phone Sheet, is always
 *   reported, unless a literal attribute proves it renders no popup.
 *
 * Parts count from the package root or any subpath, under any alias or namespace, through the
 * binding each name resolves to in scope, and as a table's registered `table.ColumnToggle` and
 * `table.Pagination`.
 */
export const sideOverlayState: Rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require hero-window overlays to take their open state from useSideOverlay.",
    },
    messages: {
      uncontrolled:
        "Control {{part}} with `{{attribute}}` from `useSideOverlay`, so it closes when its side of the hero window hides.",
      untraced:
        "Pass {{part}}'s `{{attribute}}` the state from `useSideOverlay` by name, or a prop named `open` or `…Open` destructured with the default `false`, so it closes when its side of the hero window hides.",
      closedValue:
        "Create {{part}}'s `{{attribute}}` state with `useSideOverlay({{closed}})`: the hook returns that value while the side is hidden, so it must be the closed one.",
      openDefault:
        "Declare the `{{prop}}` prop optional with the default `false`, so a caller that omits it leaves {{part}} closed.",
      reassigned:
        "{{part}}'s `{{attribute}}` reads a binding written after its declaration, which may no longer be the side's state. Keep it as declared.",
      spread:
        "This spread may set {{part}}'s `{{attribute}}` to state that does not close with the side. Pass the state as an attribute after any spread, spread a plain object without it, or disable this rule with why the spread is safe.",
      alias:
        "Render `{{name}}` as a JSX tag: used anywhere else it hides an overlay part, or the open state it forwards, from this rule.",
      dynamicImport:
        "Import Fuse statically here: a part loaded through `import()` cannot be checked for its open state. If it opens no popup, or closes when the side hides, disable this rule with why.",
      reexport:
        "Import Fuse where its parts are rendered: a module that renders a re-exported part sees a local component, not the overlay. If nothing re-exported opens a popup, disable this rule with why.",
      factory:
        "`{{name}}` builds cells with a row actions menu that keeps its open state inside, where `useSideOverlay` cannot close it. Close it when the side hides and disable this rule with how.",
      internal:
        "{{part}} keeps its open state inside, where `useSideOverlay` cannot close it. Close it when the side hides and disable this rule with how.",
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const report = (node: ESTree.Node, messageId: string, data: Record<string, string> = {}): void => {
      context.report({ node, messageId, data });
    };
    return {
      // A re-export hands Fuse's parts to modules that see them as local components.
      ExportNamedDeclaration(declaration) {
        if (declaration.source !== null && isFuseSource(declaration.source.value)) {
          report(declaration, "reexport");
        }
      },
      ExportAllDeclaration(declaration) {
        if (isFuseSource(declaration.source.value)) report(declaration, "reexport");
      },
      ImportExpression(expression) {
        const source = constantString(expression.source);
        if (source === undefined || isFuseSource(source)) {
          report(expression, "dynamicImport");
        }
      },
      // A registered part read off a local table, `table.ColumnToggle` outside a tag.
      MemberExpression(member) {
        const name = propertyKeyName({ key: member.property, computed: member.computed });
        if (name === undefined || !REGISTERED.has(name)) return;
        // A read rooted at a Fuse import is the Identifier visitor's to judge.
        const root = nameChain(member.object)?.[0];
        if (root === undefined || fuseImport(resolve(sourceCode.getScope(member), root)) === undefined) {
          report(member, "alias", { name });
        }
      },
      // A registered part destructured off a local table, `const { ColumnToggle } = table`.
      Property(property) {
        const name = propertyKeyName(property);
        if (property.parent.type === "ObjectPattern" && name !== undefined && REGISTERED.has(name)) {
          report(property, "alias", { name });
        }
      },
      // Scope resolution sees an import below its use and a local that shadows one.
      Identifier(identifier) {
        if (!isValueReference(identifier)) return;
        const variable = resolve(sourceCode.getScope(identifier), identifier.name);
        // A forwarding component is trusted because its JSX callers are checked; any other use,
        // `createElement(Panel, props)` or `memo(Panel)`, passes props the rule cannot see.
        if (forwardsState(variable)) {
          report(identifier, "alias", { name: identifier.name });
          return;
        }
        const imported = fuseImport(variable);
        if (imported === undefined) return;
        const parent = identifier.parent;
        // `DataTable.Text` reads a part without a popup; `DataTable.ColumnToggle` would alias one.
        const member =
          parent.type === "MemberExpression" && !parent.computed && parent.property.type === "Identifier"
            ? [parent.property.name]
            : [];
        const path = [...imported.path, ...member];
        if (path.join(".") === ROW_ACTIONS_FACTORY) {
          report(identifier, "factory", { name: identifier.name });
        } else if (reachesOverlay(path, imported.reactAria)) {
          report(identifier, "alias", { name: identifier.name });
        }
      },
      JSXOpeningElement(element) {
        const segments = nameChain(element.name);
        const part = segments.join(".");
        const target = rendered(segments, sourceCode.getScope(element));
        if (target === undefined) return;
        const judge = (attribute: string, value: ESTree.Node, closed: false | null): void => {
          const problem = stateProblem(value, closed, sourceCode);
          if (problem !== undefined) {
            report(value, problem.messageId, { part, attribute, ...problem.data });
          }
        };
        if (target === "local") {
          for (const attribute of element.attributes) {
            if (attribute.type === "JSXSpreadAttribute") {
              if (!isStatelessSpread(attribute.argument, sourceCode)) {
                report(attribute, "spread", { part, attribute: "open" });
              }
              continue;
            }
            const name = attributeName(attribute);
            if (FORWARDED_STATE.test(name)) judge(name, attributeValue(attribute), false);
          }
          return;
        }
        const attributes = element.attributes;
        // The last attribute of a name, which wins over any before it, and its position.
        const lastAttribute = (name: string) => {
          const index = attributes.findLastIndex(
            (attribute) => attribute.type === "JSXAttribute" && attributeName(attribute) === name
          );
          const attribute = attributes[index];
          return { index, attribute: attribute?.type === "JSXAttribute" ? attribute : undefined };
        };
        const lastSpread = attributes.findLastIndex((attribute) => attribute.type === "JSXSpreadAttribute");
        const popupFree = target.popupFree;
        if (popupFree !== undefined) {
          const { index, attribute } = lastAttribute(popupFree.attribute);
          const value = attribute?.value;
          if (index > lastSpread && value?.type === "Literal" && value.value === popupFree.value) return;
        }
        if (target.state === "internal") {
          report(element, "internal", { part });
          return;
        }
        const name = target.state;
        const { index, attribute } = lastAttribute(name);
        const spread = attributes[lastSpread];
        if (spread !== undefined && lastSpread > index) {
          report(spread, "spread", { part, attribute: name });
        } else if (attribute === undefined) {
          report(element, "uncontrolled", { part, attribute: name });
        } else {
          judge(name, attributeValue(attribute), CLOSED[name]);
        }
      },
    };
  },
};
