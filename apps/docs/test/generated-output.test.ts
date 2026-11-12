/**
 * What the generation pass produced, checked against its own inputs.
 *
 * Each assertion reads the artifact that *owns* the claim: the page manifest for a page's
 * identity, the committed `api.json` for its API, the demo files for their source, and the
 * markdown endpoint for what it embeds — never a second copy of any of them.
 */

import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { SERVER_DEMOS } from "../scripts/lib/docs-inspection.ts";
import { parseComponentPage } from "../scripts/lib/page-source.ts";
import type { ComponentPageSource } from "../scripts/lib/page-source.ts";
import { repoRelative, repoRoot } from "../scripts/lib/paths.ts";
import { readRscStatus } from "../scripts/lib/rsc-status.ts";
import { COMPONENT_OUTLINES } from "../src/generated/component-outlines";
import { COMPONENT_PAGES } from "../src/generated/component-pages";
import type { ComponentApiArtifact } from "../src/lib/docs-model";
import { ALIAS_PAGES, COMPONENT_INVENTORY } from "./component-inventory";

const here = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(here, "..");

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

/**
 * Every part a page's API reference renders, read from its committed artifacts: its own `api.json`,
 * then each extra entry's `<entry>.api.json`, in reading order.
 */
function pageParts(slug: string): ComponentApiArtifact["parts"] {
  return resolveComponentPaths(slug).apis.flatMap(
    // SAFETY: as for `api` above, one serialiser writes every committed artifact.
    ({ apiFile }) => (JSON.parse(readFileSync(apiFile, "utf8")) as ComponentApiArtifact).parts
  );
}

/** The component's generated markdown endpoint. */
function endpoint(slug: string): string {
  return readFileSync(join(docsRoot, "public/components", `${slug}.md`), "utf8");
}

/** Read each part's declaring module independently of the generated API artifact. */
function declaredRsc(sourcePath: string): string {
  return readRscStatus(readFileSync(join(repoRoot, sourcePath), "utf8"));
}

/** The keys a manifest entry carries. Anything else would reach the server's pages unreviewed. */
const MANIFEST_ENTRY_KEYS = ["lede", "markdownUrl", "slug", "sourcePath", "sourceUrl", "title", "tokens"];

describe("component page manifest", () => {
  it("covers every authored component page", () => {
    // Unit under test: the generated manifest's page set. Oracle: the reviewed inventory,
    // whose slug order is the alphabetical order the generator globs to.
    expect(COMPONENT_PAGES.map((entry) => entry.slug)).toEqual([...COMPONENT_INVENTORY.keys()]);
  });

  it("carries page metadata only, with no demo source and no API data", () => {
    // The frame reads demo source from its file and the reference reads api.json, so
    // neither travels through the manifest.
    const serialized = JSON.stringify(COMPONENT_PAGES);
    expect(serialized).not.toContain('"source"');
    expect(serialized).not.toContain('"props"');
    expect(serialized).not.toContain("use client");
    for (const entry of COMPONENT_PAGES) {
      expect(Object.keys(entry).toSorted(), entry.slug).toEqual(MANIFEST_ENTRY_KEYS);
    }
  });

  it("renders the matching API reference from every authored component page", () => {
    for (const entry of COMPONENT_PAGES) {
      expect(authoredPage(entry.slug).text, entry.slug).toContain(`<ApiReference slug="${entry.slug}" />`);
    }
  });

  it("keeps the demo frame and its displayed source on the same authored file", () => {
    for (const entry of COMPONENT_PAGES) {
      // The page imports each demo from its own route directory, and the frame's source is
      // that very file — read once, never copied.
      const authored = authoredPage(entry.slug);
      const markdown = endpoint(entry.slug);
      for (const demo of authored.parsed.demos) {
        const file = join(resolveComponentPaths(entry.slug).demosDir, demo.file);
        const source = readFileSync(file, "utf8");
        // Authored in the file, not grafted on in transit. Only a reviewed server demo omits it.
        expect(source.startsWith('"use client";'), demo.file).toBe(!SERVER_DEMOS.has(repoRelative(file)));
        expect(authored.text, demo.file).toContain(`from "./demos/${demo.file.replace(/\.tsx$/, "")}"`);
        // And the endpoint embeds the very bytes of that file, under its own path.
        expect(markdown, demo.file).toContain(source.trimEnd());
        expect(markdown, demo.file).toContain(`Source: \`${repoRelative(file)}\``);
      }
    }
  });

  it("renders every reviewed server demo on its page, so the carve-out cannot go stale", () => {
    expect(SERVER_DEMOS.size).toBeGreaterThan(0);
    for (const demo of SERVER_DEMOS) {
      const slug = /\/components\/([^/]+)\/demos\//u.exec(demo)?.[1] ?? "";
      expect(
        authoredPage(slug).parsed.demos.map(({ file }) => file),
        demo
      ).toContain(basename(demo));
    }
  });

  it("lists exactly the demo files on disk for every reviewed page", () => {
    // Unit under test: the reviewed inventory's demo lists. Oracle: each page's demos
    // directory. Sorting both sides also rejects a file listed twice.
    for (const [slug, reviewed] of COMPONENT_INVENTORY) {
      expect(reviewed.demos.length, slug).toBeGreaterThan(0);
      // A demo file is a `.tsx` module, as the generator's never-rendered check counts them.
      const onDisk = readdirSync(resolveComponentPaths(slug).demosDir).filter((entry) =>
        entry.endsWith(".tsx")
      );
      expect(reviewed.demos.toSorted(), slug).toEqual(onDisk.toSorted());
    }
  });

  it("reports per-part directives and the reviewed page RSC status", () => {
    for (const [slug, reviewed] of COMPONENT_INVENTORY) {
      // Each part's badge is the leading directive of the module that declares it.
      for (const part of ALIAS_PAGES.has(slug) ? [] : pageParts(slug)) {
        expect(part.rsc, `${slug} ${part.name}`).toBe(declaredRsc(part.sourcePath));
      }
      // The page's own status appears on the markdown endpoint, not in the manifest. A page in the
      // Usage shape mirrors the page, which names no page-wide status; its parts carry theirs.
      if (authoredPage(slug).parsed.usage === null) {
        expect(endpoint(slug), slug).toContain(`- RSC: ${reviewed.rsc}`);
      }
    }
  });
});

