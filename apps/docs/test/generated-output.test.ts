/**
 * What the generation pass produced, checked against its own inputs.
 *
 * Each assertion reads the artifact that *owns* the claim: the page manifest for a page's
 * identity, the committed `api.json` for its API, the demo files for their source, and the
 * markdown endpoint for what it embeds — never a second copy of any of them.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { readRscStatus } from "../scripts/lib/docs-inspection.ts";
import { parseComponentPage } from "../scripts/lib/page-source.ts";
import type { ComponentPageSource } from "../scripts/lib/page-source.ts";
import { repoRelative, repoRoot } from "../scripts/lib/paths.ts";
import { COMPONENT_OUTLINES } from "../src/generated/component-outlines";
import { COMPONENT_PAGES } from "../src/generated/component-pages";
import type { ComponentApiArtifact } from "../src/lib/docs-model";
import { COMPONENT_INVENTORY } from "./component-inventory";

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

/** The component's committed API artifact — the one source of its API data. */
function api(slug: string): ComponentApiArtifact {
  // SAFETY: every api.json is written by one serialiser from `ComponentApiArtifact`, and the
  // drift check (`api-artifact.test.ts`) regenerates and byte-compares each committed file, so
  // a shape that disagrees with the type fails there before this read can see it.
  return JSON.parse(readFileSync(resolveComponentPaths(slug).apiFile, "utf8")) as ComponentApiArtifact;
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
        // Authored in the file, not grafted on in transit.
        expect(source.startsWith('"use client";'), demo.file).toBe(true);
        expect(authored.text, demo.file).toContain(`from "./demos/${demo.file.replace(/\.tsx$/, "")}"`);
        // And the endpoint embeds the very bytes of that file, under its own path.
        expect(markdown, demo.file).toContain(source.trimEnd());
        expect(markdown, demo.file).toContain(`Source: \`${repoRelative(file)}\``);
      }
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
      for (const part of api(slug).parts) {
        expect(part.rsc, `${slug} ${part.name}`).toBe(declaredRsc(part.sourcePath));
      }
      // The page's own status appears on the markdown endpoint, not in the manifest.
      expect(endpoint(slug), slug).toContain(`- RSC: ${reviewed.rsc}`);
    }
  });
});

/** The keys a component outline carries. Anything else would ship to every surface unreviewed. */
const OUTLINE_KEYS = ["demos", "hasTokens", "headings", "markdownUrl", "partNames", "slug", "title"];

