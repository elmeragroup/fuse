import { ruleTester } from "../rule-tester.ts";
import { noTestRetry } from "./no-test-retry.ts";

const TEST = "/repo/packages/fuse/src/button.test.ts";
const CONFIG = "/repo/packages/fuse/vitest.config.ts";

ruleTester.run("no-test-retry", noTestRetry, {
  valid: [
    { code: 'it("opens", { timeout: 30_000 }, () => {});', filename: TEST },
    // A product's retry policy under test is data, not a rerun of the test.
    { code: 'const policy = { retry: 3 };\nit("retries reads", () => run(policy));', filename: TEST },
    { code: 'headers({ "retry-after": "30" });', filename: TEST },
    { code: 'const opts = { timeout: 5_000 };\nit("opens", { ...opts }, () => {});', filename: TEST },
    { code: "export default defineConfig({ test: { testTimeout: 30_000 } });", filename: CONFIG },
  ],
  invalid: [
    // Finding 2: a spread of alternatives, one of which reruns.
    {
      code: 'const opts = { ...(flag ? { retry: 2 } : {}) };\nit("x", opts, () => {});',
      filename: "/repo/packages/fuse/src/button.test.ts",
      errors: [{ messageId: "rerun" }],
    },
    // T6: a runner stored in an object property.
    {
      code: 'const api = { spec: it };\napi.spec("x", { retry: 2 }, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    // T7: options reached through an expanded array spread.
    {
      code: 'it("x", [...[{ retry: 2 }]][0], () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    // N9: a runner off a namespace import.
    {
      code: 'import * as vt from "vitest";\nvt.it("x", { retry: 2 }, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    {
      code: 'import * as vt from "vitest";\nvt.describe.each([1])("s %d", { repeats: 2 }, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    { code: 'it("opens", { retry: 2 }, () => {});', filename: TEST, errors: [{ messageId: "rerun" }] },
    { code: 'describe("menu", { repeats: 5 }, () => {});', filename: TEST, errors: [{ messageId: "rerun" }] },
    {
      code: 'it.each([1, 2])("row %d", { retry: 1 }, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    { code: "vi.setConfig({ retry: 3 });", filename: TEST, errors: [{ messageId: "rerun" }] },
    // T1: options held in a binding or spread from another object still reach the test.
    {
      code: 'const opts = { retry: 2 };\nit("opens", opts, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    {
      code: 'const flaky = { retry: 2 };\nit("opens", { ...flaky, timeout: 5_000 }, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    // Item 4: an aliased runner import is still a test.
    {
      code: 'import { it as spec } from "vitest";\nspec("x", { retry: 2 }, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    {
      code: 'import { describe as suite } from "vitest";\nsuite.concurrent("menu", { repeats: 3 }, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    // One shared options object reports once, however many tests take it.
    {
      code: 'const opts = { retry: 2 };\nit("a", opts, () => {});\nit("b", opts, () => {});',
      filename: TEST,
      errors: [{ messageId: "rerun" }],
    },
    {
      code: "export default defineConfig({ test: { retry: process.env.CI ? 2 : 0 } });",
      filename: CONFIG,
      errors: [{ messageId: "rerun" }],
    },
    {
      code: "export default defineConfig({ retries: 2 });",
      filename: "/repo/apps/docs/playwright.config.ts",
      errors: [{ messageId: "rerun" }],
    },
  ],
});
