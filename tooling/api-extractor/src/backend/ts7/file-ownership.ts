import type { Node } from "typescript/unstable/ast";

import type { BackendDeclarationOwnership, BackendNodeReference } from "../contracts.ts";
import type { TsgoFactsSession } from "./facts.ts";

/**
 * Normalized declaration ownership for the external-type policy.
 *
 * This module deliberately sits beside `facts.ts` instead of growing it: the
 * shared reader stays focused on the hot graph facts, while source-file
 * ownership is a colder classification the resolver consults through one
 * operation. The path questions it answers used to be scattered across
 * resolver modules (`/node_modules/` probes, two flavors of TypeScript
 * library-directory tests); they are normalized here so resolver code asks
 * "who owns this declaration" and never matches paths itself.
 */

export function declarationOwnership(
  session: TsgoFactsSession,
  handle: BackendNodeReference
): BackendDeclarationOwnership {
  const node = session.node(handle, "declarationOwnership");
  const sourceFile = node.getSourceFile();
  const externalLibrary = session.program.isSourceFileFromExternalLibrary(sourceFile);
  const defaultLibrary = session.program.isSourceFileDefaultLibrary(sourceFile);
  return classifySourceFile(sourceFile.fileName, { externalLibrary, defaultLibrary });
}

/** Whether a raw compiler declaration belongs outside the extracted project. */
export function isExternalDeclaration(
  session: TsgoFactsSession,
  declaration: { readonly resolve: () => Node | undefined }
): boolean {
  const node = session.resolveNode(declaration);
  return (
    node !== undefined && isExternalOwnership(declarationOwnership(session, session.nodeReference(node)))
  );
}

/**
 * Uses the compiler's default-library metadata for the strict library gate.
 * This is shared by the built-in-array and readonly-array facts so those
 * callers cannot accidentally reintroduce a source-path probe.
 */
export function isTypeScriptLibraryDeclaration(
  session: TsgoFactsSession,
  declaration: { readonly resolve: () => Node | undefined }
): boolean {
  const node = session.resolveNode(declaration);
  if (node === undefined) return false;
  const ownership = declarationOwnership(session, session.nodeReference(node));
  return ownership.kind === "typescript" && ownership.library === "standard-library";
}

export type SourceFileOwnershipMetadata = {
  readonly externalLibrary: boolean;
  readonly defaultLibrary: boolean;
};

/**
 * Classifies one source-file path into the ownership facts the contract
 * defines. The three tests mirror the questions the resolver previously asked
 * inline: packaged sources under any `node_modules` segment are external;
 * TypeScript's own library files (`…/typescript/lib/…`, including
 * `@typescript` toolchain installs) are the standard library; and the wider
 * toolchain question accepts any TypeScript installation's lib directory.
 */
export function classifySourceFile(
  filePath: string,
  metadata?: SourceFileOwnershipMetadata
): BackendDeclarationOwnership {
  const normalizedPath = filePath.replaceAll("\\", "/");
  const pathSegments = normalizedPath.split("/").filter((segment) => segment.length > 0);
  const pathTypescriptLibDirectory = pathSegments.some(
    (segment, index) =>
      (segment === "typescript" && pathSegments[index + 1] === "lib") ||
      (segment === "@typescript" && pathSegments[index + 2] === "lib")
  );
  const fileName = pathSegments[pathSegments.length - 1] ?? "";
  const pathExternal = pathSegments.includes("node_modules");
  const pathStandardLibrary = pathTypescriptLibDirectory && /^lib\..+\.d\.ts$/u.test(fileName);
  // Default libraries are compiler-owned even when the installation is not
  // beneath `node_modules`; they remain external to the extracted project.
  const external =
    metadata === undefined ? pathExternal : metadata.externalLibrary || metadata.defaultLibrary;
  const standardLibrary = metadata?.defaultLibrary ?? pathStandardLibrary;
  // The path shape remains useful for the wider toolchain fact, but compiler
  // metadata wins for files in the opened project. This keeps a project file
  // named `typescript/lib/lib.dom.d.ts` from becoming a compiler library while
  // retaining non-node_modules default libraries and external toolchains.
  const typescriptLibDirectory =
    pathTypescriptLibDirectory && (metadata === undefined || external || standardLibrary);
  if (standardLibrary) return { kind: "typescript", library: "standard-library" };
  if (typescriptLibDirectory) return { kind: "typescript", library: "toolchain" };
  if (external) return { kind: "dependency", packageName: packageNameFromPath(pathSegments) };
  return { kind: "project" };
}

/** Ownership predicates stay in the backend adapter, beside classification. */
export function isExternalOwnership(ownership: BackendDeclarationOwnership): boolean {
  return ownership.kind !== "project";
}

function packageNameFromPath(pathSegments: readonly string[]): string {
  // Use the innermost node_modules segment: pnpm and Yarn may place several
  // package stores in one path, while the last segment names the dependency
  // actually declaring the source file.
  const nodeModulesIndex = pathSegments.lastIndexOf("node_modules");
  if (nodeModulesIndex === -1) return "<external>";
  const packageSegment = pathSegments[nodeModulesIndex + 1];
  if (packageSegment === undefined) return "<external>";
  if (packageSegment.startsWith("@")) {
    const scopePackage = pathSegments[nodeModulesIndex + 2];
    return scopePackage === undefined ? packageSegment : `${packageSegment}/${scopePackage}`;
  }
  return packageSegment;
}
