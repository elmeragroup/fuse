import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { DOCS_COMPONENTS } from "../src/generated/registry";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");
const repoRoot = join(docsRoot, "../..");

function component(slug: string) {
  const found = DOCS_COMPONENTS.find((entry) => entry.slug === slug);
  if (found === undefined) {
    throw new Error(`the generated registry has no "${slug}" page`);
  }
  return found;
}

describe("generated registry", () => {
  it("covers every authored component page", () => {
    expect(DOCS_COMPONENTS.map((entry) => entry.slug)).toEqual([
      "badge",
      "button",
      "card",
      "dialog",
      "field",
      "input",
      "input-group",
      "item",
      "scroll-area",
      "separator",
      "textarea",
    ]);
  });

  it("keeps the demo frame and its displayed source on the same authored file", () => {
    for (const entry of DOCS_COMPONENTS) {
      // The page imports each demo from its own route directory, and the frame's source
      // is that very file — read once, never copied (docs-site.md §6).
      const page = readFileSync(join(docsRoot, "src/app/(docs)/components", entry.slug, "page.mdx"), "utf8");
      for (const demo of entry.demos) {
        const authored = readFileSync(join(repoRoot, demo.sourcePath), "utf8");
        expect(authored.replace(/\s+$/, "")).toBe(demo.source);
        // Authored in the file, not grafted on in transit.
        expect(authored.startsWith('"use client";')).toBe(true);
        const file = demo.sourcePath.split("/").at(-1) ?? "";
        expect(page, demo.sourcePath).toContain(`file="${file}"`);
        expect(page, demo.sourcePath).toContain(`from "./demos/${file.replace(/\.tsx$/, "")}"`);
      }
    }
  });

  it("orders demos by the spec §10 scenario list the page renders", () => {
    expect(component("button").demos.map((demo) => demo.id)).toEqual([
      "variants",
      "sizes",
      "pending",
      "visually-disabled",
      "predictive-intent",
    ]);
  });

  it("never leaves a documented prop without a description or an unresolved type", () => {
    for (const entry of DOCS_COMPONENTS) {
      for (const part of entry.parts) {
        for (const prop of part.props) {
          expect(prop.type).not.toBe("");
          if (prop.origin === "declared") {
            expect(prop.description, `${part.name}.${prop.name}`).not.toBe("");
          }
        }
      }
    }
  });

  it("resolves the compound parts of a namespace component", () => {
    expect(component("dialog").parts.map((part) => part.name)).toEqual([
      "Dialog.Root",
      "Dialog.Trigger",
      "Dialog.Portal",
      "Dialog.Close",
      "Dialog.Overlay",
      "Dialog.Content",
      "Dialog.Header",
      "Dialog.Footer",
      "Dialog.Title",
      "Dialog.Description",
    ]);
    expect(component("scroll-area").parts.map((part) => part.name)).toEqual([
      "ScrollArea.Root",
      "ScrollArea.Bar",
    ]);
  });

  it("reports RSC status from the declaring module, matching performance.md §3", () => {
    // The §3 classification table is the audit source; a page's status is read off its
    // declaring module, so this is where a stray directive would show up.
    const expected = {
      badge: "server",
      button: "client",
      card: "server",
      dialog: "client",
      field: "client",
      input: "client",
      "input-group": "client",
      item: "client",
      "scroll-area": "client",
      separator: "client",
      textarea: "server",
    } as const;
    expect(Object.keys(expected)).toHaveLength(DOCS_COMPONENTS.length);
    for (const [slug, rsc] of Object.entries(expected)) {
      expect(component(slug).rsc, slug).toBe(rsc);
    }
  });

  it("reads defaults out of the implementation's destructuring", () => {
    const button = component("button").parts[0];
    const isPending = button?.props.find((prop) => prop.name === "isPending");
    expect(isPending?.defaultValue).toBe("false");
    expect(isPending?.description).toContain("data-pending");
    expect(button?.props.find((prop) => prop.name === "predictionZoneSize")?.defaultValue).toBe("30");
    const content = component("dialog").parts.find((part) => part.name === "Dialog.Content");
    expect(content?.props.find((prop) => prop.name === "showCloseButton")?.defaultValue).toBe("true");
    expect(content?.props.find((prop) => prop.name === "size")?.origin).toBe("recipe-axis");
  });

  it("links View source at the implementation on the repo host", () => {
    expect(component("button").sourceUrl).toBe(
      "https://github.com/elmeragroup/ui/blob/main/packages/ui/src/components/button/button.tsx"
    );
    expect(component("button").markdownUrl).toBe("/components/button.md");
  });
});

describe("generated markdown endpoints", () => {
  it("embeds the same demo source the page shows", () => {
    const markdown = readFileSync(join(docsRoot, "public/components/button.md"), "utf8");
    const demo = component("button").demos[0];
    expect(demo).toBeDefined();
    expect(markdown).toContain(demo?.source ?? "");
    expect(markdown).toContain("| Prop | Type | Default | Required | RSC | Description |");
    expect(markdown).toContain("## Tokens consumed");
  });
});
