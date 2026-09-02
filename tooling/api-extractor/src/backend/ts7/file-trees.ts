/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- RemoteSourceFile index lookup is the NodeHandle.resolve implementation. */

import type { Node, SourceFile } from "typescript/unstable/ast";
import type { Program, Project } from "typescript/unstable/sync";

import type { CompilerDeclaration } from "./declarations.ts";
import { isExternalSourceFile } from "./file-ownership.ts";

type SourceFileMetadata = ReturnType<Program["getSourceFileMetadata"]>;

type SourceFileTree = SourceFile & {
  readonly getOrCreateNodeAtIndex: (index: number) => Node;
};

/**
 * Session-owned source-file trees. NodeHandle.resolve and Program.getSourceFile
 * both fetch one whole file, so a file is fetched at most once per session and
 * later node lookups stay on the remembered tree. The map is dropped at session
 * close; the compiler's project-scoped SourceFileCache outlives it.
 */
export class SessionFileTrees {
  private readonly trees = new Map<string, SourceFileTree>();
  private readonly project: Project;
  private readonly sourceFileMetadata: (path: string) => SourceFileMetadata;

  constructor(project: Project, sourceFileMetadata: (path: string) => SourceFileMetadata) {
    this.project = project;
    this.sourceFileMetadata = sourceFileMetadata;
  }

  /** Whole-module reads stay inside project ownership; excluded files are never read as modules. */
  sourceFile(filePath: string): SourceFile | undefined {
    const existing = this.trees.get(filePath);
    if (existing !== undefined) return existing;
    if (isExternalSourceFile(filePath, this.sourceFileMetadata(filePath))) return undefined;
    const sourceFile = this.project.program.getSourceFile(filePath);
    if (sourceFile === undefined) return undefined;
    return this.remember(sourceFile);
  }

  resolve(declaration: CompilerDeclaration): Node | undefined {
    const tree = this.trees.get(declaration.path);
    if (tree !== undefined) return tree.getOrCreateNodeAtIndex(declaration.index);
    const node = declaration.resolve(this.project);
    if (node !== undefined) this.remember(node.getSourceFile());
    return node;
  }

  clear(): void {
    this.trees.clear();
  }

  private remember(sourceFile: SourceFile): SourceFileTree {
    // SAFETY: Program.getSourceFile returns a RemoteSourceFile. Index lookup is
    // the same operation NodeHandle.resolve uses after fetching the binary tree.
    const tree = sourceFile as SourceFileTree;
    this.trees.set(sourceFile.fileName, tree);
    if (sourceFile.path !== sourceFile.fileName) this.trees.set(sourceFile.path, tree);
    return tree;
  }
}
