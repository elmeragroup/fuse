/* oxlint-disable anti-slop/no-conditional-empty-object-spread -- normalized optional facts preserve the public encoding. */
/* oxlint-disable anti-slop/no-runtime-typeof -- literal values are narrowed from compiler facts. */
/* oxlint-disable anti-slop/require-safety-comment-for-type-assertion -- assertions adapt the unstable compiler graph into opaque handles. */
/* oxlint-disable anti-slop/no-unknown-parameters -- primitive narrowing is the adapter's normalized-fact seam. */

import { resolve } from "node:path";
import type { Node, TypeNode } from "typescript/unstable/ast";
import { isTypeNode } from "typescript/unstable/ast/is";
import type { Checker, Project, Signature, Symbol as TsSymbol, Type } from "typescript/unstable/sync";

import { BackendError } from "../../errors.ts";
import type {
  BackendCompilerOperations,
  BackendModuleDraft,
  BackendNodeHandle,
  BackendNodeReference,
  BackendExtractionSession,
  BackendSignatureHandle,
  BackendSymbolHandle,
  BackendTypeHandle,
  BackendTypeNodeHandle,
} from "../contracts.ts";
import { HandleRegistry } from "../handles.ts";
import { createCompilerOperations } from "./facts.ts";
import type { TsgoFactsSession } from "./facts.ts";
import { readModule, resolveModule } from "./module.ts";
import type { TsgoModuleSession } from "./module.ts";

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
  private readonly rootDirectory: string;
  private readonly projectRoot: string;
  private readonly provenanceRoot: string;
  private readonly cwd: string;
  private readonly registry = new HandleRegistry();
  private readonly symbolHandles = new Map<TsSymbol, BackendSymbolHandle>();
  private readonly typeHandles = new Map<Type, BackendTypeHandle>();
  private readonly nodeHandles = new Map<Node, BackendNodeHandle>();
  private readonly typeNodeHandles = new Map<TypeNode, BackendTypeNodeHandle>();
  private readonly signatureHandles = new Map<Signature, BackendSignatureHandle>();
  private readonly onClose: DetachableCloseCallback<TsgoExtractionSession>;
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
    onClose: (session: TsgoExtractionSession) => void
  ) {
    this.project = project;
    this.checker = this.project.checker;
    this.rootDirectory = rootDirectory;
    this.projectRoot = projectRoot;
    this.provenanceRoot = provenanceRoot;
    this.cwd = cwd;
    this.onClose = new DetachableCloseCallback(onClose);
    this.compiler = {
      setErrorContext: (symbolStack) => (this.symbolStack = [...symbolStack]),
      ...createCompilerOperations(this.factsContext()),
    };
  }

  private factsContext(): TsgoFactsSession {
    return {
      checker: this.checker,
      rootDirectory: this.provenanceRoot,
      symbol: (handle, operation) => this.symbol(handle, operation),
      type: (handle, operation) => this.type(handle, operation),
      signature: (handle, operation) => this.signature(handle, operation),
      node: (handle, operation) => this.node(handle, operation),
      symbolHandle: (symbol) => this.symbolHandle(symbol),
      typeHandle: (type) => this.typeHandle(type),
      typeHandlesFor: (types) => this.typeHandlesFor(types),
      nodeHandle: (node) => this.nodeHandle(node),
      signatureHandle: (signature) => this.signatureHandle(signature),
      typeNodeHandle: (node) => this.typeNodeHandle(node),
      nodeReference: (node) => this.nodeReference(node),
      symbolAt: (node) => this.symbolAt(node),
      resolveNode: (node) => node.resolve(),
    };
  }

  private moduleContext(): TsgoModuleSession {
    return {
      project: this.project,
      checker: this.checker,
      rootDirectory: this.rootDirectory,
      cwd: this.cwd,
      ensureOpen: (operation) => this.ensureOpen(operation),
      symbolHandle: (symbol) => this.symbolHandle(symbol),
      documentationOfSymbol: (symbol) => this.compiler.documentationOfSymbol?.(symbol),
    };
  }

  readModule(filePath: string): BackendModuleDraft {
    const absoluteFilePath = resolve(this.cwd, filePath);
    this.currentFilePath = absoluteFilePath;
    return readModule(this.moduleContext(), filePath);
  }

  resolveModule(moduleSpecifier: string, containingFile: string) {
    return resolveModule(this.moduleContext(), moduleSpecifier, containingFile);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.registry.clear();
    this.symbolHandles.clear();
    this.typeHandles.clear();
    this.nodeHandles.clear();
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
    return handle.kind === "type-node"
      ? this.registry.get(handle, "type-node", this.context(operation))
      : this.registry.get(handle, "node", this.context(operation));
  }

  private nodeReference(node: Node): BackendNodeReference {
    return isTypeNode(node) ? this.typeNodeHandle(node) : this.nodeHandle(node);
  }

  private typeNodeHandle(node: TypeNode): BackendTypeNodeHandle {
    const existing = this.typeNodeHandles.get(node);
    if (existing !== undefined) return existing;
    const handle = this.registry.create("type-node", node);
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
  private nodeHandle(node: Node): BackendNodeHandle {
    const existing = this.nodeHandles.get(node);
    if (existing !== undefined) return existing;
    const handle = this.registry.create("node", node);
    this.nodeHandles.set(node, handle);
    return handle;
  }
  private signatureHandle(signature: Signature): BackendSignatureHandle {
    const existing = this.signatureHandles.get(signature);
    if (existing !== undefined) return existing;
    const handle = this.registry.create("signature", signature);
    this.signatureHandles.set(signature, handle);
    return handle;
  }
  private symbolAt(node: Node): BackendSymbolHandle | undefined {
    const symbol = this.checker.getSymbolAtLocation(node);
    return symbol === undefined ? undefined : this.symbolHandle(symbol);
  }
}
