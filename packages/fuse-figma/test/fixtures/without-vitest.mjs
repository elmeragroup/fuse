// Preloaded by `test/node-entry.test.ts` after the package's TypeScript loader, so this resolve hook
// runs first and makes `vitest` unresolvable, as it is wherever the CLIs run without dev
// dependencies. A CLI module that reaches Vitest then fails to load.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "vitest" || specifier.startsWith("vitest/")) {
      throw new Error(`vitest is not available to the CLI, imported by ${context.parentURL}`);
    }
    return nextResolve(specifier, context);
  },
});
