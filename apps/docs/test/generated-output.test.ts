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

import {
  extractLibraryApi,
  openLibraryProject,
  readPartPropFact,
  readRscStatus,
} from "../scripts/lib/api.ts";
import type { ComponentApi, LibraryProject } from "../scripts/lib/api.ts";
import { resolveComponentPaths } from "../scripts/lib/components.ts";
import { docsApiInventory } from "../scripts/lib/docs-inspection.ts";
import { ProblemLog } from "../scripts/lib/errors.ts";
import { parseComponentPage } from "../scripts/lib/page-source.ts";
import type { ComponentPageSource } from "../scripts/lib/page-source.ts";
import { repoRelative, repoRoot } from "../scripts/lib/paths.ts";
import { COMPONENT_PAGES } from "../src/generated/component-pages";
import type { ComponentApiArtifact, ComponentPageEntry } from "../src/lib/docs-model";
import { dependencyPackageName, normalizeDemoSource } from "../src/lib/docs-model";

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

/**
 * Runs the pass's own extraction — the one `extractLibraryApi` every consumer calls —
 * so an expectation about parts, forwarded counts or accepted props is read off the
 * model the artifacts were written from, never off a second table maintained by hand.
 */
function withLibraryApi(assert: (model: readonly ComponentApi[], context: LibraryProject) => void): void {
  const context = openLibraryProject();
  try {
    const problems = new ProblemLog();
    const model = extractLibraryApi(context, docsApiInventory(), problems);
    // Generation fails on any of these, so the model a passing build produced has none.
    expect(problems.problems).toEqual([]);
    assert(model, context);
  } finally {
    context.close();
  }
}

/** The declaring module's own directive — the fact performance.md §3 classifies on. */
function declaredRsc(sourcePath: string): string {
  return readRscStatus(readFileSync(join(repoRoot, sourcePath), "utf8"));
}

