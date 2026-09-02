/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- normalized optional facts preserve the public encoding. */
/* oxlint-disable anti-slop/no-runtime-typeof -- literal values are narrowed from compiler facts. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- assertions adapt the unstable compiler graph into opaque handles. */
/* oxlint-disable anti-slop/no-unknown-parameters -- primitive narrowing is the adapter's normalized-fact seam. */

import { resolve } from "node:path";
import type { Node, TypeNode } from "typescript/unstable/ast";
import { isTypeNode } from "typescript/unstable/ast/is";
import type {
  Checker,
  Program,
  Project,
  Signature,
  Symbol as TsSymbol,
  Type,
} from "typescript/unstable/sync";

import { BackendError } from "../../errors.ts";
import type {
  BackendCompilerOperations,
  BackendModuleDraft,
  BackendNodeReference,
  BackendExtractionSession,
  BackendSignatureHandle,
  BackendSymbolHandle,
  BackendTypeHandle,
  BackendTypeNodeHandle,
} from "../contracts.ts";
import { HandleRegistry } from "../handles.ts";
import { createSessionFacts } from "./facts.ts";
import type { TsgoFactsSession, TsgoSessionFacts } from "./facts.ts";
import { SessionFileTrees } from "./file-trees.ts";
import type { TsgoHeritageSession } from "./heritage.ts";
import { resolveModule } from "./module-resolution.ts";
import { readModule } from "./module.ts";
import type { TsgoModuleSession } from "./module.ts";
import { NodeHandleInterner } from "./node-handles.ts";
import type { SessionNodeReference } from "./node-handles.ts";
import type { PathIdentity } from "./path-identity.ts";

/**
 * Holds the project callback only until the first close notification. Keeping
 * this lifecycle seam explicit prevents a closed session from retaining the
 * project (and its native compiler API) through an otherwise inert callback.
 */
export class DetachableCloseCallback<Value> {
  private callback: ((value: Value) => void) | undefined;

  constructor(callback: (value: Value) => void) {
    this.callback = callback;
  }

  invoke(value: Value): void {
    const callback = this.callback;
    this.callback = undefined;
    callback?.(value);
  }

  detach(): void {
    this.callback = undefined;
  }
}

export class TsgoExtractionSession implements BackendExtractionSession {
  private readonly project: Project;
  private readonly checker: Checker;
  private readonly sourceFileMetadataCache = new Map<string, ReturnType<Program["getSourceFileMetadata"]>>();
  private readonly rootDirectory: string;
  private readonly projectRoot: string;
  private readonly provenanceRoot: string;
  private readonly cwd: string;
  private readonly pathIdentity: PathIdentity;
  private readonly registry = new HandleRegistry();
  private readonly nodeInterner: NodeHandleInterner;
  private readonly symbolHandles = new Map<TsSymbol, BackendSymbolHandle>();
  private readonly symbolsAtNodes = new Map<Node, BackendSymbolHandle | null>();
  private readonly typeHandles = new Map<Type, BackendTypeHandle>();
  private readonly declarationPaths = new Map<string, string>();
  private readonly typeNodeHandles = new Map<TypeNode, BackendTypeNodeHandle>();
  private readonly signatureHandles = new Map<Signature, BackendSignatureHandle>();
  private readonly onClose: DetachableCloseCallback<TsgoExtractionSession>;
  private readonly facts: TsgoSessionFacts;
  private readonly fileTrees: SessionFileTrees;
  private currentFilePath: string | undefined;
  private symbolStack: readonly string[] = [];
  private closed = false;

  readonly compiler: BackendCompilerOperations;

  constructor(
    project: Project,
    rootDirectory: string,
    projectRoot: string,
    provenanceRoot: string,
    cwd: string,
    pathIdentity: PathIdentity,
    onClose: (session: TsgoExtractionSession) => void
  ) {
    this.project = project;
    this.checker = this.project.checker;
    this.rootDirectory = rootDirectory;
    this.projectRoot = projectRoot;
    this.provenanceRoot = provenanceRoot;
    this.cwd = cwd;
    this.pathIdentity = pathIdentity;
    this.onClose = new DetachableCloseCallback(onClose);
    this.fileTrees = new SessionFileTrees(
      this.project,
      (path) => this.sourceFileMetadata(path),
      (left, right) => this.pathIdentity.sameSourceFile(left, right)
    );
    this.nodeInterner = new NodeHandleInterner(
      this.registry,
      (path) => this.internedSourceFileName(path),
      (path) => this.fileTrees.rememberLiveHandle(path),
      (declaration) => this.fileTrees.resolve(declaration)
    );
    this.facts = createSessionFacts(this.factsContext(), this.heritageContext());
    this.compiler = {
      setErrorContext: (symbolStack) => (this.symbolStack = [...symbolStack]),
      ...this.facts.operations,
    };
  }

