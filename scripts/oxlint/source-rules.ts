import { Schema } from "effect";

import { codeOf, importedName, isOneOf, reportSpan, resolve, spellingBan, staticText } from "./rule-kit.ts";
import type { AnyNode, Context, Namespace, NodeOf, Rule, Variable } from "./rule-kit.ts";

/** Package source never names the local `.ref/` snapshots, which never ship. */
export const noRefSnapshotPath: Rule = spellingBan(
  "Keep .ref/ out of package source.",
  /\.ref\//u,
  "Package source does not name .ref/: those snapshots are local reference material, kept out of source, declarations and the packed artifact.",
  "comments-included"
);

/** The user-agent parser and `@elmeragroup/lib` are a retired public surface. */
export const noRetiredUserAgentApi: Rule = spellingBan(
  "Keep the retired user-agent API and @elmeragroup/lib out of package source.",
  /\buserAgent\b|\bUserAgentParserResult\b|@elmeragroup\/lib/u,
  "userAgent, UserAgentParserResult and @elmeragroup/lib are a retired public surface; do not bring them back.",
  "comments-included"
);

/** The question "is this ReactNode text?" has one owner. */
export const noObjectStringTag: Rule = spellingBan(
  "Ask whether a ReactNode is text through internal/is-text-node.ts.",
  /\[object String\]/u,
  'Ask whether a ReactNode is text through internal/is-text-node.ts; an Object.prototype.toString "[object String]" tag only evades the anti-slop typeof rule.',
  "code-only"
);

const OVERLAY_CLASSES = "/packages/fuse/src/components/overlay/overlay-classes.ts";

/** The overlay and toast stacking layers, which the owner spells exactly once each. */
const LAYERS: readonly string[] = ["z-50", "z-60"];

/** Class spellings the shared overlay module owns; a private copy would undo the shared ownership. */
const OVERLAY_SPELLINGS: readonly string[] = [
  ...LAYERS,
  "origin-(--transform-origin)",
  "text-xl font-medium",
  "bg-popover text-popover-foreground",
  "bg-dialog text-dialog-foreground",
  "shadow-md ring-1 ring-foreground/10",
  "pointer-events-none absolute right-2 flex items-center justify-center",
  "-mx-1 my-1 h-px bg-border",
];

function offsetsOf(code: string, needle: string): number[] {
  const offsets: number[] = [];
  for (let at = code.indexOf(needle); at !== -1; at = code.indexOf(needle, at + needle.length)) {
    offsets.push(at);
  }
  return offsets;
}

/**
 * components/overlay/overlay-classes.ts owns the overlay layers and the popup motion, fill,
 * surface and modal title classes: it spells each layer once, and no other module spells any of them.
 */
export const overlayClassesOwner: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Spell the overlay layers and popup classes only in overlay-classes.ts." },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const code = codeOf(context);
        if (isOneOf(context, [OVERLAY_CLASSES])) {
          for (const layer of LAYERS) {
            const count = offsetsOf(code, layer).length;
            if (count !== 1) {
              context.report({
                node,
                message: `overlay-classes.ts spells ${layer} exactly once, in its exported layer constant; it spells it ${String(count)} times.`,
              });
            }
          }
          return;
        }
        for (const spelling of OVERLAY_SPELLINGS) {
          for (const at of offsetsOf(code, spelling)) {
            reportSpan(
              context,
              at,
              at + spelling.length,
              `Import the class from components/overlay/overlay-classes.ts instead of spelling "${spelling}"; that module owns it.`
            );
          }
        }
      },
    };
  },
};

const SEARCHABLE_MENU = "/packages/fuse/src/components/data-table-filter/searchable-menu.ts";

/** The parts the searchable menu wraps, which it must keep reading under these names. */
const WRAPPED_MEMBERS: readonly string[] = ["FilterProvider", "Input", "List", "Empty"];

/**
 * Base UI's preview filtering parts on the `Menu` namespace: the ones the searchable menu wraps,
 * and two it leaves alone, which no other module reads either.
 */
const PREVIEW_MENU_MEMBERS: ReadonlySet<string> = new Set([...WRAPPED_MEMBERS, "Clear", "useFilter"]);

/** The entries that export Base UI's `Menu`: its own subpath and the root package. */
const MENU_SOURCES: ReadonlySet<string> = new Set(["@base-ui/react/menu", "@base-ui/react"]);

const PREVIEW_MESSAGE =
  "Read Menu's preview filtering parts only in components/data-table-filter/searchable-menu.ts, so a Base UI rename on their way out of preview is one edit.";

