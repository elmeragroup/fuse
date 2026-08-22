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
  it("covers every authored MDX shell", () => {
    expect(DOCS_COMPONENTS.map((entry) => entry.slug)).toEqual(["button", "dialog", "scroll-area"]);
  });

  it("keeps the demo frame and its displayed source on the same authored file", () => {
    for (const entry of DOCS_COMPONENTS) {
      for (const demo of entry.demos) {
        const authored = readFileSync(join(repoRoot, demo.sourcePath), "utf8");
        // The registry carries the authored bytes verbatim (trailing whitespace trimmed).
        expect(authored.replace(/\s+$/, "")).toBe(demo.source);
        // The renderable copy is the same bytes, in the client graph.
        const copy = readFileSync(
          join(docsRoot, "src/generated", `${demo.modulePath.replace(/^\.\//, "")}.tsx`),
          "utf8"
        );
        // A demo that is not already a client module gets the directive prepended so a
        // namespace compound survives the server/client reference boundary.
        expect(copy.startsWith('"use client";')).toBe(true);
        const withoutDirective = authored.startsWith('"use client";')
          ? copy
          : copy.slice('"use client";\n\n'.length);
        expect(withoutDirective).toBe(authored);
        expect(copy).toContain(`export function ${demo.exportName}`);
      }
    }
  });

  it("orders demos by the spec §10 scenario list in the shell", () => {
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
    for (const entry of DOCS_COMPONENTS) {
      expect(entry.rsc).toBe("client");
      for (const part of entry.parts) {
        expect(part.rsc).toBe("client");
      }
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