  private factsContext(): TsgoFactsSession {
    return {
      checker: this.checker,
      program: this.project.program,
      sourceFileMetadata: (path) => this.sourceFileMetadata(path),
      rootDirectory: this.provenanceRoot,
      ensureOpen: (operation) => this.ensureOpen(operation),
      symbol: (handle, operation) => this.symbol(handle, operation),
      type: (handle, operation) => this.type(handle, operation),
      signature: (handle, operation) => this.signature(handle, operation),
      node: (handle, operation) => this.node(handle, operation),
      symbolHandle: (symbol) => this.symbolHandle(symbol),
      typeHandle: (type) => this.typeHandle(type),
      typeHandlesFor: (types) => this.typeHandlesFor(types),
      nodeHandle: (node) => this.nodeInterner.nodeHandle(node),
      declarationHandle: (declaration) => this.nodeInterner.declarationHandle(declaration),
      declarationPath: (declaration) => this.internedSourceFileName(declaration.path),
      signatureHandle: (signature) => this.signatureHandle(signature),
      typeNodeHandle: (node) => this.typeNodeHandle(node),
      nodeReference: (node) => this.nodeReference(node),
      symbolAt: (node) => this.symbolAt(node),
      resolveNode: (node) => this.fileTrees.resolve(node),
      nodePath: (node) => this.nodeRecord(node, "nodePath").path,
      compilerKind: (node) => this.nodeRecord(node, "nodeKind").kind,
    };
  }

  private heritageContext(): TsgoHeritageSession {
    return {
      checker: this.checker,
      sourceFileMetadata: (path) => this.sourceFileMetadata(path),
      resolveDeclaration: (declaration) => this.fileTrees.resolve(declaration),
    };
  }

  private moduleContext(): TsgoModuleSession {
    return {
      project: this.project,
      checker: this.checker,
      rootDirectory: this.rootDirectory,
      cwd: this.cwd,
      ensureOpen: (operation) => this.ensureOpen(operation),
      sourceFileMetadata: (path) => this.sourceFileMetadata(path),
      sourceFile: (path) => this.fileTrees.sourceFile(path),
      resolveDeclaration: (declaration) => this.fileTrees.resolve(declaration),
      symbolHandle: (symbol) => this.symbolHandle(symbol),
      documentationOfSymbol: (symbol) => this.compiler.documentationOfSymbol?.(symbol),
      heritageTypes: (declaration) =>
        declaration === undefined
          ? undefined
          : this.facts.heritageTypes(this.nodeInterner.nodeHandle(declaration)),
      sameSourceFile: (left, right) => this.pathIdentity.sameSourceFile(left, right),
    };
  }

  readModule(filePath: string): BackendModuleDraft {
    const absoluteFilePath = resolve(this.cwd, filePath);
    this.currentFilePath = absoluteFilePath;
    this.fileTrees.setCurrentFile(absoluteFilePath);
    return readModule(this.moduleContext(), filePath);
  }

  resolveModule(moduleSpecifier: string, containingFile: string) {
    return resolveModule(this.moduleContext(), moduleSpecifier, containingFile);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.fileTrees.clear();
    this.facts.clear();
    this.registry.clear();
    this.sourceFileMetadataCache.clear();
    this.symbolHandles.clear();
    this.symbolsAtNodes.clear();
    this.typeHandles.clear();
    this.declarationPaths.clear();
    this.typeNodeHandles.clear();
    this.signatureHandles.clear();
    this.onClose.invoke(this);
  }

  private ensureOpen(operation: string): void {
    if (!this.closed) return;
    throw new BackendError({
      message: `Cannot use the TypeScript extraction session after it closed (${operation})`,
      cause: "The extraction handle registry has been cleared.",
      ...(this.currentFilePath === undefined ? {} : { filePath: this.currentFilePath }),
      ...(this.symbolStack.length === 0 ? {} : { symbolStack: [...this.symbolStack] }),
    });
  }

  private context(operation: string) {
    return {
      operation,
      ...(this.currentFilePath === undefined ? {} : { filePath: this.currentFilePath }),
      ...(this.symbolStack.length === 0 ? {} : { symbolStack: [...this.symbolStack] }),
    };
  }