const WRAPPED_DRIFT = (member: string): string =>
  `searchable-menu.ts no longer reads Menu.${member}, a preview part scripts/oxlint/source-rules.ts says it wraps; update WRAPPED_MEMBERS with the rename, or fuse/base-ui-preview-menu misses the new name elsewhere.`;

/** The declaration that imports a binding, or undefined when the binding is no import. */
function importOf(variable: Variable | undefined): NodeOf<"ImportDeclaration"> | undefined {
  const definition = variable?.defs.find(({ type }) => type === "ImportBinding");
  return definition?.parent?.type === "ImportDeclaration" ? definition.parent : undefined;
}

/** Whether a binding is Base UI's `Menu`, imported by name, under any alias, from either entry. */
function isBaseMenu(variable: Variable | undefined): boolean {
  const declaration = importOf(variable);
  return (
    variable !== undefined &&
    declaration !== undefined &&
    MENU_SOURCES.has(declaration.source.value) &&
    importedName(variable) === "Menu"
  );
}

/** Whether a binding is a namespace import of Base UI's root package, whose `Menu` member is Menu. */
function isBaseNamespace(variable: Variable | undefined): boolean {
  const definition = variable?.defs.find(({ type }) => type === "ImportBinding");
  return (
    definition?.node.type === "ImportNamespaceSpecifier" &&
    definition.parent?.type === "ImportDeclaration" &&
    definition.parent.source.value === "@base-ui/react"
  );
}

/**
 * Where a dotted read takes its first name from: a binding in the file, resolved in a meaning, or
 * the module an import type names, as `import("@base-ui/react").Menu.Input` does.
 */
type PathRoot =
  | { readonly kind: "binding"; readonly node: AnyNode; readonly name: string; readonly namespace: Namespace }
  | { readonly kind: "module"; readonly source: string };

/** A dotted read such as `Base.Menu.Input`: where it starts, and the names after its first. */
type MemberPath = { readonly root: PathRoot; readonly members: readonly string[] };

type DottedNode =
  | NodeOf<"MemberExpression">
  | NodeOf<"JSXMemberExpression">
  | NodeOf<"TSQualifiedName">
  | NodeOf<"TSIndexedAccessType">;

/**
 * The meaning TypeScript resolves the first name of a dotted read in, by the position that encloses
 * the whole read (`resolveEntityName` in TypeScript's checker resolves the left of a qualified name
 * with the namespace meaning; `checkQualifiedName` and expressions resolve it as a value):
 *
 * | Position                                              | First name resolves as |
 * | ----------------------------------------------------- | ---------------------- |
 * | Expression, call, decorator, `extends` of a class     | value                  |
 * | JSX tag                                               | value                  |
 * | `typeof A.B` query, `(typeof A)["B"]`                 | value                  |
 * | Type reference `A.B`, also in a type predicate        | namespace              |
 * | `implements A.B`, interface `extends A.B`             | namespace              |
 * | `import X = A.B`                                      | namespace              |
 * | `export = A.B`                                        | namespace              |
 * | `import("m").A.B` qualifier                           | the module `m`         |
 *
 * A binding holds the value meaning when it declares a value; a `namespace` declares one only
 * once instantiated (TypeScript's `getModuleInstanceState`): it holds a value, a plain enum, an
 * exported `import =` or an instantiated nested namespace, declared or not, and a const enum alone
 * counts too. A namespace of types only, or an empty one, holds the namespace meaning but no value,
 * so a value read looks past it; merged declarations hold a value when any one does. A bare name is
 * never a path here, so the type meaning of `A` alone does not arise.
 */
function rootOf(context: Context, top: AnyNode, root: AnyNode, name: string): PathRoot | undefined {
  const use: AnyNode | null = top.parent;
  const binding = (namespace: Namespace): PathRoot => ({ kind: "binding", node: root, name, namespace });
  if (top.type === "TSQualifiedName") {
    if (use?.type === "TSImportType" && use.qualifier === top) {
      const source = staticText(context, use.source);
      return source === undefined ? undefined : { kind: "module", source };
    }
    return binding(use?.type === "TSTypeQuery" && use.exprName === top ? "value" : "namespace");
  }
  if (top.type === "MemberExpression") {
    const named =
      ((use?.type === "TSClassImplements" || use?.type === "TSInterfaceHeritage") &&
        use.expression === top) ||
      (use?.type === "TSExportAssignment" && use.expression === top);
    return binding(named ? "namespace" : "value");
  }
  return binding("value");
}

