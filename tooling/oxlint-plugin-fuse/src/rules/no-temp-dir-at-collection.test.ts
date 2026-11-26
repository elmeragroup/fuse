import { ruleTester } from "../rule-tester.ts";
import { noTempDirAtCollection } from "./no-temp-dir-at-collection.ts";

/** The imports every case starts with. */
const FS =
  'import { mkdtempSync, mkdtempDisposableSync } from "node:fs"; import { mkdtemp } from "node:fs/promises"; import * as fs from "node:fs"; import { afterAll, beforeAll, beforeEach, describe, it, suite, test } from "vitest";';

/** The error a `name` call at a collection site reports. */
const collected = (name: string) => [{ messageId: "collected", data: { name } }];

ruleTester.run("no-temp-dir-at-collection", noTempDirAtCollection, {
  valid: [
    `${FS} let dir; beforeAll(() => { dir = mkdtempSync("/tmp/x-"); return () => rmSync(dir, { recursive: true }); });`,
    `${FS} beforeEach(async () => { dir = await mkdtemp("/tmp/x-"); });`,
    `${FS} it("writes", () => { using dir = mkdtempDisposableSync("/tmp/x-"); });`,
    `${FS} test("writes", async () => { const dir = await mkdtemp("/tmp/x-"); });`,
    // A hook or test inside a suite runs when the test runs.
    `${FS} describe("files", () => { beforeAll(() => { dir = fs.mkdtempSync("/tmp/x-"); }); });`,
    `${FS} describe("files", () => { it("writes", () => { using dir = mkdtempDisposableSync("/tmp/x-"); }); });`,
    'import { layer } from "@effect/vitest"; import * as fs from "node:fs"; layer(Services)("files", (it) => { it.effect("writes", () => fs.mkdtempSync("/tmp/x-")); });',
    // A helper runs when a hook or test calls it.
    `${FS} function fixture() { return mkdtempSync("/tmp/x-"); }`,
    `${FS} const scratch = Effect.promise(() => mkdtemp("/tmp/x-"));`,
    // Another function of that name is not Node's.
    "const mkdtempSync = (prefix) => prefix; mkdtempSync('x');",
    'import * as store from "./store.ts"; const dir = store.mkdtempSync("x");',
    'import store from "./store.ts"; const dir = store.mkdtempSync("x");',
    // A test registered on the collector a suite returns runs when the test runs.
    `${FS} describe("files", () => {}).test("writes", () => { using dir = mkdtempDisposableSync("/tmp/x-"); });`,
    // A class field initializer runs when the class is constructed.
    `${FS} class Fixture { dir = mkdtempSync("/tmp/x-"); }`,
    // A local function named `describe` is no Vitest suite.
    'import { mkdtempSync } from "node:fs"; const describe = (name, body) => body; describe("files", () => { const dir = mkdtempSync("/tmp/x-"); });',
  ],
  invalid: [
    { code: `${FS} const dir = mkdtempSync("/tmp/x-");`, errors: collected("mkdtempSync") },
    { code: `${FS} const dir = await mkdtemp("/tmp/x-");`, errors: collected("mkdtemp") },
    { code: `${FS} const dir = fs.mkdtempSync("/tmp/x-");`, errors: collected("mkdtempSync") },
    {
      // A `using` binding at module level removes the directory before any test runs.
      code: `${FS} using dir = mkdtempDisposableSync("/tmp/x-");`,
      errors: collected("mkdtempDisposableSync"),
    },
    {
      code: 'import { mkdtempSync as makeTemp } from "node:fs"; const dir = makeTemp("/tmp/x-");',
      errors: collected("mkdtempSync"),
    },
    {
      code: 'import fs from "node:fs"; const dir = fs.mkdtempSync("/tmp/x-");',
      errors: collected("mkdtempSync"),
    },
    {
      code: 'import fs from "fs"; const dir = await fs.promises.mkdtemp("/tmp/x-");',
      errors: collected("mkdtemp"),
    },
    {
      code: 'import * as fs from "node:fs"; const dir = await fs.promises.mkdtemp("/tmp/x-");',
      errors: collected("mkdtemp"),
    },
    {
      code: 'import { promises } from "node:fs"; const dir = await promises.mkdtemp("/tmp/x-");',
      errors: collected("mkdtemp"),
    },
    {
      code: 'import fsp from "node:fs/promises"; const dir = await fsp.mkdtemp("/tmp/x-");',
      errors: collected("mkdtemp"),
    },
    {
      // The docs pipeline's demo folder before this rule.
      code: `${FS} describe("demo file checks", () => { const demosDir = mkdtempSync("/repo/test/.demos-"); afterAll(() => rmSync(demosDir)); });`,
      errors: collected("mkdtempSync"),
    },
    {
      code: `${FS} describe.skip("files", () => { describe("nested", () => { const dir = mkdtempSync("/tmp/x-"); }); });`,
      errors: collected("mkdtempSync"),
    },
    {
      code: `${FS} describe.each([1, 2])("case %i", (n) => { const dir = mkdtempSync("/tmp/x-"); });`,
      errors: collected("mkdtempSync"),
    },
    {
      code: `${FS} suite("files", function () { const dir = mkdtempSync("/tmp/x-"); });`,
      errors: collected("mkdtempSync"),
    },
    {
      code: 'import * as vitest from "vitest"; import * as fs from "node:fs"; vitest.describe("files", () => { const dir = fs.mkdtempSync("/tmp/x-"); });',
      errors: collected("mkdtempSync"),
    },
    {
      code: 'import { describe as group } from "vitest"; import * as fs from "node:fs"; group("files", () => { const dir = fs.mkdtempSync("/tmp/x-"); });',
      errors: collected("mkdtempSync"),
    },
    {
      code: 'import { describe } from "vitest"; import * as fs from "node:fs"; describe.each`n\n${1}`("case $n", () => { const dir = fs.mkdtempSync("/tmp/x-"); });',
      errors: collected("mkdtempSync"),
    },
    {
      code: `${FS} describe.runIf(enabled).concurrent("files", () => { const dir = mkdtempSync("/tmp/x-"); });`,
      errors: collected("mkdtempSync"),
    },
    {
      code: `${FS} describe.skipIf(flag).each(rows)("case %i", (n) => { const dir = mkdtempSync("/tmp/x-"); });`,
      errors: collected("mkdtempSync"),
    },
    {
      code: `${FS} const cases = describe.each(rows); cases("case %i", (n) => { const dir = mkdtempSync("/tmp/x-"); });`,
      errors: collected("mkdtempSync"),
    },
    {
      // A static field initializer runs when the module defines the class.
      code: `${FS} class Fixture { static dir = mkdtempSync("/tmp/x-"); }`,
      errors: collected("mkdtempSync"),
    },
    {
      // How `@effect/vitest` opens a suite with a layer, as the release announcement's tests do.
      code: 'import { layer } from "@effect/vitest"; import * as fs from "node:fs"; layer(Services, { excludeTestServices: true })("files", (it) => { const dir = fs.mkdtempSync("/tmp/x-"); });',
      errors: collected("mkdtempSync"),
    },
    {
      code: 'import { layer } from "@effect/vitest"; import * as fs from "node:fs"; const withServices = layer(Services); withServices("files", (it) => { const dir = fs.mkdtempSync("/tmp/x-"); });',
      errors: collected("mkdtempSync"),
    },
    {
      code: 'import { describe } from "@effect/vitest"; import * as fs from "node:fs"; describe("files", () => { const dir = fs.mkdtempSync("/tmp/x-"); });',
      errors: collected("mkdtempSync"),
    },
  ],
});
