/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- optional type names preserve model JSON. */

import { canonicalizeUnionMembers, unionType } from "../canonical/canonicalize.ts";
import type { FunctionNode, PropertyNode, SemanticType, TypeName } from "../model.ts";

// The names React uses for what a component renders, matched exactly like
// upstream's componentParser: detection goes by name rather than by node kind,
// because the same return type surfaces as an external reference when external
// types are summarized and as an object or union when `includeExternalTypes`
// expands them. Exact matching keeps a local `ListElement` or the DOM's
// `HTMLElement` from turning every function returning one into a component.
const componentReturnTypeNames = new Set(["Element", "ReactElement", "ReactNode"]);

/**
 * What the component transform decided about one export root.
 *
 * `transformed` reshaped a recognized component; `notAComponent` left the
 * export alone because nothing about it looked component-like beyond its
 * capitalized name (an ordinary function returning a non-React type is a
 * certain negative, not an uncertainty); `uncertain` records a capitalized
 * export whose union holds SOME component-like arms but not only those — the
 * semantic kind is deliberately unchanged and the resolver reports a
 * structured warning instead of silently guessing.
 */
export type ComponentRecognition =
  | { readonly outcome: "transformed" }
  | { readonly outcome: "notAComponent" }
  | { readonly outcome: "uncertain"; readonly reason: "mixed-component-union" };

export type ComponentTransformResult = {
  readonly type: SemanticType;
  readonly recognition: ComponentRecognition;
};

/**
 * Rewrites an export root into a component node when it looks like a React
 * component, squashing the props parameter of every call signature into one
 * merged prop list. Mirrors upstream's `transformComponentExport`.
 *
 * `authoredProps` carries the props objects resolved from the export's own
 * declaration syntax (one entry per overload declaration). When none could be
 * read, the transform falls back to each resolved call signature's first
 * parameter, which is what upstream reads exclusively.
 */
export function componentNode(
  type: SemanticType,
  exportName: string,
  authoredProps: readonly SemanticType[]
): ComponentTransformResult {
  if (!isComponentExportName(exportName)) return passThrough(type, "notAComponent");
  const functions = collectComponentFunctions(type);
  if (functions === undefined) {
    return isPartialComponentUnion(type)
      ? { type, recognition: { outcome: "uncertain", reason: "mixed-component-union" } }
      : passThrough(type, "notAComponent");
  }
  const callSignatures = functions.flatMap((fn) => fn.callSignatures);
  const sources =
    authoredProps.length > 0
      ? authoredProps
      : callSignatures.flatMap((signature) => {
          const parameter = signature.parameters[0];
          return parameter === undefined ? [] : [parameter.type];
        });
  const props: PropertyNode[] = [];
  const usedBySource: Set<string>[] = [];
  for (const source of sources) {
    for (const object of collectPropsEntries(source)) {
      const used = new Set<string>();
      for (const property of object) {
        used.add(property.name);
        const current = props.find((candidate) => candidate.name === property.name);
        if (current === undefined) props.push(property);
        else {
          // Equivalent contributions collapse inside the union constructor, so a
          // prop declared identically by several variants keeps its own type.
          const index = props.indexOf(current);
          props[index] = {
            ...current,
            type: unionType(undefined, canonicalizeUnionMembers([current.type, property.type])),
            optional: current.optional || property.optional,
          };
        }
      }
      usedBySource.push(used);
    }
  }
  // A signature that takes no props at all uses none of the props gathered
  // above, so each such signature contributes an empty set: without it the
  // remaining signatures' props would stay required even though one form of
  // the component rejects them.
  for (const signature of callSignatures) {
    if (signature.parameters.length === 0) usedBySource.push(new Set());
  }
  const typeName = componentTypeName(type, functions);
  return {
    type: {
      kind: "component",
      props: props.map((property) =>
        usedBySource.some((used) => !used.has(property.name))
          ? { ...property, type: addUndefined(property.type), optional: true }
          : property
      ),
      ...(typeName === undefined ? {} : { typeName }),
    },
    recognition: { outcome: "transformed" },
  };
}

function passThrough(type: SemanticType, outcome: "notAComponent"): ComponentTransformResult {
  return { type, recognition: { outcome } };
}

/** Upstream's `isComponentExportName`: capitalized, or the default export. */
function isComponentExportName(name: string): boolean {
  return /^[A-Z]/u.test(name) || name === "default";
}

