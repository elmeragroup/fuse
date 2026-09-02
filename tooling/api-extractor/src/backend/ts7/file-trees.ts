/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- RemoteSourceFile index lookup is the NodeHandle.resolve implementation. */

import type { Node, SourceFile } from "typescript/unstable/ast";
import type { Program, Project } from "typescript/unstable/sync";

import type { CompilerDeclaration } from "./declarations.ts";
import { isExternalSourceFile } from "./file-ownership.ts";

/**
 * Two live handles of one file is the lower bound of "several referenced
 * symbols". A module read of that file is also dense. Files excluded by
 * ownership never take the eager bulk path; sparse access keeps
 * NodeHandle.resolve until that node is actually needed.
 */
export const DENSE_LIVE_HANDLE_THRESHOLD = 2;

type SourceFileMetadata = ReturnType<Program["getSourceFileMetadata"]>;

type SourceFileTree = SourceFile & {
  readonly getOrCreateNodeAtIndex: (index: number) => Node;
};

/**
 * Session-owned source-file trees. Dense included files are fetched once
 * through Program.getSourceFile; later node lookups stay on that tree. The
 * map is dropped at session close and does not live on the compiler's
 * project-scoped SourceFileCache.
 */
export class SessionFileTrees {
  private readonly trees = new Map<string, SourceFileTree>();
  private readonly liveHandlesByFile = new Map<string, number>();
  private currentFilePath: string | undefined;
  private readonly project: Project;
  private readonly sourceFileMetadata: (path: string) => SourceFileMetadata;
  private readonly sameSourceFile: (left: string, right: string) => boolean;

  constructor(
    project: Project,
    sourceFileMetadata: (path: string) => SourceFileMetadata,
    sameSourceFile: (left: string, right: string) => boolean
  ) {
    this.project = project;
    this.sourceFileMetadata = sourceFileMetadata;
    this.sameSourceFile = sameSourceFile;
  }

  setCurrentFile(filePath: string | undefined): void {
    this.currentFilePath = filePath;
  }

  rememberLiveHandle(path: string): void {
    this.liveHandlesByFile.set(path, (this.liveHandlesByFile.get(path) ?? 0) + 1);
  }

  sourceFile(filePath: string): SourceFile | undefined {
    const existing = this.tree(filePath);
    if (existing !== undefined) return existing;
    // Program.getSourceFile dumps the whole tree. Excluded files stay off that
    // path until a sparse resolve actually needs a node; a session-cached tree
    // from that sparse fetch is still returned above.
    if (isExternalSourceFile(filePath, this.sourceFileMetadata(filePath))) return undefined;
    const sourceFile = this.project.program.getSourceFile(filePath);
    if (sourceFile === undefined) return undefined;
    return this.remember(sourceFile);
  }

  resolve(declaration: CompilerDeclaration): Node | undefined {
    const tree = this.tree(declaration.path);
    if (tree !== undefined) return tree.getOrCreateNodeAtIndex(declaration.index);
    if (this.shouldBulkFetch(declaration.path)) {
      const sourceFile = this.sourceFile(declaration.path);
      return sourceFile === undefined
        ? undefined
        : asSourceFileTree(sourceFile).getOrCreateNodeAtIndex(declaration.index);
    }
    const node = declaration.resolve(this.project);
    if (node !== undefined) this.remember(node.getSourceFile());
    return node;
  }

  clear(): void {
    this.trees.clear();
    this.liveHandlesByFile.clear();
    this.currentFilePath = undefined;
  }

  private shouldBulkFetch(path: string): boolean {
    if (isExternalSourceFile(path, this.sourceFileMetadata(path))) return false;
    return this.isCurrentFile(path) || (this.liveHandlesByFile.get(path) ?? 0) >= DENSE_LIVE_HANDLE_THRESHOLD;
  }

  private isCurrentFile(path: string): boolean {
    return this.currentFilePath !== undefined && this.sameSourceFile(path, this.currentFilePath);
  }

  private tree(path: string): SourceFileTree | undefined {
    return this.trees.get(path);
  }

  private remember(sourceFile: SourceFile): SourceFileTree {
    const tree = asSourceFileTree(sourceFile);
    this.trees.set(sourceFile.fileName, tree);
    if (sourceFile.path !== sourceFile.fileName) this.trees.set(sourceFile.path, tree);
    return tree;
  }
}

function asSourceFileTree(sourceFile: SourceFile): SourceFileTree {
  // SAFETY: Program.getSourceFile returns a RemoteSourceFile. Index lookup is
  // the same operation NodeHandle.resolve uses after fetching the binary tree.
  return sourceFile as SourceFileTree;
}
