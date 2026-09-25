/**
 * Loads the Fuse source the way a React Server Components bundler does.
 *
 * `"use client"` modules become client-module proxies (`createClientModuleProxy`).
 * Every other TypeScript module is transpiled and evaluated, so a directive-free
 * namespace object stays a real object whose properties are client references.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import type { LoadHook, ResolveHook } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

type SyntaxNode = {
  readonly kind: number;
};

type IdentifierNode = SyntaxNode & {
  readonly text: string;
};

type StringLiteralNode = SyntaxNode & {
  readonly text: string;
};

type ExpressionStatementNode = SyntaxNode & {
  readonly expression: SyntaxNode;
};

type BindingPatternNode = SyntaxNode & {
  readonly elements: readonly SyntaxNode[];
};

type BindingElementNode = SyntaxNode & {
  readonly name: SyntaxNode;
};

type ExportSpecifierNode = SyntaxNode & {
  readonly isTypeOnly: boolean;
  readonly name: IdentifierNode;
};

type NamedExportsNode = SyntaxNode & {
  readonly elements: readonly ExportSpecifierNode[];
};

type NamespaceExportNode = SyntaxNode & {
  readonly name: IdentifierNode;
};

type ExportDeclarationNode = SyntaxNode & {
  readonly isTypeOnly: boolean;
  readonly exportClause: NamedExportsNode | NamespaceExportNode | undefined;
};

type NamedDeclarationNode = SyntaxNode & {
  readonly name: IdentifierNode | undefined;
};

type VariableDeclarationNode = SyntaxNode & {
  readonly name: SyntaxNode;
};

type VariableStatementNode = SyntaxNode & {
  readonly declarationList: {
    readonly declarations: readonly VariableDeclarationNode[];
  };
};

type SourceFileNode = SyntaxNode & {
  readonly statements: readonly SyntaxNode[];
};

type ModifierNode = SyntaxNode & {
  readonly kind: number;
};

type TranspileOptions = {
  readonly fileName: string;
  readonly compilerOptions: {
    readonly module: number;
    readonly target: number;
    readonly jsx: number;
    readonly verbatimModuleSyntax: boolean;
  };
};

/**
 * The subset of the TypeScript 5 compiler this loader calls. TypeScript 7's
 * package root only exposes a version stub, so the compiler is loaded from the
 * 5.x build that already ships for tsdown.
 */
type TypeScriptCompiler = {
  readonly ScriptKind: { readonly TS: number; readonly TSX: number };
  readonly ScriptTarget: { readonly Latest: number; readonly ES2022: number };
  readonly ModuleKind: { readonly ESNext: number };
  readonly JsxEmit: { readonly ReactJSX: number };
  readonly SyntaxKind: { readonly ExportKeyword: number };
  createSourceFile(
    fileName: string,
    source: string,
    languageVersion: number,
    setParentNodes: boolean,
    scriptKind: number
  ): SourceFileNode;
  isExpressionStatement(node: SyntaxNode): node is ExpressionStatementNode;
  isStringLiteral(node: SyntaxNode): node is StringLiteralNode;
  isIdentifier(node: SyntaxNode): node is IdentifierNode;
  isObjectBindingPattern(node: SyntaxNode): node is BindingPatternNode;
  isArrayBindingPattern(node: SyntaxNode): node is BindingPatternNode;
  isBindingElement(node: SyntaxNode): node is BindingElementNode;
  isExportDeclaration(node: SyntaxNode): node is ExportDeclarationNode;
  isNamespaceExport(node: SyntaxNode): node is NamespaceExportNode;
  isExportAssignment(node: SyntaxNode): boolean;
  canHaveModifiers(node: SyntaxNode): boolean;
  getModifiers(node: SyntaxNode): readonly ModifierNode[] | undefined;
  isTypeAliasDeclaration(node: SyntaxNode): boolean;
  isInterfaceDeclaration(node: SyntaxNode): boolean;
  isFunctionDeclaration(node: SyntaxNode): node is NamedDeclarationNode;
  isClassDeclaration(node: SyntaxNode): node is NamedDeclarationNode;
  isEnumDeclaration(node: SyntaxNode): node is NamedDeclarationNode;
  isVariableStatement(node: SyntaxNode): node is VariableStatementNode;
  transpileModule(source: string, options: TranspileOptions): { readonly outputText: string };
};

function loadTypeScript(): TypeScriptCompiler {
  const pnpmDir = fileURLToPath(new URL("../../../../node_modules/.pnpm", import.meta.url));
  const entry = readdirSync(pnpmDir).find((name) => name.startsWith("typescript@5."));
  if (entry === undefined) {
    throw new Error("typescript@5 was not found in node_modules/.pnpm");
  }
  // SAFETY: typescript.js is untyped CJS. TypeScriptCompiler names only the calls below.
  return require(join(pnpmDir, entry, "node_modules/typescript/lib/typescript.js")) as TypeScriptCompiler;
}