/**
 * Upstream's `collectComponentFunctions`: the function nodes holding a
 * component's call signatures, or undefined when the export is not a
 * component. A union counts only when EVERY arm is itself component-like, so a
 * union that merely happens to contain a component (`Button | undefined`)
 * keeps its union shape.
 */
function collectComponentFunctions(type: SemanticType): FunctionNode[] | undefined {
  if (type.kind === "function") return hasReactNodeLikeReturnType(type) ? [type] : undefined;
  if (type.kind === "union") {
    const functions: FunctionNode[] = [];
    for (const member of type.types) {
      const memberFunctions = collectComponentFunctions(member);
      if (memberFunctions === undefined) return undefined;
      functions.push(...memberFunctions);
    }
    return functions.length > 0 ? functions : undefined;
  }
  return undefined;
}

/** Whether a mixed union hides some — but not all — component-like arms. */
function isPartialComponentUnion(type: SemanticType): boolean {
  if (type.kind !== "union") return false;
  const componentArms = type.types.filter((member) => collectComponentFunctions(member) !== undefined);
  return componentArms.length > 0 && componentArms.length < type.types.length;
}

function hasReactNodeLikeReturnType(fn: FunctionNode): boolean {
  return fn.callSignatures.some((signature) => isReactReturnType(signature.returnValueType));
}

function isReactReturnType(type: SemanticType): boolean {
  const typeName = "typeName" in type ? type.typeName : undefined;
  if (typeName !== undefined && componentReturnTypeNames.has(typeName.name)) return true;
  // Return types like `JSX.Element | null` describe a component through one of
  // their members.
  return type.kind === "union" && type.types.some(isReactReturnType);
}

/**
 * Upstream's `getComponentTypeName`: an aliased union names the component
 * directly; an unaliased one only gets a name when every function arm agrees
 * on it, because no single arm's name describes the merged result.
 */
function componentTypeName(type: SemanticType, functions: readonly FunctionNode[]): TypeName | undefined {
  const ownTypeName = "typeName" in type ? type.typeName : undefined;
  if (ownTypeName !== undefined) return ownTypeName;
  const [first, ...remaining] = functions;
  const firstName = first?.typeName;
  // The empty-name drop goes one step past upstream's bare truthiness test
  // (`!firstTypeName`) in theory, but the difference is unreachable: publicName
  // normalization never publishes an empty type name onto an export root.
  if (firstName === undefined || firstName.name === "") return undefined;
  return remaining.every((fn) => typeNameText(fn.typeName) === typeNameText(firstName))
    ? firstName
    : undefined;
}

function typeNameText(typeName: TypeName | undefined): string {
  return typeName === undefined ? "" : JSON.stringify(typeName);
}

function collectPropertyObjects(type: SemanticType): readonly (readonly PropertyNode[])[] {
  if (type.kind === "object") return [type.properties];
  if (type.kind === "intersection" || type.kind === "union")
    return type.types.flatMap(collectPropertyObjects);
  return [];
}

/**
 * The used-set entries one props parameter contributes, mirroring upstream's
 * `squashComponentProps`. The readings are deliberately ASYMMETRIC there: a
 * DIRECT intersection parameter is filtered to its object members and each
 * becomes its own set (`collectPropertyObjects` below keeps that per-object
 * decomposition), but `unwrapUnionType` returns an INTERSECTION ARM OF A UNION
 * whole, so the arm's aggregate properties form ONE used-set. Splitting both
 * readings alike would invent used-sets upstream never had and wrongly mark
 * props co-declared by such an arm optional.
 */
function collectPropsEntries(type: SemanticType): readonly (readonly PropertyNode[])[] {
  if (type.kind === "object") return [type.properties];
  if (type.kind === "intersection") return type.types.flatMap(collectPropertyObjects);
  if (type.kind === "union") {
    return type.types.flatMap((member) =>
      member.kind === "intersection" ? [member.properties] : collectPropsEntries(member)
    );
  }
  return [];
}

export function addUndefined(type: SemanticType): SemanticType {
  if (
    type.kind === "union" &&
    type.types.some((member) => member.kind === "intrinsic" && member.intrinsic === "undefined")
  )
    return type;
  return unionType(undefined, [type, { kind: "intrinsic", intrinsic: "undefined" }]);
}
