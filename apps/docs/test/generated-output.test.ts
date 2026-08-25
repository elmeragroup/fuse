/**
 * What the generation pass produced, checked against its own inputs.
 *
 * Each assertion reads the artifact that *owns* the claim: the page manifest for a page's
 * identity, the committed `api.json` for its API, the demo files for their source, and the
 * markdown endpoint for what it embeds — never a second copy of any of them.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { parseComponentPage } from "../scripts/lib/page-source.ts";
import type { ComponentPageSource } from "../scripts/lib/page-source.ts";
import { repoRelative } from "../scripts/lib/paths.ts";
import { COMPONENT_PAGES } from "../src/generated/component-pages";
import type { ComponentApiArtifact, ComponentPageEntry } from "../src/lib/docs-model";
import { normalizeDemoSource } from "../src/lib/docs-model";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");

function page(slug: string): ComponentPageEntry {
  const found = COMPONENT_PAGES.find((entry) => entry.slug === slug);
  if (found === undefined) {
    throw new Error(`the generated manifest has no "${slug}" page`);
  }
  return found;
}

type AuthoredPage = {
  text: string;
  parsed: ComponentPageSource;
};

/** The component's authored `page.mdx`, read the way the generator reads it. */
function authoredPage(slug: string): AuthoredPage {
  const file = resolveComponentPaths(slug).pageFile;
  const text = readFileSync(file, "utf8");
  return { text, parsed: parseComponentPage(text, slug, file) };
}

/** The component's committed API artifact — the one source of its API data (§8). */
function api(slug: string): ComponentApiArtifact {
  // SAFETY: every api.json is written by one serialiser from `ComponentApiArtifact`, and the
  // drift check (`api-artifact.test.ts`) regenerates and byte-compares each committed file, so
  // a shape that disagrees with the type fails there before this read can see it.
  return JSON.parse(readFileSync(resolveComponentPaths(slug).apiFile, "utf8")) as ComponentApiArtifact;
}

/** The component's generated markdown endpoint (§9). */
function endpoint(slug: string): string {
  return readFileSync(join(docsRoot, "public/components", `${slug}.md`), "utf8");
}

describe("component page manifest", () => {
  it("covers every authored component page", () => {
    expect(COMPONENT_PAGES.map((entry) => entry.slug)).toEqual([
      "badge",
      "button",
      "card",
      "dialog",
      "field",
      "heading",
      "input",
      "input-group",
      "item",
      "popover",
      "scroll-area",
      "separator",
      "sheet",
      "skeleton",
      "span",
      "text",
      "text-field",
      "textarea",
      "timeline-list",
      "toggle",
      "tooltip",
    ]);
  });

  it("carries page metadata only — no demo source, no API data", () => {
    // The slim manifest is the point: a demo's source is read from its file at render time
    // and the reference reads api.json, so neither may travel through here (§6, §8).
    const serialized = JSON.stringify(COMPONENT_PAGES);
    expect(serialized).not.toContain('"source"');
    expect(serialized).not.toContain('"props"');
    expect(serialized).not.toContain("use client");
    for (const entry of COMPONENT_PAGES) {
      // What the manifest does carry about the API is TOC material — one anchor per part —
      // and it has to name exactly the parts the committed artifact describes.
      expect(entry.partNames.length, entry.slug).toBeGreaterThan(0);
      expect(entry.partNames, entry.slug).toEqual(api(entry.slug).parts.map((part) => part.name));
    }
  });

  it("keeps the demo frame and its displayed source on the same authored file", () => {
    for (const entry of COMPONENT_PAGES) {
      // The page imports each demo from its own route directory, and the frame's source is
      // that very file — read once, never copied (docs-site.md §6).
      const authored = authoredPage(entry.slug);
      const markdown = endpoint(entry.slug);
      expect(authored.parsed.demos.map((demo) => demo.id)).toEqual(entry.demos.map((demo) => demo.id));
      for (const demo of authored.parsed.demos) {
        const file = join(resolveComponentPaths(entry.slug).demosDir, demo.file);
        const source = readFileSync(file, "utf8");
        // Authored in the file, not grafted on in transit.
        expect(source.startsWith('"use client";'), demo.file).toBe(true);
        expect(authored.text, demo.file).toContain(`from "./demos/${demo.file.replace(/\.tsx$/, "")}"`);
        // And the endpoint embeds the very bytes of that file, under its own path (§9).
        expect(markdown, demo.file).toContain(normalizeDemoSource(source));
        expect(markdown, demo.file).toContain(`Source: \`${repoRelative(file)}\``);
      }
    }
  });

  it("orders demos by the spec §10 scenario list the page renders", () => {
    expect(page("button").demos.map((demo) => demo.id)).toEqual([
      "variants",
      "sizes",
      "pending",
      "visually-disabled",
      "predictive-intent",
    ]);
    expect(page("skeleton").demos.map((demo) => demo.id)).toEqual(["basic", "card"]);
    expect(page("timeline-list").demos.map((demo) => demo.id)).toEqual(["basic", "rich"]);
    expect(page("sheet").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "sides",
      "sizes",
      "form",
      "scrolling",
    ]);
    expect(page("tooltip").demos.map((demo) => demo.id)).toEqual(["basic", "sides", "delay", "controlled"]);
  });

  it("links View source at the implementation on the repo host", () => {
    expect(page("button").sourceUrl).toBe(
      "https://github.com/elmeragroup/ui/blob/main/packages/ui/src/components/button/button.tsx"
    );
    expect(page("button").markdownUrl).toBe("/components/button.md");
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
      heading: "client",
      input: "client",
      "input-group": "client",
      item: "client",
      popover: "client",
      "scroll-area": "client",
      separator: "client",
      sheet: "client",
      skeleton: "server",
      span: "client",
      text: "client",
      "text-field": "client",
      textarea: "server",
      "timeline-list": "server",
      toggle: "client",
      tooltip: "client",
    } as const;
    expect(Object.keys(expected)).toHaveLength(COMPONENT_PAGES.length);
    for (const [slug, rsc] of Object.entries(expected)) {
      expect(page(slug).rsc, slug).toBe(rsc);
    }
  });
});