/** The name a member read spells: a plain property, or a computed one the file fixes as a string. */
function memberName(context: Context, node: NodeOf<"MemberExpression">): string | undefined {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : undefined;
  return staticText(context, node.property);
}

/**
 * The one member path a value read, a JSX tag, a type name or an indexed access of a `typeof` query
 * spells, with where its first name comes from, or undefined when it starts from anything else.
 */
function memberPath(context: Context, node: DottedNode): MemberPath | undefined {
  const members: string[] = [];
  let at: AnyNode = node;
  if (at.type === "TSIndexedAccessType") {
    // `(typeof Menu)["Input"]` reads Input off the value a query names.
    const index =
      at.indexType.type === "TSLiteralType" ? staticText(context, at.indexType.literal) : undefined;
    if (index === undefined || at.objectType.type !== "TSTypeQuery") return undefined;
    members.push(index);
    at = at.objectType.exprName;
  }
  for (;;) {
    if (at.type === "MemberExpression") {
      const member = memberName(context, at);
      if (member === undefined) return undefined;
      members.unshift(member);
      at = at.object;
    } else if (at.type === "JSXMemberExpression") {
      members.unshift(at.property.name);
      at = at.object;
    } else if (at.type === "TSQualifiedName") {
      members.unshift(at.right.name);
      at = at.left;
    } else {
      break;
    }
  }
  if (at.type !== "Identifier" && at.type !== "JSXIdentifier") return undefined;
  // The read's own position decides its meaning; an indexed access reads through its query.
  let top: AnyNode = node.type === "TSIndexedAccessType" ? node.objectType : at;
  if (node.type !== "TSIndexedAccessType") {
    for (let parent: AnyNode | null = top.parent; parent !== null; parent = top.parent) {
      const continues =
        (parent.type === "MemberExpression" && parent.object === top) ||
        (parent.type === "TSQualifiedName" && parent.left === top) ||
        (parent.type === "JSXMemberExpression" && parent.object === top);
      if (!continues) break;
      top = parent;
    }
  }
  const root =
    node.type === "TSIndexedAccessType"
      ? ({ kind: "binding", node: at, name: at.name, namespace: "value" } as const)
      : rootOf(context, top, at, at.name);
  if (root === undefined) return undefined;
  // An import type's first name is the module's export, so it belongs to the path.
  return root.kind === "module" ? { root, members: [at.name, ...members] } : { root, members };
}

/**
 * One module reads the preview members of Base UI's `Menu`, through any alias of `Menu` from either
 * entry, `Menu` on a namespace import of the root, or `Menu` on an import type of either entry. A
 * value read, a JSX tag, a type name, an indexed access of a query and an import type spell one
 * member path, resolved in the meaning TypeScript gives its position (see `rootOf`), so a local
 * that shadows the import is not Base UI's `Menu`, and a binding with no such meaning does not hide
 * it. The searchable menu itself must keep reading the parts it wraps.
 */
export const basePreviewMenu: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Read Base UI Menu's preview parts only in searchable-menu.ts." },
    schema: [],
  },
  create(context) {
    const owner = isOneOf(context, [SEARCHABLE_MENU]);
    const read = new Set<string>();
    /** How many names of a path lead to Base UI's Menu: 0 for Menu itself, 1 for `Base.Menu`, or -1. */
    const menuDepth = (path: MemberPath): number => {
      const { root } = path;
      if (root.kind === "module") return MENU_SOURCES.has(root.source) && path.members[0] === "Menu" ? 1 : -1;
      const variable = resolve(context, root.node, root.name, root.namespace)?.variable;
      if (isBaseMenu(variable)) return 0;
      return isBaseNamespace(variable) && path.members[0] === "Menu" ? 1 : -1;
    };
    /** The preview member a dotted read ends on, read off Base UI's Menu, or undefined. */
    const previewMember = (node: DottedNode): string | undefined => {
      const path = memberPath(context, node);
      if (path === undefined) return undefined;
      const depth = menuDepth(path);
      const member = path.members[depth];
      // Each prefix of a longer read visits on its own, so only the read that ends on the member counts.
      return depth !== -1 &&
        path.members.length === depth + 1 &&
        member !== undefined &&
        PREVIEW_MENU_MEMBERS.has(member)
        ? member
        : undefined;
    };
    const check = (node: DottedNode): void => {
      const member = previewMember(node);
      if (member === undefined) return;
      if (owner) read.add(member);
      else context.report({ node, message: PREVIEW_MESSAGE });
    };
    return {
      MemberExpression: check,
      JSXMemberExpression: check,
      TSQualifiedName: check,
      TSIndexedAccessType: check,
      "Program:exit"(node) {
        if (!owner) return;
        for (const member of WRAPPED_MEMBERS) {
          if (!read.has(member)) context.report({ node, message: WRAPPED_DRIFT(member) });
        }
      },
    };
  },
};