  private symbol(handle: BackendSymbolHandle, operation: string): TsSymbol {
    this.ensureOpen(operation);
    return this.registry.get(handle, "symbol", this.context(operation));
  }

  private type(handle: BackendTypeHandle, operation: string): Type {
    this.ensureOpen(operation);
    return this.registry.get(handle, "type", this.context(operation));
  }

  private signature(handle: BackendSignatureHandle, operation: string): Signature {
    this.ensureOpen(operation);
    return this.registry.get(handle, "signature", this.context(operation));
  }

  private node(handle: BackendNodeReference, operation: string): Node {
    this.ensureOpen(operation);
    const record = this.nodeRecord(handle, operation);
    const node = record.resolve();
    if (node === undefined) {
      throw new BackendError({
        message: `Could not resolve a ${handle.kind} compiler handle in ${operation}`,
        cause: `The compiler declaration at ${record.path} is no longer available.`,
        ...(this.currentFilePath === undefined ? {} : { filePath: this.currentFilePath }),
        ...(this.symbolStack.length === 0 ? {} : { symbolStack: [...this.symbolStack] }),
      });
    }
    if (handle.kind === "node") this.nodeInterner.rememberResolvedNode(node, handle);
    return node;
  }

  private nodeRecord(handle: BackendNodeReference, operation: string): SessionNodeReference {
    this.ensureOpen(operation);
    return handle.kind === "type-node"
      ? this.registry.get(handle, "type-node", this.context(operation))
      : this.registry.get(handle, "node", this.context(operation));
  }

  private nodeReference(node: Node): BackendNodeReference {
    return isTypeNode(node) ? this.typeNodeHandle(node) : this.nodeInterner.nodeHandle(node);
  }

  private typeNodeHandle(node: TypeNode): BackendTypeNodeHandle {
    const existing = this.typeNodeHandles.get(node);
    if (existing !== undefined) return existing;
    const sourceFile = node.getSourceFile();
    const handle = this.registry.create("type-node", {
      deferred: false,
      kind: node.kind,
      path: sourceFile.fileName,
      resolve: () => node,
    } satisfies SessionNodeReference);
    this.typeNodeHandles.set(node, handle);
    return handle;
  }

  private symbolHandle(symbol: TsSymbol): BackendSymbolHandle {
    const existing = this.symbolHandles.get(symbol);
    if (existing !== undefined) return existing;
    const handle = this.registry.create("symbol", symbol);
    this.symbolHandles.set(symbol, handle);
    return handle;
  }
  private typeHandle(type: Type): BackendTypeHandle {
    const existing = this.typeHandles.get(type);
    if (existing !== undefined) return existing;
    const handle = this.registry.create("type", type);
    this.typeHandles.set(type, handle);
    return handle;
  }
  private typeHandlesFor(types: readonly Type[]): readonly BackendTypeHandle[] {
    return types.map((type) => this.typeHandle(type));
  }
  private internedSourceFileName(path: string): string {
    const existing = this.declarationPaths.get(path);
    if (existing !== undefined) return existing;
    const resolved = this.pathIdentity.compilerSourceFileName(
      path,
      (candidate) => this.sourceFileMetadata(candidate) !== undefined
    );
    this.declarationPaths.set(path, resolved);
    return resolved;
  }
  private sourceFileMetadata(path: string): ReturnType<Program["getSourceFileMetadata"]> {
    this.ensureOpen("sourceFileMetadata");
    if (this.sourceFileMetadataCache.has(path)) return this.sourceFileMetadataCache.get(path);
    const metadata = this.project.program.getSourceFileMetadata(path);
    this.sourceFileMetadataCache.set(path, metadata);
    return metadata;
  }
  private signatureHandle(signature: Signature): BackendSignatureHandle {
    const existing = this.signatureHandles.get(signature);
    if (existing !== undefined) return existing;
    const handle = this.registry.create("signature", signature);
    this.signatureHandles.set(signature, handle);
    return handle;
  }
  private symbolAt(node: Node): BackendSymbolHandle | undefined {
    const cached = this.symbolsAtNodes.get(node);
    if (cached !== undefined) return cached ?? undefined;
    const symbol = this.checker.getSymbolAtLocation(node);
    const handle = symbol === undefined ? undefined : this.symbolHandle(symbol);
    this.symbolsAtNodes.set(node, handle ?? null);
    return handle;
  }
}
