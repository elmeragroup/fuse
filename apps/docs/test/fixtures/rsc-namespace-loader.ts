/**
 * Loads the Fuse source the way a React Server Components bundler does.
 *
 * `"use client"` modules become client-module proxies (`createClientModuleProxy`).
 * Every other TypeScript module is transpiled and evaluated, so a directive-free
 * namespace object stays a real object whose properties are client references.
 */
import { existsSync, readFileSync } from "node:fs";
import type { LoadHook, ResolveHook } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseSync } from "oxc-parser";
import type { ParseResult } from "oxc-parser";
import { transformSync } from "oxc-transform";

const PROXY_URL = pathToFileURL(fileURLToPath(new URL("./rsc-client-proxy.ts", import.meta.url))).href;
const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

function fail(file: string, verb: string, errors: readonly { readonly message: string }[]): never {
  throw new Error(`${file} does not ${verb}: ${errors.map((error) => error.message).join("; ")}`);
}

function parse(file: string, source: string): ParseResult {
  const parsed = parseSync(file, source);
  if (parsed.errors.length > 0) {
    fail(file, "parse", parsed.errors);
  }
  return parsed;
}

function isUseClient(parsed: ParseResult): boolean {
  for (const statement of parsed.program.body) {
    if (statement.type !== "ExpressionStatement" || statement.directive === undefined) {
      return false;
    }
    if (statement.directive === "use client") {
      return true;
    }
  }
  return false;
}

function runtimeExportNames(parsed: ParseResult): string[] {
  const names = new Set<string>();
  for (const { entries } of parsed.module.staticExports) {
    for (const { exportName, isType } of entries) {
      if (isType) {
        continue;
      }
      if (exportName.kind === "Default") {
        names.add("default");
      } else if (exportName.name !== null) {
        names.add(exportName.name);
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
    if (name === "default" || !/^[$A-Z_a-z][\w$]*$/u.test(name)) {
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
  const result = transformSync(file, source, { target: "es2022", jsx: { runtime: "automatic" } });
  if (result.errors.length > 0) {
    fail(file, "transpile", result.errors);
  }
  return result.code;
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
    const candidates =
      extname(specifier) !== ""
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
  if (file.includes("/packages/fuse/src/")) {
    const parsed = parse(file, source);
    if (isUseClient(parsed)) {
      return { format: "module", source: clientStub(url, runtimeExportNames(parsed)), shortCircuit: true };
    }
  }
  return { format: "module", source: transpile(file, source), shortCircuit: true };
};