describe("committed api.json", () => {
  it("never leaves a documented prop without a description or an unresolved type", () => {
    for (const entry of COMPONENT_PAGES) {
      for (const part of api(entry.slug).parts) {
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
    expect(api("dialog").parts.map((part) => part.name)).toEqual([
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
    expect(api("popover").parts.map((part) => part.name)).toEqual([
      "Popover.Root",
      "Popover.Trigger",
      "Popover.Content",
      "Popover.Header",
      "Popover.Title",
      "Popover.Description",
    ]);
    expect(api("sheet").parts.map((part) => part.name)).toEqual([
      "Sheet.Root",
      "Sheet.Trigger",
      "Sheet.Close",
      "Sheet.Portal",
      "Sheet.Overlay",
      "Sheet.Content",
      "Sheet.Header",
      "Sheet.Body",
      "Sheet.Footer",
      "Sheet.Title",
      "Sheet.Description",
    ]);
    expect(api("tooltip").parts.map((part) => part.name)).toEqual([
      "Tooltip.Provider",
      "Tooltip.Root",
      "Tooltip.Trigger",
      "Tooltip.Content",
    ]);
    expect(api("scroll-area").parts.map((part) => part.name)).toEqual(["ScrollArea.Root", "ScrollArea.Bar"]);
  });

  it("reads defaults out of the implementation's destructuring", () => {
    const button = api("button").parts[0];
    const isPending = button?.props.find((prop) => prop.name === "isPending");
    expect(isPending?.defaultValue).toBe("false");
    expect(isPending?.description).toContain("data-pending");
    expect(button?.props.find((prop) => prop.name === "predictionZoneSize")?.defaultValue).toBe("30");
    const content = api("dialog").parts.find((part) => part.name === "Dialog.Content");
    expect(content?.props.find((prop) => prop.name === "showCloseButton")?.defaultValue).toBe("true");
    expect(content?.props.find((prop) => prop.name === "size")?.origin).toBe("recipe-axis");
    const popoverContent = api("popover").parts.find((part) => part.name === "Popover.Content");
    expect(popoverContent?.props.find((prop) => prop.name === "showArrow")?.defaultValue).toBe("false");
    const sheetContent = api("sheet").parts.find((part) => part.name === "Sheet.Content");
    expect(sheetContent?.props.find((prop) => prop.name === "showCloseButton")?.defaultValue).toBe("true");
    expect(sheetContent?.props.find((prop) => prop.name === "size")?.origin).toBe("recipe-axis");
    const sheetRoot = api("sheet").parts.find((part) => part.name === "Sheet.Root");
    expect(sheetRoot?.props.find((prop) => prop.name === "side")?.defaultValue).toBe('"right"');
    const tooltipProvider = api("tooltip").parts.find((part) => part.name === "Tooltip.Provider");
    expect(tooltipProvider?.props.find((prop) => prop.name === "delay")?.defaultValue).toBe("0");
    const tooltipRoot = api("tooltip").parts.find((part) => part.name === "Tooltip.Root");
    expect(tooltipRoot?.props.find((prop) => prop.name === "delay")?.description).toContain("skip-delay");
    const tooltipContent = api("tooltip").parts.find((part) => part.name === "Tooltip.Content");
    expect(tooltipContent?.props.find((prop) => prop.name === "side")?.defaultValue).toBe('"top"');
  });
});

describe("generated markdown endpoints", () => {
  it("carries every part of the committed API, and the tokens section", () => {
    for (const entry of COMPONENT_PAGES) {
      const markdown = endpoint(entry.slug);
      expect(markdown, entry.slug).toContain("## API reference");
      for (const part of api(entry.slug).parts) {
        expect(markdown, part.name).toContain(`### ${part.name}`);
        // Either the part's own props as a table, or the line that says it has none —
        // a part that forwards everything is documented as such, not silently skipped.
        expect(
          markdown.includes("| Prop | Type | Default | Required | RSC | Description |") ||
            markdown.includes("No own props"),
          part.name
        ).toBe(true);
        for (const prop of part.props) {
          expect(markdown, `${part.name}.${prop.name}`).toContain(`| \`${prop.name}\` |`);
        }
      }
      if (entry.tokens.length > 0) {
        expect(markdown, entry.slug).toContain("## Tokens consumed");
        for (const token of entry.tokens) {
          expect(markdown, token.name).toContain(`- \`${token.name}\``);
        }
      }
    }
  });
});
