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
      "confirm-button",
      "date-field",
      "description-list",
      "dialog",
      "dropdown-menu",
      "emoji",
      "empty",
      "field",
      "frame",
      "heading",
      "input",
      "input-group",
      "item",
      "loader",
      "meter",
      "number-field",
      "pagination",
      "popover",
      "radio-group",
      "scroll-area",
      "select",
      "selection-item",
      "separator",
      "sheet",
      "show",
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
      "toggle",
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
    expect(page("button-group").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "vertical",
      "split-button",
      "text",
      "nested",
    ]);
    expect(page("avatar").demos.map((demo) => demo.id)).toEqual(["basic", "fallback", "sizes", "group"]);
    expect(page("loader").demos.map((demo) => demo.id)).toEqual(["sizes", "inline"]);
    expect(page("show").demos.map((demo) => demo.id)).toEqual(["basic"]);
    expect(page("emoji").demos.map((demo) => demo.id)).toEqual(["faces", "labeled", "sizing"]);
    expect(page("code").demos.map((demo) => demo.id)).toEqual(["basic", "scroll"]);
    expect(page("skeleton").demos.map((demo) => demo.id)).toEqual(["basic", "card"]);
    expect(page("empty").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "outline",
      "with-actions",
      "media-variants",
      "inline-link",
    ]);
    expect(page("frame").demos.map((demo) => demo.id)).toEqual(["basic", "stacked-panels", "with-table"]);
    expect(page("timeline-list").demos.map((demo) => demo.id)).toEqual(["basic", "rich"]);
    expect(page("sheet").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "sides",
      "sizes",
      "form",
      "scrolling",
    ]);
    expect(page("tooltip").demos.map((demo) => demo.id)).toEqual(["basic", "sides", "delay", "controlled"]);
    expect(page("alert-dialog").demos.map((demo) => demo.id)).toEqual([
      "destructive",
      "neutral",
      "pending",
      "custom-icon",
    ]);
    expect(page("dropdown-menu").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "checkboxes",
      "radio-group",
      "submenu",
      "links",
      "destructive",
    ]);
    expect(page("switch").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "sizes",
      "states",
      "in-field",
      "form",
    ]);
    expect(page("collapsible").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "controlled",
      "hidden-until-found",
    ]);
    expect(page("accordion").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "multiple",
      "variants",
      "controlled",
      "hidden-until-found",
    ]);
    expect(page("select").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "groups",
      "sizes",
      "scrolling",
      "invalid",
    ]);
    expect(page("selection-item").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "subsection",
      "control-end",
      "stacked",
      "disabled",
    ]);
    expect(page("checkbox").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "group",
      "tristate",
      "item-group",
      "description",
    ]);
    expect(page("checkbox-card").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "tags",
      "right-content",
      "variants",
      "group",
    ]);
    expect(page("radio-group").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "pending",
      "item-group",
      "icon-button",
      "controlled-null",
    ]);
    expect(page("number-field").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "denomination",
      "format",
      "error",
      "states",
      "uncontrolled",
    ]);
    expect(page("meter").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "modes",
      "value-label",
      "range",
      "neutral",
    ]);
    expect(page("tabs").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "line",
      "vertical",
      "with-icons",
      "disabled",
    ]);
    expect(page("confirm-button").demos.map((demo) => demo.id)).toEqual(["destructive", "success", "icon"]);
    expect(page("table").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "in-frame",
      "vertical-data",
      "vertical-compact",
    ]);
    expect(page("textarea-field").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "counter",
      "uncontrolled",
      "error",
      "disabled",
    ]);
    expect(page("pagination").demos.map((demo) => demo.id)).toEqual(["basic", "ellipsis", "controlled"]);
    expect(page("breadcrumb").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "custom-separator",
      "ellipsis",
      "render-link",
    ]);
    expect(page("alert").demos.map((demo) => demo.id)).toEqual([
      "variants",
      "action",
      "title-only",
      "heading-level",
    ]);
    expect(page("ui-providers").demos.map((demo) => demo.id)).toEqual(["basic", "locale-switch"]);
    expect(page("date-field").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "validation",
      "granularity",
      "states",
      "date-input",
    ]);
    expect(page("calendar").demos.map((demo) => demo.id)).toEqual([
      "basic",
      "controlled",
      "bounds",
      "error",
      "rtl",
    ]);
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
      accordion: "client",
      alert: "server",
      "alert-dialog": "client",
      avatar: "client",
      badge: "server",
      breadcrumb: "client",
      button: "client",
      "button-group": "client",
      calendar: "client",
      card: "server",
      checkbox: "client",
      "checkbox-card": "client",
      code: "server",
      collapsible: "client",
      "confirm-button": "client",
      "date-field": "client",
      "description-list": "server",
      dialog: "client",
      "dropdown-menu": "client",
      emoji: "server",
      empty: "server",
      field: "client",
      frame: "server",
      heading: "client",
      input: "client",
      "input-group": "client",
      item: "client",
      loader: "server",
      meter: "client",
      "number-field": "client",
      pagination: "client",
      popover: "client",
      "radio-group": "client",
      "scroll-area": "client",
      select: "client",
      "selection-item": "client",
      separator: "client",
      sheet: "client",
      show: "server",
      skeleton: "server",
      span: "client",
      switch: "client",
      table: "server",
      tabs: "client",
      text: "client",
      "text-field": "client",
      textarea: "server",
      "textarea-field": "client",
      "timeline-list": "server",
      toggle: "client",
      tooltip: "client",
      "ui-providers": "client",
    } as const;
    expect(Object.keys(expected)).toHaveLength(COMPONENT_PAGES.length);
    for (const [slug, rsc] of Object.entries(expected)) {
      expect(page(slug).rsc, slug).toBe(rsc);
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
    expect(resolveComponentPaths("button").apiExportNames).toEqual(["Button"]);
    expect(resolveComponentPaths("meter").apiExportNames).toEqual(["Meter"]);
    expect(resolveComponentPaths("pagination").apiExportNames).toEqual(["Pagination"]);
    expect(resolveComponentPaths("breadcrumb").apiExportNames).toEqual(["Breadcrumb"]);
    expect(resolveComponentPaths("alert").apiExportNames).toEqual(["Alert"]);
    expect(resolveComponentPaths("ui-providers").entry).toBe("@elmeragroup/ui/react-aria/ui-providers");
    expect(resolveComponentPaths("ui-providers").exportName).toBe("UiProviders");
    expect(resolveComponentPaths("ui-providers").apiExportNames).toEqual(["UiProviders"]);
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

  it("resolves the compound parts of a namespace component", () => {
    expect(api("accordion").parts.map((part) => part.name)).toEqual([
      "Accordion.Root",
      "Accordion.Item",
      "Accordion.Header",
      "Accordion.Trigger",
      "Accordion.Content",
    ]);
    expect(api("alert-dialog").parts.map((part) => part.name)).toEqual([
      "AlertDialog.Root",
      "AlertDialog.Trigger",
      "AlertDialog.Content",
    ]);
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
    expect(api("dropdown-menu").parts.map((part) => part.name)).toEqual([
      "DropdownMenu.Root",
      "DropdownMenu.Trigger",
      "DropdownMenu.Portal",
      "DropdownMenu.Content",
      "DropdownMenu.Group",
      "DropdownMenu.Label",
      "DropdownMenu.Item",
      "DropdownMenu.LinkItem",
      "DropdownMenu.CheckboxItem",
      "DropdownMenu.RadioGroup",
      "DropdownMenu.RadioItem",
      "DropdownMenu.Separator",
      "DropdownMenu.Shortcut",
      "DropdownMenu.Sub",
      "DropdownMenu.SubTrigger",
      "DropdownMenu.SubContent",
    ]);
    expect(api("select").parts.map((part) => part.name)).toEqual([
      "Select.Root",
      "Select.Trigger",
      "Select.Value",
      "Select.Content",
      "Select.Item",
      "Select.Group",
      "Select.Label",
      "Select.Separator",
      "Select.ScrollUpButton",
      "Select.ScrollDownButton",
    ]);
    expect(api("scroll-area").parts.map((part) => part.name)).toEqual(["ScrollArea.Root", "ScrollArea.Bar"]);
    expect(api("avatar").parts.map((part) => part.name)).toEqual([
      "Avatar.Root",
      "Avatar.Image",
      "Avatar.Fallback",
    ]);
    expect(api("collapsible").parts.map((part) => part.name)).toEqual([
      "Collapsible.Root",
      "Collapsible.Trigger",
      "Collapsible.Content",
    ]);
    expect(api("tabs").parts.map((part) => part.name)).toEqual([
      "Tabs.Root",
      "Tabs.List",
      "Tabs.Trigger",
      "Tabs.Content",
    ]);
    expect(api("empty").parts.map((part) => part.name)).toEqual([
      "Empty.Root",
      "Empty.Header",
      "Empty.Media",
      "Empty.Title",
      "Empty.Description",
      "Empty.Content",
    ]);
    expect(api("frame").parts.map((part) => part.name)).toEqual([
      "Frame.Root",
      "Frame.Panel",
      "Frame.Header",
      "Frame.Title",
      "Frame.Description",
      "Frame.Footer",
    ]);
    expect(api("code").parts.map((part) => part.name)).toEqual(["Code"]);
    expect(api("button").parts.map((part) => part.name)).toEqual(["Button"]);
    expect(api("meter").parts.map((part) => part.name)).toEqual(["Meter"]);
    expect(api("checkbox-card").parts.map((part) => part.name)).toEqual(["CheckboxCard"]);
    expect(api("checkbox-card").parts.map((part) => part.name)).not.toContain("checkboxCardStyles");
    expect(api("pagination").parts.map((part) => part.name)).toEqual([
      "Pagination.Root",
      "Pagination.Content",
      "Pagination.Item",
      "Pagination.Link",
      "Pagination.Previous",
      "Pagination.Next",
      "Pagination.Ellipsis",
    ]);
    // Unrequested callable objects on those facades stay excluded.
    expect(api("button").parts.map((part) => part.name)).not.toContain("buttonVariants");
    expect(api("meter").parts.map((part) => part.name)).not.toContain("METER_CONSTANTS");
    expect(api("pagination").parts.map((part) => part.name)).not.toContain("paginationVariants");
    expect(api("breadcrumb").parts.map((part) => part.name)).toEqual([
      "Breadcrumb.Root",
      "Breadcrumb.List",
      "Breadcrumb.Item",
      "Breadcrumb.Link",
      "Breadcrumb.Page",
      "Breadcrumb.Separator",
      "Breadcrumb.Ellipsis",
    ]);
    expect(api("alert").parts.map((part) => part.name)).toEqual([
      "Alert.Root",
      "Alert.Icon",
      "Alert.Title",
      "Alert.Description",
    ]);
    expect(api("alert").parts.map((part) => part.name)).not.toContain("alertVariants");
    expect(api("table").parts.map((part) => part.name)).toEqual([
      "Table.Root",
      "Table.Header",
      "Table.Body",
      "Table.Footer",
      "Table.Row",
      "Table.Head",
      "Table.Cell",
      "Table.Caption",
      "VerticalTable.Root",
      "VerticalTable.Header",
      "VerticalTable.Body",
      "VerticalTable.Row",
      "VerticalTable.Key",
      "VerticalTable.Value",
    ]);
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
    expect(checkboxCard?.forwardedCount).toBe(285);
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