describe("component outlines", () => {
  it("agrees with the full manifest on every page's identity and on whether it lists tokens", () => {
    // Unit under test: the client outlines' identity fields and token flag. Oracle: the full
    // manifest from the same generation run, which the server renders the same pages from.
    expect(
      COMPONENT_OUTLINES.map(({ slug, title, markdownUrl, hasTokens }) => ({
        slug,
        title,
        markdownUrl,
        hasTokens,
      }))
    ).toEqual(
      COMPONENT_PAGES.map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        markdownUrl: entry.markdownUrl,
        hasTokens: entry.tokens.length > 0,
      }))
    );
  });

  it("outlines each page's depth-2 headings and demos in page order, with its examples nested", () => {
    // Unit under test: the generator's TOC skeleton. Oracle: the parsed page, whose headings and
    // demos the outline must list in the page's order. Deeper headings stay out of the TOC.
    for (const outline of COMPONENT_OUTLINES) {
      const authored = authoredPage(outline.slug).parsed;
      const flat = outline.sections.flatMap((item) => [
        item.id,
        ...(item.children ?? []).map((child) => child.id),
      ]);
      expect(flat, outline.slug).toEqual(
        authored.sections
          .filter((section) => section.depth === 2 || section.kind === "demo")
          .map((section) => section.id)
      );
    }
  });

  it("carries every demo the page renders into the outline, in order, each with a unique URL-safe ID and a nonempty title", () => {
    // Unit under test: the generator's copy of each page's demos into the outline. Oracle:
    // the parsed page's id and title pairs, compared whole so no demo field beyond them (its
    // source, say) ships to the client. The parser itself is tested against literal pages in
    // docs-pipeline.
    for (const outline of COMPONENT_OUTLINES) {
      const authored = authoredPage(outline.slug).parsed;
      const demos = outline.sections
        .flatMap((item) => [item, ...(item.children ?? [])])
        .filter((item) => item.demo === true);
      expect(demos, outline.slug).toEqual(authored.demos.map(({ id, title }) => ({ id, title, demo: true })));
      expect(new Set(demos.map((demo) => demo.id)).size, outline.slug).toBe(demos.length);
      for (const demo of demos) {
        expect(demo.id, `${outline.slug}.${demo.id}`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(demo.title.trim(), `${outline.slug}.${demo.id}`).not.toBe("");
      }
    }
  });

  it("gives no demo the anchor ID of a heading on its page", () => {
    // Unit under test: each page's demo IDs. Oracle: a document's IDs are unique, so a demo
    // frame's heading never shares its ID with a prose heading; a shared one breaks the anchor
    // and the frame's hydration marker.
    for (const outline of COMPONENT_OUTLINES) {
      const authored = authoredPage(outline.slug).parsed;
      const headingIds = new Set(
        authored.sections.flatMap((section) => (section.kind === "heading" ? [section.id] : []))
      );
      expect(
        authored.demos.map((demo) => demo.id).filter((id) => headingIds.has(id)),
        outline.slug
      ).toEqual([]);
    }
  });

  it("names one TOC anchor per API part, exactly as the committed api.json names them", () => {
    // Unit under test: the outline's part names. Oracle: the committed API artifact, and the
    // alias pages CONTRACT.md section 13 names, whose reference is one sentence with no part anchor.
    for (const outline of COMPONENT_OUTLINES) {
      expect(outline.partNames, outline.slug).toEqual(
        ALIAS_PAGES.has(outline.slug) ? [] : pageParts(outline.slug).map((part) => part.name)
      );
    }
  });
});

