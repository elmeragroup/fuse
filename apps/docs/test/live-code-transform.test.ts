import { createElement } from "react";
import type { ComponentType } from "react";

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it } from "vitest";

import { Button } from "@elmeragroup/fuse/button";
import { Select } from "@elmeragroup/fuse/select";

import { lensDemoSource } from "../scripts/lib/live-code-transform.ts";
import type { SchemaLookup } from "../scripts/lib/live-code-transform.ts";
import { LiveCodeContext } from "../src/components/live-code/lens";
import type { PartSchema } from "../src/lib/live-code/schema";
import { LiveCodeStore } from "../src/lib/live-code/store";

const VARIANT: PartSchema = [{ name: "variant", kind: "enum", values: ["default", "outline", "ghost"] }];

/** A stand-in for the committed api.json: Button and Select.Trigger have settable props. */
const schemaOf: SchemaLookup = (module, part) =>
  (module === "@elmeragroup/fuse/button" && part === "Button") ||
  (module === "@elmeragroup/fuse/select" && part === "Select.Trigger")
    ? VARIANT
    : undefined;

const DEMO = [
  '"use client";',
  "",
  'import { Button } from "@elmeragroup/fuse/button";',
  'import { Select as Picker } from "@elmeragroup/fuse/select";',
  "",
  "export const bindings = { Button, Picker };",
  "",
  "export function Demo() {",
  '  return <Button variant="ghost">Save</Button>;',
  "}",
  "",
  "export function Unrendered() {",
  "  return <Picker.Root><Picker.Trigger /></Picker.Root>;",
  "}",
].join("\n");

/** The modules a test loads, written beside this file so Vitest compiles their TSX. */
const directory = mkdtempSync(join(import.meta.dirname, ".live-code-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

type DemoModule = {
  readonly bindings: { readonly Button: unknown; readonly Picker: typeof Select };
  readonly Demo: ComponentType;
};

/** A client demo whose directive follows a leading comment, which a directive prologue allows. */
const COMMENTED_DEMO = `// A demo note.\n${DEMO}`;

/** The transformed demo, imported as the page would import it; `name` keeps each source's module apart. */
async function transformed(source = DEMO, name = "demo"): Promise<DemoModule> {
  const lensModule = pathToFileURL(join(import.meta.dirname, "../src/components/live-code/lens.tsx")).href;
  const out = lensDemoSource(source, schemaOf, lensModule);
  if (out === null) throw new Error("The demo renders settable parts, so the loader rewrites it");
  const file = join(directory, `${name}.tsx`);
  writeFileSync(file, out);
  // SAFETY: the module is `DEMO` rewritten, which exports `bindings` and `Demo` as typed here.
  return (await import(/* @vite-ignore */ pathToFileURL(file).href)) as DemoModule;
}

describe("Live code loader transform", () => {
  it("renders the demo exactly as before outside a Live code frame, directive first", async () => {
    const out = lensDemoSource(DEMO, schemaOf, "./lens.tsx") ?? "";
    expect(out.startsWith('"use client";')).toBe(true);
    const { Demo } = await transformed();
    expect(renderToStaticMarkup(createElement(Demo))).toBe(
      renderToStaticMarkup(createElement(Button, { variant: "ghost" }, "Save"))
    );
  });

  // Oracle: the `<` of `<Button` sits in column 10 of line 9, or of line 10 under the comment.
  it.each([
    ["a demo", DEMO, "demo", "9:10"],
    ["a demo whose directive follows a leading comment", COMMENTED_DEMO, "commented", "10:10"],
  ] as const)(
    "stamps each site of %s with its location, so an edit there reaches the rendered part",
    async (_case, source, name, location) => {
      const { Demo } = await transformed(source, name);
      const store = new LiveCodeStore();
      store.set(location, "variant", "outline");
      expect(
        renderToStaticMarkup(createElement(LiveCodeContext, { value: store, children: createElement(Demo) }))
      ).toBe(renderToStaticMarkup(createElement(Button, { variant: "outline" }, "Save")));
    }
  );

  it("keeps a namespace's other parts and wraps only the settable ones", async () => {
    const { bindings } = await transformed();
    expect(bindings.Picker.Root).toBe(Select.Root);
    expect(bindings.Picker.Value).toBe(Select.Value);
    expect(bindings.Picker.Trigger).not.toBe(Select.Trigger);
    expect(bindings.Button).not.toBe(Button);
  });

  it("leaves a server demo, and a demo with no settable part, unchanged", () => {
    const server = 'import { Button } from "@elmeragroup/fuse/button";\n<Button variant="ghost" />';
    expect(lensDemoSource(server, schemaOf, "./lens.tsx")).toBeNull();
    const plain = '"use client";\nimport { Card } from "@elmeragroup/fuse/card";\n<Card />';
    expect(lensDemoSource(plain, schemaOf, "./lens.tsx")).toBeNull();
  });
});