const ts = loadTypeScript();

const PROXY_URL = pathToFileURL(fileURLToPath(new URL("./rsc-client-proxy.ts", import.meta.url))).href;
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function scriptKind(file: string): number {
  return file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function sourceFile(file: string, source: string): SourceFileNode {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
}

function isUseClient(file: string, source: string): boolean {
  const parsed = sourceFile(file, source);
  for (const statement of parsed.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      return false;
    }
    if (statement.expression.text === "use client") {
      return true;
    }
  }
  return false;
}

function collectBindingNames(name: SyntaxNode, names: Set<string>): void {
  if (ts.isIdentifier(name)) {
    names.add(name.text);
    return;
  }
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) {
        collectBindingNames(element.name, names);
      }
    }
  }
}

function runtimeExportNames(file: string, source: string): string[] {
  const parsed = sourceFile(file, source);
  const names = new Set<string>();
  for (const statement of parsed.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly || statement.exportClause === undefined) {
        continue;
      }
      if (ts.isNamespaceExport(statement.exportClause)) {
        names.add(statement.exportClause.name.text);
        continue;
      }
      for (const element of statement.exportClause.elements) {
        if (!element.isTypeOnly) {
          names.add(element.name.text);
        }
      }
      continue;
    }
    if (ts.isExportAssignment(statement)) {
      names.add("default");
      continue;
    }
    if (!ts.canHaveModifiers(statement)) {
      continue;
    }
    const modifiers = ts.getModifiers(statement);
    if (!modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      continue;
    }
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      statement.name !== undefined
    ) {
      names.add(statement.name.text);
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, names);
      }
    }
  }
  return [...names];
}

function clientStub(url: string, names: readonly string[]): string {
  const lines = [
    `import { createClientModuleProxy } from ${JSON.stringify(PROXY_URL)};`,
    `const proxy = createClientModuleProxy(${JSON.stringify(url)});`,
  ];
  for (const name of names) {
    if (!/^[$A-Z_a-z][\w$]*$/u.test(name)) {
      continue;
    }
    lines.push(`export const ${name} = proxy[${JSON.stringify(name)}];`);
  }
  if (names.includes("default")) {
    lines.push("export default proxy.default;");
  }
  return `${lines.join("\n")}\n`;
}

function transpile(file: string, source: string): string {
  const result = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: false,
    },
  });
  return result.outputText;
}

function withReactServer(context: Parameters<ResolveHook>[1]): Parameters<ResolveHook>[1] {
  if (context.conditions.includes("react-server")) {
    return context;
  }
  return { ...context, conditions: [...context.conditions, "react-server"] };
}

function fileFromParent(parentURL: string, specifier: string): string {
  return join(dirname(fileURLToPath(parentURL)), specifier);
}

function isModuleNotFound(error: Error): boolean {
  return "code" in error && error.code === "ERR_MODULE_NOT_FOUND";
}

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  const nextContext = withReactServer(context);
  if ((specifier.startsWith(".") || specifier.startsWith("/")) && nextContext.parentURL !== undefined) {
    const base = fileFromParent(nextContext.parentURL, specifier);
    // `.parts` is a filename, not a module extension. Only skip the search when
    // the specifier already ends in a file the loader can evaluate.
    const hasKnownExtension = /\.(tsx|ts|mjs|cjs|js|json)$/u.test(specifier);
    const candidates = hasKnownExtension
      ? [base]
      : [
          ...EXTENSIONS.map((extension) => `${base}${extension}`),
          ...EXTENSIONS.map((extension) => join(base, `index${extension}`)),
        ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  try {
    return await nextResolve(specifier, nextContext);
  } catch (error) {
    // Package exports point at .ts source. Node's default resolver rejects that
    // extension; the load hook transpiles it.
    if (
      nextContext.parentURL !== undefined &&
      error instanceof Error &&
      isModuleNotFound(error) &&
      (specifier.endsWith(".ts") || specifier.endsWith(".tsx"))
    ) {
      const candidate = fileFromParent(nextContext.parentURL, specifier);
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw error;
  }
};

export const load: LoadHook = async (url, context, nextLoad) => {
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const file = fileURLToPath(url);
  if (!file.endsWith(".ts") && !file.endsWith(".tsx")) {
    return nextLoad(url, context);
  }
  if (file.endsWith(".d.ts")) {
    return nextLoad(url, context);
  }
  const source = readFileSync(file, "utf8");
  const fuseSource = file.includes("/packages/fuse/src/");
  const output =
    fuseSource && isUseClient(file, source)
      ? clientStub(url, runtimeExportNames(file, source))
      : transpile(file, source);
  return { format: "module", source: output, shortCircuit: true };
};