describe("committed api.json", () => {
  it("lists a page's own entry first, then each extra entry it documents", () => {
    // Oracle: `@elmeragroup/fuse/command` exports `Command`, and `@elmeragroup/fuse/command-virtual`,
    // which has no page of its own, exports `CommandVirtual`; the Command page documents both.
    expect(
      resolveComponentPaths("command").apis.map(({ slug, entry, exportNames }) => ({
        slug,
        entry,
        exportNames,
      }))
    ).toEqual([
      { slug: "command", entry: "@elmeragroup/fuse/command", exportNames: ["Command"] },
      {
        slug: "command-virtual",
        entry: "@elmeragroup/fuse/command-virtual",
        exportNames: ["CommandVirtual"],
      },
    ]);
    expect(resolveComponentPaths("button").apis.map(({ slug }) => slug)).toEqual(["button"]);
  });

  it("documents CommandVirtual.List, which has no page of its own, on the Command page", () => {
    // Unit under test: the Command page's generated API output. Oracle: `CommandVirtualListProps` in
    // packages/fuse/src/components/command-virtual/command-virtual.tsx, which declares `children`,
    // `estimateSize` and `overscan` with `@default 8`, and the facade it is imported from.
    const list = pageParts("command").find((part) => part.name === "CommandVirtual.List");
    expect(list?.sourcePath).toBe("packages/fuse/src/components/command-virtual/command-virtual.tsx");
    expect(list?.props.map((prop) => prop.name)).toEqual(
      expect.arrayContaining(["children", "estimateSize", "overscan"])
    );
    expect(list?.props.find((prop) => prop.name === "overscan")?.defaultValue).toBe("8");
    expect(COMPONENT_OUTLINES.find(({ slug }) => slug === "command")?.partNames).toContain(
      "CommandVirtual.List"
    );
    const markdown = endpoint("command");
    expect(markdown).toContain('- Import: `import { ... } from "@elmeragroup/fuse/command-virtual";`');
    expect(markdown).toContain("### CommandVirtual.List · RSC: client");
    expect(markdown).toContain("| `estimateSize` |");
  });

  it("never leaves a documented prop without a description or an unresolved type, and publishes only documented dependency props", () => {
    for (const entry of COMPONENT_PAGES.filter(({ slug }) => !ALIAS_PAGES.has(slug))) {
      for (const part of pageParts(entry.slug)) {
        for (const prop of part.props) {
          expect(prop.type).not.toBe("");
          if (prop.origin === "declared") {
            expect(prop.description, `${part.name}.${prop.name}`).not.toBe("");
          }
          // A dependency prop is published only when its dependency documents it. The origin
          // is read from the committed artifact's own discriminant, not the site's classifier.
          if (prop.origin !== "declared" && prop.origin !== "recipe-axis") {
            expect(prop.origin.packageName).toBe("@base-ui/react");
            expect(prop.description, `${part.name}.${prop.name}`).not.toBe("");
          }
        }
      }
    }
  });

  it("publishes only parts rooted at a facade export, each named once", () => {
    for (const entry of COMPONENT_PAGES.filter(({ slug }) => !ALIAS_PAGES.has(slug))) {
      const committed = pageParts(entry.slug);
      // Every facade export yields at least one part — a facade that only re-exports a
      // dependency publishes it as a part with no props and the dependency in `forwardedFrom`.
      const roots = resolveComponentPaths(entry.slug).apis.flatMap(({ exportNames }) => exportNames);
      expect(committed.length, entry.slug).toBeGreaterThan(0);
      expect(new Set(committed.map((part) => part.name)).size, entry.slug).toBe(committed.length);

      // A part is either a named facade export or a member of one: an unrequested
      // callable object on the same entry (`buttonVariants`, `METER_CONSTANTS`,
      // `checkboxCardStyles`) is never walked into the table.
      for (const part of committed) {
        expect(
          roots.some((root) => part.name === root || part.name.startsWith(`${root}.`)),
          `${entry.slug} ${part.name}`
        ).toBe(true);
        for (const prop of part.props) {
          expect(prop.type, `${entry.slug} ${part.name}.${prop.name}`).not.toBe("");
        }
      }
    }
  });
});

describe("generated markdown endpoints", () => {
  it("groups selected Base UI primitive props without expanding React props", () => {
    const markdown = endpoint("button");

    expect(markdown).toContain("#### Base UI primitive props");
    expect(markdown).toContain("| `focusableWhenDisabled` | `boolean \\| undefined` | `false`");
    expect(markdown).not.toContain("| `onClick` |");
  });
});
