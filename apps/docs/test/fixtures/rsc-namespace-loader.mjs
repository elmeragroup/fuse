/**
 * Loads the Fuse source the way a React Server Components bundler does.
 *
 * `"use client"` modules become client-module proxies (`createClientModuleProxy`).
 * Every other TypeScript module is transpiled and evaluated, so a directive-free
 * namespace object stays a real object whose properties are client references.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/**
 * TypeScript 7's package root only exposes a version stub. The 5.x compiler
 * that already ships for tsdown still has `transpileModule`, which is all this
 * loader needs to evaluate directive-free source.
 */
function loadTypeScript() {
  const pnpmDir = fileURLToPath(new URL("../../../../node_modules/.pnpm", import.meta.url));
  const entry = readdirSync(pnpmDir).find((name) => name.startsWith("typescript@5."));
  if (entry === undefined) {
    throw new Error("typescript@5 was not found in node_modules/.pnpm");
  }
  return require(join(pnpmDir, entry, "node_modules/typescript/lib/typescript.js"));
}

const ts = loadTypeScript();

const PROXY_URL = pathToFileURL(fileURLToPath(new URL("./rsc-client-proxy.mjs", import.meta.url))).href;
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function scriptKind(file) {
  return file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
}

function sourceFile(file, source) {
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
}

function isUseClient(file, source) {
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

function collectBindingNames(name, names) {
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

function runtimeExportNames(file, source) {
  const parsed = sourceFile(file, source);
  const names = new Set();
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

function clientStub(url, names) {
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

function transpile(file, source) {
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

function withReactServer(context) {
  const conditions = context.conditions ?? [];
  if (conditions.includes("react-server")) {
    return context;
  }
  return { ...context, conditions: [...conditions, "react-server"] };
}

function fileFromParent(parentURL, specifier) {
  if (parentURL === undefined) {
    return specifier;
  }
  return join(dirname(fileURLToPath(parentURL)), specifier);
}

export async function resolve(specifier, context, nextResolve) {
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
      "code" in error &&
      error.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.endsWith(".ts") || specifier.endsWith(".tsx"))
    ) {
      const candidate = fileFromParent(nextContext.parentURL, specifier);
      if (existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
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
}