describe("component outlines", () => {
  it("carries only the fields client code reads", () => {
    for (const outline of COMPONENT_OUTLINES) {
      expect(Object.keys(outline).toSorted(), outline.slug).toEqual(OUTLINE_KEYS);
    }
    // Both kinds of page are present, so the flag is checked in both directions below.
    expect(new Set(COMPONENT_OUTLINES.map((outline) => outline.hasTokens))).toEqual(new Set([true, false]));
  });

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

  it("outlines each page's depth-2 headings, in page order", () => {
    // Unit under test: the generator's copy of each page's TOC headings into the outline.
    // Oracle: the parsed page. Deeper headings stay out of the TOC.
    for (const outline of COMPONENT_OUTLINES) {
      const authored = authoredPage(outline.slug).parsed;
      expect(outline.headings, outline.slug).toEqual(
        authored.headings
          .filter((heading) => heading.depth === 2)
          .map((heading) => ({ id: heading.id, title: heading.title }))
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
      expect(outline.demos, outline.slug).toEqual(authored.demos.map(({ id, title }) => ({ id, title })));
      expect(new Set(outline.demos.map((demo) => demo.id)).size, outline.slug).toBe(outline.demos.length);
      for (const demo of outline.demos) {
        expect(demo.id, `${outline.slug}.${demo.id}`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(demo.title.trim(), `${outline.slug}.${demo.id}`).not.toBe("");
      }
    }
  });

  it("names one TOC anchor per API part, exactly as the committed api.json names them", () => {
    // Unit under test: the outline's part names. Oracle: the committed API artifact.
    for (const outline of COMPONENT_OUTLINES) {
      expect(outline.partNames, outline.slug).toEqual(api(outline.slug).parts.map((part) => part.name));
    }
  });
});

describe("committed api.json", () => {
  it("walks only the export names resolveComponentPaths lists", () => {
    expect(resolveComponentPaths("table").apiExportNames).toEqual(["Table", "VerticalTable"]);
    expect(resolveComponentPaths("checkbox-card").apiExportNames).toEqual(["CheckboxCard"]);
    expect(resolveComponentPaths("checkbox").apiExportNames).toEqual([
      "Checkbox",
      "CheckboxGroup",
      "CheckboxItem",
      "CheckboxItemGroup",
      "CheckboxDescription",
    ]);
    expect(resolveComponentPaths("radio-group").apiExportNames).toEqual([
      "RadioGroup",
      "RadioGroupItem",
      "Radio",
      "RadioItem",
      "RadioItemGroup",
      "RadioIconButton",
    ]);
    expect(resolveComponentPaths("combobox").apiExportNames).toEqual([
      "ComboboxField",
      "Combobox",
      "useComboboxAnchor",
    ]);
    expect(resolveComponentPaths("autocomplete").apiExportNames).toEqual([
      "AutocompleteField",
      "Autocomplete",
    ]);
    // KbdGroup has its own props type, so its table guards it against drift too.
    expect(resolveComponentPaths("kbd").apiExportNames).toEqual(["Kbd", "KbdGroup"]);
    expect(resolveComponentPaths("button").apiExportNames).toEqual(["Button"]);
    expect(resolveComponentPaths("meter").apiExportNames).toEqual(["Meter"]);
    expect(resolveComponentPaths("pagination").apiExportNames).toEqual(["Pagination"]);
    expect(resolveComponentPaths("breadcrumb").apiExportNames).toEqual(["Breadcrumb"]);
    expect(resolveComponentPaths("alert").apiExportNames).toEqual(["Alert"]);
    expect(resolveComponentPaths("ui-providers").entry).toBe("@elmeragroup/fuse/react-aria/ui-providers");
    expect(resolveComponentPaths("ui-providers").apiExportNames).toEqual(["UiProviders"]);
    expect(resolveComponentPaths("link").entry).toBe("@elmeragroup/fuse/react-aria/link");
    expect(resolveComponentPaths("link").apiExportNames).toEqual(["Link"]);
    expect(resolveComponentPaths("search-field").entry).toBe("@elmeragroup/fuse/react-aria/search-field");
    expect(resolveComponentPaths("search-field").apiExportNames).toEqual(["SearchField"]);
    expect(resolveComponentPaths("file-trigger").entry).toBe("@elmeragroup/fuse/react-aria/file-trigger");
    expect(resolveComponentPaths("file-trigger").apiExportNames).toEqual(["FileTrigger"]);
    expect(resolveComponentPaths("focusable").entry).toBe("@elmeragroup/fuse/react-aria/focusable");
    expect(resolveComponentPaths("focusable").apiExportNames).toEqual(["Focusable", "useFocusable"]);
    expect(resolveComponentPaths("grid-list").entry).toBe("@elmeragroup/fuse/react-aria/grid-list");
    expect(resolveComponentPaths("grid-list").apiExportNames).toEqual(["GridList", "GridListItem"]);
    expect(resolveComponentPaths("date-field").entry).toBe("@elmeragroup/fuse/react-aria/date-field");
    expect(resolveComponentPaths("date-field").apiExportNames).toEqual(["DateField", "DateInput"]);
    expect(resolveComponentPaths("calendar").entry).toBe("@elmeragroup/fuse/react-aria/calendar");
    expect(resolveComponentPaths("calendar").apiExportNames).toEqual([
      "Calendar",
      "CalendarHeader",
      "CalendarGridHeader",
    ]);
    expect(resolveComponentPaths("range-calendar").entry).toBe("@elmeragroup/fuse/react-aria/range-calendar");
    expect(resolveComponentPaths("range-calendar").apiExportNames).toEqual(["RangeCalendar"]);
    expect(resolveComponentPaths("date-picker").entry).toBe("@elmeragroup/fuse/react-aria/date-picker");
    expect(resolveComponentPaths("date-picker").apiExportNames).toEqual([
      "DatePicker",
      "DatePickerPresetGroup",
      "DatePickerPresetItem",
    ]);
    expect(resolveComponentPaths("date-range-picker").entry).toBe(
      "@elmeragroup/fuse/react-aria/date-range-picker"
    );
    expect(resolveComponentPaths("date-range-picker").apiExportNames).toEqual([
      "DateRangePicker",
      "DateRangePickerPresetGroup",
      "DateRangePickerPresetItem",
    ]);
  });

  it("documents DateInput's own props and the forwarded RAC remainder", () => {
    const dateInput = api("date-field").parts.find((part) => part.name === "DateInput");
    expect(dateInput?.props.length).toBeGreaterThan(0);
    expect(dateInput?.props.map((prop) => prop.name)).toEqual(expect.arrayContaining(["slot", "className"]));
    expect(dateInput?.props.map((prop) => prop.name)).not.toContain("children");
    expect(dateInput?.forwardedCount).toBeGreaterThan(0);
    expect(dateInput?.forwardedFrom).toEqual(expect.arrayContaining(["react-aria-components"]));
  });

  it("never leaves a documented prop without a description or an unresolved type, and publishes only documented dependency props", () => {
    for (const entry of COMPONENT_PAGES) {
      for (const part of api(entry.slug).parts) {
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
    for (const entry of COMPONENT_PAGES) {
      const committed = api(entry.slug).parts;
      // Every facade export yields at least one part — a facade that only re-exports a
      // dependency publishes it as a part with no props and the dependency in `forwardedFrom`.
      const roots = resolveComponentPaths(entry.slug).apiExportNames;
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
    const alertContent = api("alert-dialog").parts.find((part) => part.name === "AlertDialog.Content");
    expect(alertContent?.props.find((prop) => prop.name === "variant")?.defaultValue).toBe('"destructive"');
    expect(alertContent?.props.find((prop) => prop.name === "showCloseButton")).toBeUndefined();
    expect(alertContent?.props.find((prop) => prop.name === "isPerformingAction")?.defaultValue).toBe(
      "false"
    );
    const dropdownContent = api("dropdown-menu").parts.find((part) => part.name === "DropdownMenu.Content");
    expect(dropdownContent?.props.find((prop) => prop.name === "align")?.defaultValue).toBe('"start"');
    expect(dropdownContent?.props.find((prop) => prop.name === "side")?.defaultValue).toBe('"bottom"');
    const dropdownSubContent = api("dropdown-menu").parts.find(
      (part) => part.name === "DropdownMenu.SubContent"
    );
    expect(dropdownSubContent?.props.find((prop) => prop.name === "alignOffset")?.defaultValue).toBe("-3");
    expect(dropdownSubContent?.props.find((prop) => prop.name === "side")?.defaultValue).toBe('"right"');
    const dropdownItem = api("dropdown-menu").parts.find((part) => part.name === "DropdownMenu.Item");
    expect(dropdownItem?.props.find((prop) => prop.name === "variant")?.defaultValue).toBe('"default"');
    // Command's search pins `inline` and `open` and sets its own highlight defaults. The Root and
    // each Page destructure these props.
    for (const partName of ["Command.Root", "Command.Page"]) {
      const commandSearch = api("command").parts.find((part) => part.name === partName);
      const prop = (name: string) => commandSearch?.props.find((candidate) => candidate.name === name);
      expect(prop("autoHighlight")?.defaultValue, partName).toBe('"always"');
      expect(prop("keepHighlight")?.defaultValue, partName).toBe("true");
      expect(prop("inline"), partName).toBeUndefined();
    }
    const commandPage = api("command").parts.find((part) => part.name === "Command.Page");
    expect(commandPage?.props.find((prop) => prop.name === "open")).toBeUndefined();
    const selectTrigger = api("select").parts.find((part) => part.name === "Select.Trigger");
    expect(selectTrigger?.props.find((prop) => prop.name === "size")?.defaultValue).toBe('"default"');
    const selectContent = api("select").parts.find((part) => part.name === "Select.Content");
    expect(selectContent?.props.find((prop) => prop.name === "alignItemWithTrigger")?.defaultValue).toBe(
      "true"
    );
    expect(selectContent?.props.find((prop) => prop.name === "align")?.defaultValue).toBe('"center"');
    const checkboxItemGroup = api("checkbox").parts.find((part) => part.name === "CheckboxItemGroup");
    expect(checkboxItemGroup?.props.find((prop) => prop.name === "orientation")?.defaultValue).toBe(
      '"vertical"'
    );
    const radioGroup = api("radio-group").parts.find((part) => part.name === "RadioGroup");
    expect(radioGroup?.props.find((prop) => prop.name === "orientation")?.defaultValue).toBe('"vertical"');
    expect(radioGroup?.props.find((prop) => prop.name === "value")?.description).toContain("passed through");
    expect(radioGroup?.props.find((prop) => prop.name === "value")?.description).not.toContain(
      "value ?? undefined"
    );
    expect(radioGroup?.props.find((prop) => prop.name === "isPending")?.description).toContain("aria-busy");
    const radioItemGroup = api("radio-group").parts.find((part) => part.name === "RadioItemGroup");
    expect(radioItemGroup?.props.find((prop) => prop.name === "orientation")?.defaultValue).toBe(
      '"vertical"'
    );
    expect(radioItemGroup?.props.find((prop) => prop.name === "value")?.description).toContain(
      "passed through"
    );
    const radioIconButton = api("radio-group").parts.find((part) => part.name === "RadioIconButton");
    expect(radioIconButton?.props.find((prop) => prop.name === "size")?.defaultValue).toBe('"icon"');
    expect(radioIconButton?.props.find((prop) => prop.name === "aria-label")?.required).toBe(true);
    const radioItem = api("radio-group").parts.find((part) => part.name === "RadioItem");
    expect(radioItem?.props.find((prop) => prop.name === "controlPosition")?.defaultValue).toBe('"start"');
    const checkboxCard = api("checkbox-card").parts.find((part) => part.name === "CheckboxCard");
    expect(checkboxCard?.props.find((prop) => prop.name === "variant")?.defaultValue).toBe('"default"');
    expect(checkboxCard?.props.find((prop) => prop.name === "title")?.required).toBe(true);
    expect(checkboxCard?.props.find((prop) => prop.name === "description")?.required).toBe(true);
    expect(checkboxCard?.props.find((prop) => prop.name === "render")).toBeUndefined();
    expect(checkboxCard?.props.find((prop) => prop.name === "disabled")).toBeUndefined();
    expect(checkboxCard?.props.find((prop) => prop.name === "className")).toBeUndefined();
  });
});

describe("generated markdown endpoints", () => {
  it("groups selected Base UI primitive props without expanding React props", () => {
    const markdown = endpoint("button");

    expect(markdown).toContain("#### Base UI primitive props");
    expect(markdown).toContain("| `focusableWhenDisabled` | `boolean \\| undefined` | `false`");
    expect(markdown).not.toContain("| `onClick` |");
  });

  it("carries every part of the committed API, and the tokens section", () => {
    for (const entry of COMPONENT_PAGES) {
      const markdown = endpoint(entry.slug);
      expect(markdown, entry.slug).toContain("## API reference");
      for (const part of api(entry.slug).parts) {
        // Per-part RSC rides on the heading, matching the HTML page's indicator.
        expect(markdown, part.name).toContain(`### ${part.name} · RSC: ${part.rsc}`);
        // Either the part's own props as a table, or the line that says it has none —
        // a part that forwards everything is documented as such, not silently skipped.
        expect(
          markdown.includes("| Prop | Type | Default | Required | Description |") ||
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
