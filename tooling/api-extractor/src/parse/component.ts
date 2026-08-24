/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- optional type names preserve model JSON. */

import type { SemanticType, PropertyNode } from "../model.ts";

export function componentNode(
  type: SemanticType,
  exportName: string,
  authoredProps: SemanticType | undefined
): SemanticType {
  if (!/^[A-Z]/u.test(exportName) && exportName !== "default") return type;
  const functions = collectFunctionTypes(type);
  if (
    functions.length === 0 ||
    !functions.every((fn) => fn.callSignatures.some((signature) => isReactLike(signature.returnValueType)))
  )
    return type;
  const props: PropertyNode[] = [];
  const usedBySignature: Set<string>[] = [];
  for (const fn of functions) {
    const first = fn.callSignatures[0]?.parameters[0];
    const objects =
      authoredProps === undefined
        ? first === undefined
          ? []
          : collectPropertyObjects(first.type)
        : collectPropertyObjects(authoredProps);
    for (const object of objects) {
      const used = new Set<string>();
      for (const property of object) {
        used.add(property.name);
        const current = props.find((candidate) => candidate.name === property.name);
        if (current === undefined) props.push(property);
        else if (JSON.stringify(current.type) !== JSON.stringify(property.type)) {
          const index = props.indexOf(current);
          props[index] = {
            ...current,
            type: addUndefined({ kind: "union", types: [current.type, property.type] }),
            optional: current.optional || property.optional,
          };
        }
      }
      usedBySignature.push(used);
    }
  }
  if (functions.some((fn) => fn.callSignatures.some((signature) => signature.parameters.length === 0)))
    usedBySignature.push(new Set());
  return {
    kind: "component",
    props: props.map((property) =>
      usedBySignature.some((used) => !used.has(property.name))
        ? { ...property, type: addUndefined(property.type), optional: true }
        : property
    ),
    ...(type.kind === "function" && type.typeName !== undefined ? { typeName: type.typeName } : {}),
  };
}

function collectFunctionTypes(type: SemanticType): Extract<SemanticType, { kind: "function" }>[] {
  if (type.kind === "function") return [type];
  if (type.kind === "union") return type.types.flatMap(collectFunctionTypes);
  return [];
}

function collectPropertyObjects(type: SemanticType): readonly (readonly PropertyNode[])[] {
  if (type.kind === "object") return [type.properties];
  if (type.kind === "intersection" || type.kind === "union")
    return type.types.flatMap(collectPropertyObjects);
  return [];
}

function isReactLike(type: SemanticType): boolean {
  if (type.kind === "external" || type.kind === "object" || type.kind === "component") {
    const name = type.typeName?.name;
    return name === "Element" || name === "ReactElement" || name === "ReactNode";
  }
  if (type.kind === "union") return type.types.some(isReactLike);
  return false;
}

export function addUndefined(type: SemanticType): SemanticType {
  const undefinedType: SemanticType = { kind: "intrinsic", intrinsic: "undefined" };
  if (type.kind !== "union") return { kind: "union", types: [type, undefinedType] };
  if (type.types.some((member) => member.kind === "intrinsic" && member.intrinsic === "undefined"))
    return type;
  return { ...type, types: [...type.types, undefinedType] };
}