/** The modules the package-source rules key on, which the plugin checks the tree still holds. */
export const SOURCE_OWNERS: readonly string[] = [
  OVERLAY_CLASSES,
  SEARCHABLE_MENU,
  "/packages/fuse/src/internal/is-text-node.ts",
];

/** The attributes that carry state or wiring, which a Base UI part owns. */
const STATE_OR_WIRING_ATTRIBUTE = /^(?:disabled|readOnly|required|id|value|aria-.+)$/u;

const WIRING_MESSAGE =
  "Put state and wiring (disabled, readOnly, required, id, value, aria-*, spreads) on the Base UI part, not on its render element: the render element's props win the merge over the part's own props and Root or Field state.";

function attributeName(name: NodeOf<"JSXAttribute">["name"]): string {
  return name.type === "JSXIdentifier" ? name.name : `${name.namespace.name}:${name.name.name}`;
}

type RenderValue = Extract<
  NodeOf<"JSXAttribute">["value"],
  { readonly type: "JSXExpressionContainer" }
>["expression"];

/** The inline elements a `render` value can render: the element itself, or each branch that picks one. */
function renderElements(expression: RenderValue): NodeOf<"JSXElement">[] {
  if (expression.type === "JSXElement") return [expression];
  if (expression.type === "ConditionalExpression") {
    return [...renderElements(expression.consequent), ...renderElements(expression.alternate)];
  }
  if (expression.type === "LogicalExpression") return renderElements(expression.right);
  return [];
}

/**
 * An inline `render={<Element … />}` element carries presentation only, in each branch of a
 * conditional that picks one. A reviewed exception, such
 * as the `aria-label` an icon-sized Button requires, carries a disable comment with its reason.
 */
export const renderElementWiring: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Keep state and wiring off inline render elements." },
    schema: [],
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier" || node.name.name !== "render") return;
        if (node.value?.type !== "JSXExpressionContainer") return;
        for (const element of renderElements(node.value.expression)) {
          for (const item of element.openingElement.attributes) {
            if (
              item.type === "JSXSpreadAttribute" ||
              STATE_OR_WIRING_ATTRIBUTE.test(attributeName(item.name))
            ) {
              context.report({ node: item, message: WIRING_MESSAGE });
            }
          }
        }
      },
    };
  },
};

/** What `fuse/required-import` asks of a module, parsed from its configured option. */
type RequiredImport = {
  /** The import specifiers that count, as a pattern. */
  readonly source: RegExp;
  /** The names the module must import from it, at least one of them. */
  readonly names: ReadonlySet<string>;
  /** Whether a type-only import counts, or only a value import does. */
  readonly kind: "value" | "any";
  /** What to do instead, shown with the report. */
  readonly message: string;
};

/** The rule's option, as `.oxlintrc.json` writes it. */
const RequiredImportOption = Schema.Struct({
  source: Schema.String,
  names: Schema.NonEmptyArray(Schema.String),
  kind: Schema.Literals(["value", "any"]),
  message: Schema.String,
});

/**
 * A module the configuration names imports a reviewed owner's export: a value import where it calls
 * the export, or any import where a type suffices. A comment naming the owner is no import, and
 * neither is a type-only import where a value is required.
 */
export const requiredImport: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require a reviewed module to import its owner's export." },
    schema: [{ type: "object" }],
  },
  create(context) {
    // A malformed option is a configuration defect that would leave the rule checking nothing, so
    // the parse throws and lint stops with Schema's message.
    const option = Schema.decodeUnknownSync(RequiredImportOption)(context.options[0]);
    const required: RequiredImport = {
      ...option,
      source: new RegExp(option.source, "u"),
      names: new Set(option.names),
    };
    let imported = false;
    return {
      ImportDeclaration(node) {
        if (!required.source.test(node.source.value)) return;
        if (required.kind === "value" && node.importKind === "type") return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          if (required.kind === "value" && specifier.importKind === "type") continue;
          const name =
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : String(specifier.imported.value);
          if (required.names.has(name)) imported = true;
        }
      },
      "Program:exit"(node) {
        if (!imported) context.report({ node, message: required.message });
      },
    };
  },
};