describe("component page manifest", () => {
  it("covers every authored component page", () => {
    expect(COMPONENT_PAGES.map((entry) => entry.slug)).toEqual([
      "accordion",
      "alert",
      "alert-dialog",
      "avatar",
      "badge",
      "breadcrumb",
      "button",
      "button-group",
      "calendar",
      "card",
      "checkbox",
      "checkbox-card",
      "code",
      "collapsible",
      "combobox",
      "confirm-button",
      "date-field",
      "date-picker",
      "date-range-picker",
      "description-list",
      "dialog",
      "dropdown-menu",
      "emoji",
      "empty",
      "field",
      "file-trigger",
      "focusable",
      "frame",
      "grid-list",
      "heading",
      "input",
      "input-group",
      "item",
      "link",
      "loader",
      "meter",
      "number-field",
      "pagination",
      "phone-number-field",
      "popover",
      "popover-info-button",
      "radio-group",
      "range-calendar",
      "scroll-area",
      "search-field",
      "select",
      "selection-item",
      "separator",
      "sheet",
      "show",
      "sidebar",
      "skeleton",
      "span",
      "switch",
      "table",
      "tabs",
      "text",
      "text-field",
      "textarea",
      "textarea-field",
      "timeline-list",
      "toast",
      "toggle",
      "toggle-group",
      "tooltip",
      "ui-providers",
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

  it("renders the matching API reference from every authored component page", () => {
    for (const entry of COMPONENT_PAGES) {
      expect(authoredPage(entry.slug).text, entry.slug).toContain(`<ApiReference slug="${entry.slug}" />`);
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

  it("lists the demos the page renders, once each, in the order it renders them", () => {
    // The authored page is the demo registry (docs-site.md §6): the manifest restates its
    // scenario list, and nothing here restates the manifest.
    for (const entry of COMPONENT_PAGES) {
      const authored = authoredPage(entry.slug).parsed;
      expect(
        entry.demos.map((demo) => demo.id),
        entry.slug
      ).toEqual(authored.demos.map((demo) => demo.id));
      expect(
        entry.demos.map((demo) => demo.title),
        entry.slug
      ).toEqual(authored.demos.map((demo) => demo.title));
      expect(entry.demos.length, entry.slug).toBeGreaterThan(0);
      expect(new Set(entry.demos.map((demo) => demo.id)).size, entry.slug).toBe(entry.demos.length);
      for (const demo of entry.demos) {
        expect(demo.id, `${entry.slug}.${demo.id}`).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(demo.title.trim(), `${entry.slug}.${demo.id}`).not.toBe("");
      }
    }
  });

  it("links View source at the implementation on the repo host", () => {
    expect(page("button").sourceUrl).toBe(
      "https://github.com/elmeragroup/ui/blob/main/packages/ui/src/components/button/button.tsx"
    );
    expect(page("button").markdownUrl).toBe("/components/button.md");
  });

  it("reports RSC status from the declaring module, matching performance.md §3", () => {
    // The declaring module's leading directive is the whole classification rule, so the
    // expectation is read from that module — a stray directive shows up as a mismatch.
    expect(COMPONENT_PAGES.length).toBeGreaterThan(0);
    for (const entry of COMPONENT_PAGES) {
      const parts = api(entry.slug).parts;
      for (const part of parts) {
        expect(part.rsc, `${entry.slug} ${part.name}`).toBe(declaredRsc(part.sourcePath));
      }
      // The page badge is the status of the part its own implementation file declares,
      // falling back to the first part when every part is declared elsewhere — the RAC
      // facades whose parts resolve into `node_modules` are the fallback case.
      const root = parts.find((part) => part.sourcePath === entry.sourcePath) ?? parts[0];
      expect(entry.rsc, entry.slug).toBe(root?.rsc);
    }
  });
});

describe("committed api.json", () => {
  it("walks only the export names resolveComponentPaths lists", () => {
    expect(resolveComponentPaths("table").exportName).toBe("Table");
    expect(resolveComponentPaths("table").apiExportNames).toEqual(["Table", "VerticalTable"]);
    expect(resolveComponentPaths("checkbox-card").exportName).toBe("CheckboxCard");
    expect(resolveComponentPaths("checkbox-card").apiExportNames).toEqual(["CheckboxCard"]);
    expect(resolveComponentPaths("checkbox").exportName).toBe("Checkbox");
    expect(resolveComponentPaths("checkbox").apiExportNames).toEqual([
      "Checkbox",
      "CheckboxGroup",
      "CheckboxItem",
      "CheckboxItemGroup",
      "CheckboxDescription",
    ]);
    expect(resolveComponentPaths("radio-group").exportName).toBe("RadioGroup");
    expect(resolveComponentPaths("radio-group").apiExportNames).toEqual([
      "RadioGroup",
      "RadioGroupItem",
      "Radio",
      "RadioItem",
      "RadioItemGroup",
      "RadioIconButton",
    ]);
    expect(resolveComponentPaths("combobox").apiExportNames).toEqual(["Combobox", "useComboboxAnchor"]);
    expect(resolveComponentPaths("button").apiExportNames).toEqual(["Button"]);
    expect(resolveComponentPaths("meter").apiExportNames).toEqual(["Meter"]);
    expect(resolveComponentPaths("pagination").apiExportNames).toEqual(["Pagination"]);
    expect(resolveComponentPaths("breadcrumb").apiExportNames).toEqual(["Breadcrumb"]);
    expect(resolveComponentPaths("alert").apiExportNames).toEqual(["Alert"]);
    expect(resolveComponentPaths("ui-providers").entry).toBe("@elmeragroup/ui/react-aria/ui-providers");
    expect(resolveComponentPaths("ui-providers").exportName).toBe("UiProviders");
    expect(resolveComponentPaths("ui-providers").apiExportNames).toEqual(["UiProviders"]);
    expect(resolveComponentPaths("link").entry).toBe("@elmeragroup/ui/react-aria/link");
    expect(resolveComponentPaths("link").exportName).toBe("Link");
    expect(resolveComponentPaths("link").apiExportNames).toEqual(["Link"]);
    expect(resolveComponentPaths("search-field").entry).toBe("@elmeragroup/ui/react-aria/search-field");
    expect(resolveComponentPaths("search-field").exportName).toBe("SearchField");
    expect(resolveComponentPaths("search-field").apiExportNames).toEqual(["SearchField"]);
    expect(resolveComponentPaths("file-trigger").entry).toBe("@elmeragroup/ui/react-aria/file-trigger");
    expect(resolveComponentPaths("file-trigger").exportName).toBe("FileTrigger");
    expect(resolveComponentPaths("file-trigger").apiExportNames).toEqual(["FileTrigger"]);
    expect(resolveComponentPaths("focusable").entry).toBe("@elmeragroup/ui/react-aria/focusable");
    expect(resolveComponentPaths("focusable").exportName).toBe("Focusable");
    expect(resolveComponentPaths("focusable").apiExportNames).toEqual(["Focusable", "useFocusable"]);
    expect(resolveComponentPaths("grid-list").entry).toBe("@elmeragroup/ui/react-aria/grid-list");
    expect(resolveComponentPaths("grid-list").exportName).toBe("GridList");
    expect(resolveComponentPaths("grid-list").apiExportNames).toEqual(["GridList", "GridListItem"]);
    expect(resolveComponentPaths("date-field").entry).toBe("@elmeragroup/ui/react-aria/date-field");
    expect(resolveComponentPaths("date-field").exportName).toBe("DateField");
    expect(resolveComponentPaths("date-field").apiExportNames).toEqual(["DateField", "DateInput"]);
    expect(resolveComponentPaths("calendar").entry).toBe("@elmeragroup/ui/react-aria/calendar");
    expect(resolveComponentPaths("calendar").exportName).toBe("Calendar");
    expect(resolveComponentPaths("calendar").apiExportNames).toEqual([
      "Calendar",
      "CalendarHeader",
      "CalendarGridHeader",
    ]);
    expect(resolveComponentPaths("range-calendar").entry).toBe("@elmeragroup/ui/react-aria/range-calendar");
    expect(resolveComponentPaths("range-calendar").exportName).toBe("RangeCalendar");
    expect(resolveComponentPaths("range-calendar").apiExportNames).toEqual(["RangeCalendar"]);
    expect(resolveComponentPaths("date-picker").entry).toBe("@elmeragroup/ui/react-aria/date-picker");
    expect(resolveComponentPaths("date-picker").exportName).toBe("DatePicker");
    expect(resolveComponentPaths("date-picker").apiExportNames).toEqual([
      "DatePicker",
      "DatePickerPresetGroup",
      "DatePickerPresetItem",
    ]);
    expect(resolveComponentPaths("date-range-picker").entry).toBe(
      "@elmeragroup/ui/react-aria/date-range-picker"
    );
    expect(resolveComponentPaths("date-range-picker").exportName).toBe("DateRangePicker");
    expect(resolveComponentPaths("date-range-picker").apiExportNames).toEqual(["DateRangePicker"]);
  });

  it("documents DateInput's own props and the forwarded RAC remainder", () => {
    const dateInput = api("date-field").parts.find((part) => part.name === "DateInput");
    expect(dateInput?.props.length).toBeGreaterThan(0);
    expect(dateInput?.props.map((prop) => prop.name)).toEqual(expect.arrayContaining(["slot", "className"]));
    expect(dateInput?.props.map((prop) => prop.name)).not.toContain("children");
    expect(dateInput?.forwardedCount).toBeGreaterThan(0);
    expect(dateInput?.forwardedFrom).toEqual(expect.arrayContaining(["react-aria-components"]));
  });

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

  it("publishes only dependency props that carry dependency-authored documentation", () => {
    for (const entry of COMPONENT_PAGES) {
      for (const part of api(entry.slug).parts) {
        for (const prop of part.props) {
          const packageName = dependencyPackageName(prop.origin);
          if (packageName !== null) {
            expect(packageName).toBe("@base-ui/react");
            expect(prop.description, `${part.name}.${prop.name}`).not.toBe("");
          }
        }
      }
    }
  });

  it("publishes dependency props only on checker-backed parts that accept them", () => {
    withLibraryApi((model, context) => {
      for (const component of model) {
        const partApiByName = new Map(component.partApis.map((part) => [part.name, part]));
        for (const part of api(component.slug).parts) {
          const accepted = partApiByName.get(part.name);
          for (const prop of part.props) {
            if (dependencyPackageName(prop.origin) === null) continue;
            expect(accepted, part.name).toBeDefined();
            const fact = accepted === undefined ? undefined : readPartPropFact(context, accepted, prop.name);
            expect(fact, `${part.name}.${prop.name}`).toBeDefined();
            expect(prop.type, `${part.name}.${prop.name}`).toBe(fact?.type);
            expect(prop.required, `${part.name}.${prop.name}`).toBe(fact?.required);
          }
        }
      }
    });
  });

  it("publishes exactly the parts the one library walk resolves, rooted at a facade export", () => {
    withLibraryApi((model) => {
      expect(model.length).toBe(COMPONENT_PAGES.length);
      for (const component of model) {
        const committed = api(component.slug).parts;
        // The artifact is the model's parts, in walk order — no second inventory.
        expect(
          committed.map((part) => part.name),
          component.slug
        ).toEqual(component.parts.map((part) => part.name));
        expect(committed.length, component.slug).toBeGreaterThan(0);
        expect(new Set(committed.map((part) => part.name)).size, component.slug).toBe(committed.length);

        // A part is either a named facade export or a member of one: an unrequested
        // callable object on the same entry (`buttonVariants`, `METER_CONSTANTS`,
        // `checkboxCardStyles`) is never walked into the table.
        const roots = resolveComponentPaths(component.slug).apiExportNames;
        for (const part of committed) {
          expect(
            roots.some((root) => part.name === root || part.name.startsWith(`${root}.`)),
            `${component.slug} ${part.name}`
          ).toBe(true);
        }

        // `forwardedCount` is the model's own count less the dependency props the
        // artifact went on to publish — never a hand-pinned number.
        const forwardedByName = new Map(
          component.partApis.map((part) => [part.name, part.forwarded] as const)
        );
        for (const part of committed) {
          const forwarded = forwardedByName.get(part.name);
          expect(forwarded, part.name).toBeDefined();
          const published = part.props.filter((prop) => dependencyPackageName(prop.origin) !== null).length;
          expect(part.forwardedCount, `${component.slug} ${part.name}`).toBe(
            (forwarded?.count ?? 0) - published
          );
          expect(part.forwardedFrom, `${component.slug} ${part.name}`).toEqual(forwarded?.from ?? []);
        }
      }
    });
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
        // Per-part RSC rides on the heading, matching the HTML page's indicator (§8).
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
