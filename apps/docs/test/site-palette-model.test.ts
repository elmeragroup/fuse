import { describe, expect, it } from "vitest";

import {
  COMPONENT_ROWS,
  COMPONENTS_PAGE,
  homeGroups,
  settingsPageId,
  sitePaletteModel,
} from "../src/components/site-palette/site-palette-model";
import type {
  SettingsPage,
  SiteCommand,
  SiteGroup,
  SiteRow,
  SiteSettings,
} from "../src/components/site-palette/site-palette-model";
import { COMPONENT_NAV, tocForPath } from "../src/lib/nav";

const noop = (): void => undefined;

const APPEARANCE: SettingsPage = {
  id: "appearance",
  label: "Appearance",
  keywords: ["color scheme"],
  options: [
    { id: "light", label: "Light", state: "available", apply: noop },
    { id: "dark", label: "Dark", state: "current", apply: noop },
  ],
};

const SETTINGS: SiteSettings = {
  pages: [APPEARANCE],
  commands: [{ id: "reset", title: "Reset preview theme", action: { _tag: "Run", run: noop } }],
};

const NO_SETTINGS: SiteSettings = { pages: [], commands: [] };

function labels(groups: readonly SiteGroup[]): string[] {
  return groups.map((group) => group.value);
}

function titles(groups: readonly SiteGroup[], label: string): string[] {
  return groups.find((group) => group.value === label)?.items.map((row) => row.title) ?? [];
}

function href(row: SiteRow | undefined): string | undefined {
  return row?.action._tag === "Navigate" ? row.action.href : undefined;
}

function group(groups: readonly SiteGroup[], label: string): readonly SiteRow[] {
  return groups.find((candidate) => candidate.value === label)?.items ?? [];
}

describe("the site palette's first page with nothing typed", () => {
  it("lists This page, Go to, Settings and Copy, in that order, on a component page", () => {
    const groups = homeGroups(sitePaletteModel("/components/button", [], SETTINGS), "");
    expect(labels(groups)).toEqual(["This page", "Go to", "Settings", "Copy"]);
    expect(titles(groups, "Go to")).toEqual(["Components"]);
    expect(titles(groups, "Settings")).toEqual(["Appearance", "Reset preview theme"]);
    expect(titles(groups, "Copy")).toEqual([
      "Copy install command",
      "Copy link to this page",
      "Copy Markdown URL",
    ]);
  });

  it("leaves This page out where the route has no table of contents and nothing registered", () => {
    const groups = homeGroups(sitePaletteModel("/handbook/theming", [], NO_SETTINGS), "");
    expect(labels(groups)).toEqual(["Go to", "Copy"]);
    // The Markdown endpoint exists for component pages only.
    expect(titles(groups, "Copy")).toEqual(["Copy install command", "Copy link to this page"]);
  });

  it("lists a component page's QuickNav entries under This page, each jumping to its anchor", () => {
    // The unit under test is the palette's This page group; the oracle is the QuickNav's table of
    // contents for the same route, which the palette must reproduce row for row.
    const quickNav = tocForPath("/components/dialog");
    const rows = group(homeGroups(sitePaletteModel("/components/dialog", [], NO_SETTINGS), ""), "This page");
    expect(rows.map((row) => row.title)).toEqual(quickNav.map((item) => item.title));
    expect(rows.map(href)).toEqual(quickNav.map((item) => `/components/dialog#${item.id}`));
    expect(rows.map((row) => row.title)).toContain("API reference");
  });

  it("lists registered commands after the table of contents, in registration order", () => {
    // The oracle is the route's table of contents followed by the commands as supplied.
    const commands: SiteCommand[] = [
      { id: "undo", title: "Undo", disabled: true, action: { _tag: "Run", run: noop } },
      { id: "export", title: "Export CSS", action: { _tag: "OpenOverlay", open: noop } },
    ];
    const quickNav = tocForPath("/components/dialog");
    const rows = group(
      homeGroups(sitePaletteModel("/components/dialog", commands, NO_SETTINGS), ""),
      "This page"
    );
    expect(rows.map((row) => row.title)).toEqual([
      ...quickNav.map((item) => item.title),
      "Undo",
      "Export CSS",
    ]);
    expect(rows.find((row) => row.title === "Undo")?.disabled).toBe(true);
  });

  it("opens the Components page, whose rows are every component in nav order", () => {
    const goTo = group(homeGroups(sitePaletteModel("/docs", [], NO_SETTINGS), ""), "Go to");
    expect(goTo[0]?.action).toEqual({ _tag: "OpenPage", page: COMPONENTS_PAGE });
    expect(COMPONENT_ROWS.map((row) => row.title)).toEqual(COMPONENT_NAV.map((item) => item.label));
    expect(COMPONENT_ROWS.find((row) => row.title === "Dialog")?.action).toEqual({
      _tag: "Navigate",
      href: "/components/dialog",
    });
  });
});

describe("the site palette's first page as the user types", () => {
  it("ranks the index into Pages, so theme mat leads with the theme matrix", () => {
    const groups = homeGroups(sitePaletteModel("/components/button", [], SETTINGS), "theme mat");
    expect(groups[0]?.value).toBe("Pages");
    expect(href(groups[0]?.items[0])).toBe("/handbook/theme-matrix");
  });

  it("finds a demo by its title and component and deep-links to its anchor", () => {
    const groups = homeGroups(sitePaletteModel("/docs", [], NO_SETTINGS), "hidden until found accordion");
    expect(href(group(groups, "Demos")[0])).toBe("/components/accordion#hidden-until-found");
  });

  it("keeps the fixed group order and caps each group", () => {
    const commands: SiteCommand[] = [{ id: "a", title: "Alpha tool", action: { _tag: "Run", run: noop } }];
    const groups = homeGroups(sitePaletteModel("/components/button", commands, SETTINGS), "a");
    expect(labels(groups)).toEqual(["This page", "Pages", "Demos", "Settings", "Copy"]);
    expect(group(groups, "Pages").length).toBe(8);
    expect(group(groups, "Demos").length).toBe(6);
    expect(group(groups, "This page").length).toBeLessThanOrEqual(6);
  });

  it("matches a settings entry, never the options inside it", () => {
    const entry = homeGroups(sitePaletteModel("/docs", [], SETTINGS), "appear");
    expect(group(entry, "Settings").map((row) => row.action)).toEqual([
      { _tag: "OpenPage", page: settingsPageId(APPEARANCE) },
    ]);
    const option = homeGroups(sitePaletteModel("/docs", [], SETTINGS), "dark");
    expect(labels(option)).not.toContain("Settings");
  });

  it("matches a registered command by its keywords", () => {
    const commands: SiteCommand[] = [
      { id: "hand", title: "Hand tool", keywords: ["pan"], action: { _tag: "Run", run: noop } },
    ];
    const groups = homeGroups(sitePaletteModel("/studio", commands, NO_SETTINGS), "pan");
    expect(titles(groups, "This page")).toEqual(["Hand tool"]);
  });

  it("copies the component's Markdown endpoint from a component page", () => {
    const rows = group(
      homeGroups(sitePaletteModel("/components/button", [], NO_SETTINGS), "markdown"),
      "Copy"
    );
    expect(rows.map((row) => row.action)).toEqual([
      {
        _tag: "Copy",
        target: { _tag: "SiteUrl", path: "/components/button.md" },
        notice: "Copied Markdown URL",
      },
    ]);
  });
});
