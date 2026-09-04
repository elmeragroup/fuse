/**
 * Packed-export and packed-asset checks shared by package-check and its tests.
 * Comparison is exact-set: extra names fail the same way missing names do.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Node, SourceFile } from "typescript/unstable/ast";
import {
  isCallExpression,
  isExportDeclaration,
  isImportDeclaration,
  isImportExpression,
  isImportTypeNode,
  isLiteralTypeNode,
  isStringLiteral,
} from "typescript/unstable/ast/is";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API } from "typescript/unstable/sync";

export type PackedEvalJson = { ok: true; value: unknown } | { ok: false; failure: string };

export function parsePackedEvalJson(text: string, context: string): PackedEvalJson {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, failure: `Packed import JSON parse failed for ${context}` };
  }
}

export function packedValueExportFailure(
  entryKey: string,
  packedNames: readonly string[],
  expectedNames: readonly string[]
): string | undefined {
  const packed = new Set(packedNames);
  const expected = new Set(expectedNames);
  const missing = expectedNames.filter((name) => !packed.has(name));
  const extra = packedNames.filter((name) => !expected.has(name));
  if (missing.length === 0 && extra.length === 0) {
    return undefined;
  }
  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(`missing runtime exports: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    parts.push(`unexpected runtime exports: ${extra.join(", ")}`);
  }
  return `${entryKey} ${parts.join("; ")}`;
}

export function leadingUseClient(source: string): boolean {
  return /^["']use client["']\s*;?/.test(source.replace(/^\uFEFF/, "").trimStart());
}

export function emittedDirectiveFailure(
  extracted: string,
  sourceFiles: readonly string[],
  packageRoot: string
): string | undefined {
  for (const sourceFile of sourceFiles) {
    const sourceHasDirective = leadingUseClient(readFileSync(join(packageRoot, sourceFile), "utf8"));
    const relative = sourceFile.replace(/^src\//, "");
    const packedJs = join(extracted, relative.replace(/\.(tsx|ts)$/u, ".js"));
    if (!existsSync(packedJs)) {
      if (sourceHasDirective) {
        return `Source ${relative} has "use client" but no packed JS counterpart`;
      }
      continue;
    }
    const packedHasDirective = leadingUseClient(readFileSync(packedJs, "utf8"));
    if (sourceHasDirective !== packedHasDirective) {
      return `Directive mismatch for ${relative}: source ${sourceHasDirective ? "has" : "lacks"} "use client", packed ${packedHasDirective ? "has" : "lacks"} it`;
    }
  }
  return undefined;
}

const FORBIDDEN_RAC_PACKAGES = ["react-aria-components", "react-aria", "@internationalized/date"] as const;

export function isForbiddenRacDeclarationSpecifier(specifier: string): boolean {
  for (const name of FORBIDDEN_RAC_PACKAGES) {
    if (specifier === name || specifier.startsWith(`${name}/`)) {
      return true;
    }
  }
  return specifier.startsWith("@react-aria/");
}

function stringLiteralText(node: Node | undefined): string | undefined {
  if (node !== undefined && isStringLiteral(node)) {
    return node.text;
  }
  return undefined;
}

function importTypeSpecifier(node: Node): string | undefined {
  if (!isLiteralTypeNode(node)) {
    return undefined;
  }
  return stringLiteralText(node.literal);
}

function collectModuleSpecifierNodes(sourceFile: SourceFile): string[] {
  const specifiers: string[] = [];

  const visit = (node: Node): void => {
    if (isImportDeclaration(node)) {
      const specifier = stringLiteralText(node.moduleSpecifier);
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    } else if (isExportDeclaration(node)) {
      const specifier = stringLiteralText(node.moduleSpecifier);
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    } else if (isImportTypeNode(node)) {
      const specifier = importTypeSpecifier(node.argument);
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    } else if (isCallExpression(node) && isImportExpression(node.expression)) {
      const specifier = stringLiteralText(node.arguments[0]);
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    }
    node.forEachChild(visit);
  };

  visit(sourceFile);
  return specifiers;
}

export type DeclarationParser = {
  specifiers: (declaration: string) => string[];
};

type OwnedDeclarationParser = DeclarationParser & {
  close: () => void;
};

function createDeclarationParser(): OwnedDeclarationParser {
  const virtualFs = createVirtualFileSystem({});
  const writeFile = virtualFs.writeFile;
  if (writeFile === undefined) {
    throw new Error("TypeScript virtual filesystem is missing writeFile");
  }
  const api = new API({ cwd: process.cwd(), fs: virtualFs });
  let nextId = 0;
  return {
    specifiers(declaration: string): string[] {
      const fileName = `/declaration-${String(nextId)}.d.ts`;
      nextId += 1;
      writeFile(fileName, declaration);
      const snapshot = api.updateSnapshot({ openFiles: [fileName] });
      const sourceFile = snapshot.getDefaultProjectForFile(fileName)?.program.getSourceFile(fileName);
      return sourceFile === undefined ? [] : collectModuleSpecifierNodes(sourceFile);
    },
    close() {
      api.close();
    },
  };
}

export function withDeclarationParser<T>(fn: (parser: DeclarationParser) => T): T {
  const parser = createDeclarationParser();
  try {
    return fn(parser);
  } finally {
    parser.close();
  }
}

function entryDeclarationKey(subpath: string): string {
  return subpath === "." ? "." : `./${subpath}`;
}

function pushUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function leaksFromSpecifiers(specifiers: readonly string[]): string[] {
  const leaks: string[] = [];
  for (const specifier of specifiers) {
    if (isForbiddenRacDeclarationSpecifier(specifier)) {
      pushUnique(leaks, specifier);
    }
  }
  return leaks;
}

export function bareEntryRacDeclarationFailure(
  entries: readonly { readonly subpath: string; readonly declaration: string }[]
): string | undefined {
  return withDeclarationParser((parser) => {
    for (const entry of entries) {
      if (entry.subpath.startsWith("react-aria/")) {
        continue;
      }
      const leaks = leaksFromSpecifiers(parser.specifiers(entry.declaration));
      if (leaks.length > 0) {
        return `${entryDeclarationKey(entry.subpath)} declaration references ${leaks.join(", ")}`;
      }
    }
    return undefined;
  });
}

function publishedTypesFile(sourceFile: string): string {
  return sourceFile.replace(/^src\//, "").replace(/\.(tsx|ts|jsx|js)$/u, ".d.ts");
}

function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier === "." || specifier === ".." || specifier.startsWith("./") || specifier.startsWith("../");
}

function isInsideExtracted(extracted: string, candidate: string): boolean {
  const rel = relative(resolve(extracted), resolve(candidate));
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function isPackedRacDeclaration(extracted: string, filePath: string): boolean {
  const rel = toPosixPath(relative(resolve(extracted), resolve(filePath)));
  return rel === "react-aria" || rel.startsWith("react-aria/");
}

function resolvePackedDeclaration(
  extracted: string,
  fromFile: string,
  specifier: string
): string | undefined {
  if (!isRelativeSpecifier(specifier)) {
    return undefined;
  }
  const fromDir = dirname(fromFile);
  const candidates =
    specifier === "." || specifier === ".."
      ? [resolve(fromDir, specifier, "index.d.ts")]
      : specifier.endsWith(".d.ts")
        ? [resolve(fromDir, specifier)]
        : specifier.endsWith(".js")
          ? [resolve(fromDir, `${specifier.slice(0, -".js".length)}.d.ts`)]
          : [resolve(fromDir, `${specifier}.d.ts`), resolve(fromDir, specifier, "index.d.ts")];
  for (const candidate of candidates) {
    if (isInsideExtracted(extracted, candidate) && existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function collectReachableDeclarationLeaks(
  extracted: string,
  rootFile: string,
  parser: DeclarationParser
): string[] {
  const leaks: string[] = [];
  const visited = new Set<string>();
  const queue = [resolve(rootFile)];

  while (queue.length > 0) {
    const filePath = queue.shift();
    if (filePath === undefined || visited.has(filePath)) {
      continue;
    }
    visited.add(filePath);
    if (!isInsideExtracted(extracted, filePath) || !existsSync(filePath)) {
      continue;
    }
    for (const specifier of parser.specifiers(readFileSync(filePath, "utf8"))) {
      if (isForbiddenRacDeclarationSpecifier(specifier)) {
        pushUnique(leaks, specifier);
        continue;
      }
      const next = resolvePackedDeclaration(extracted, filePath, specifier);
      if (next === undefined) {
        continue;
      }
      if (isPackedRacDeclaration(extracted, next)) {
        pushUnique(leaks, specifier);
        continue;
      }
      queue.push(next);
    }
  }

  return leaks;
}

export function packedBareEntryRacDeclarationFailure(
  extracted: string,
  jsEntries: readonly { readonly subpath: string; readonly sourceFile: string }[]
): string | undefined {
  return withDeclarationParser((parser) => {
    for (const entry of jsEntries) {
      if (entry.subpath.startsWith("react-aria/")) {
        continue;
      }
      const rootFile = join(extracted, publishedTypesFile(entry.sourceFile));
      const leaks = existsSync(rootFile) ? collectReachableDeclarationLeaks(extracted, rootFile, parser) : [];
      if (leaks.length > 0) {
        return `${entryDeclarationKey(entry.subpath)} declaration references ${leaks.join(", ")}`;
      }
    }
    return undefined;
  });
}
