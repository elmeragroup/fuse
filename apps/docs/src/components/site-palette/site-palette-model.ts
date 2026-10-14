/**
 * What the site's ⌘K palette lists, as data. The palette component owns the dialog, the keys and
 * the effects; this module decides which rows each page of the palette shows and in what order.
 * It reads the generated search index and component manifest, which every surface ships eagerly.
 */

import { COLOR_SCHEMES } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";

import { COMPONENT_PAGES } from "../../generated/component-pages";
import { SEARCH_ENTRIES } from "../../generated/search-index";
import { INSTALL_COMMAND } from "../../lib/docs-model";
import type { SearchEntry } from "../../lib/docs-model";
import { COMPONENT_NAV, componentForPath, tocForPath } from "../../lib/nav";
import { componentHref } from "../../lib/pages";
import { queryTokens, rankEntries } from "../../lib/search";
import type { Searchable } from "../../lib/search";
import { COLOR_SCHEME_LABELS } from "../../lib/theme";

/** A row's keyboard shortcut: the caps it shows and the `aria-keyshortcuts` value it carries. */
export type SiteShortcut = {
  /** The caps in press order, such as `["⌘", "Z"]`. */
  readonly keys: readonly string[];
  /** The same shortcut for `aria-keyshortcuts`, such as `"Meta+Z Control+Z"`. */
  readonly aria: string;
};

/** What a copy row puts on the clipboard. The palette reads the page's address when it runs. */
export type CopyTarget =
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "PageLink" }
  | { readonly _tag: "SiteUrl"; readonly path: string };

/** What running a row does. */
export type SiteAction =
  /** Goes to a site address, a route or an anchor on this page, once the palette has closed. */
  | { readonly _tag: "Navigate"; readonly href: string }
  /** Runs as the palette starts to close. */
  | { readonly _tag: "Run"; readonly run: () => void }
  /**
   * Runs once the palette has closed and handed focus back, for a command that opens a dialog of
   * its own, which then returns focus to the same place.
   */
  | { readonly _tag: "OpenOverlay"; readonly open: () => void }
  /** Copies the target and reports it in a toast titled `notice`. */
  | { readonly _tag: "Copy"; readonly target: CopyTarget; readonly notice: string }
  /** Opens another page of the palette, by its stack id. */
  | { readonly _tag: "OpenPage"; readonly page: string };

/** One row of the palette's first page. */
export type SiteRow = Searchable & {
  /** Unique within its group, and the row's React key. */
  readonly id: string;
  /** Muted text at the row's end, such as the page group or the demo's component. */
  readonly hint?: string;
  readonly shortcut?: SiteShortcut;
  /** A command that cannot run now, such as Undo with nothing to undo. */
  readonly disabled?: boolean;
  readonly action: SiteAction;
};

/** A labelled group of rows, in the shape Base UI's grouped items take. */
export type SiteGroup = {
  /** The group's label. */
  readonly value: string;
  readonly items: readonly SiteRow[];
};

/** A command a client surface registers under "This page" through `useSiteCommands`. */
export type SiteCommand = {
  /** Unique among the surface's commands. */
  readonly id: string;
  readonly title: string;
  /** Extra words the command matches as the user types. */
  readonly keywords?: readonly string[];
  readonly shortcut?: SiteShortcut;
  readonly disabled?: boolean;
  readonly action: Extract<SiteAction, { readonly _tag: "Run" | "OpenOverlay" }>;
};

/** One option of a settings page. */
export type SettingOption = {
  /** Unique within its page. */
  readonly id: string;
  /** The option's static name, such as "Dark". */
  readonly label: string;
  /**
   * `current` is the value in force, which the row marks; `unavailable` is one the rest of the
   * state rules out, such as a segment the brand does not serve.
   */
  readonly state: "current" | "available" | "unavailable";
  readonly apply: () => void;
};

/** A settings drill-down: its entry on the first page opens a page of its options. */
export type SettingsPage = {
  /** Unique among the surface's settings pages. */
  readonly id: string;
  /** The entry's and the page's name, such as "Appearance". */
  readonly label: string;
  /** Extra words the entry matches on the first page. Its options never match there. */
  readonly keywords: readonly string[];
  readonly options: readonly SettingOption[];
};

/**
 * The options of a colour-scheme settings page, one per scheme, with `current` marked.
 *
 * @param current - The scheme in force.
 * @param apply - Puts a scheme in force.
 * @returns The options in Fuse's scheme order.
 */
export function colorSchemeOptions(
  current: ColorScheme,
  apply: (scheme: ColorScheme) => void
): readonly SettingOption[] {
  return COLOR_SCHEMES.map((scheme) => ({
    id: scheme,
    label: COLOR_SCHEME_LABELS[scheme],
    state: scheme === current ? "current" : "available",
    apply: () => {
      apply(scheme);
    },
  }));
}

/** The settings a surface offers: its drill-downs, then the settings that act at once. */
export type SiteSettings = {
  readonly pages: readonly SettingsPage[];
  readonly commands: readonly SiteCommand[];
};

/** The rows the palette shows for one route of one surface. */
export type SitePaletteModel = {
  readonly thisPage: readonly SiteRow[];
  readonly settings: readonly SiteRow[];
  readonly settingsPages: readonly SettingsPage[];
  readonly copy: readonly SiteRow[];
};

/** The stack id of the first page. */
export const FIRST_PAGE_ID = "home";

/** The stack id of the page that lists every component. */
export const COMPONENTS_PAGE = "components";

/**
 * The stack id of a settings page. The prefix keeps a surface's page ids apart from the
 * palette's own.
 */
export function settingsPageId(page: SettingsPage): string {
  return `settings/${page.id}`;
}

/** How many rows each group keeps while the user types. */
const GROUP_CAPS = {
  thisPage: 6,
  pages: 8,
  demos: 6,
  settings: 5,
  copy: 3,
} as const;

/** The first page's group labels. */
const GROUP = {
  thisPage: "This page",
  goTo: "Go to",
  settings: "Settings",
  copy: "Copy",
  pages: "Pages",
  demos: "Demos",
} as const;

function pageRow(entry: SearchEntry): SiteRow {
  return {
    id: `page:${entry.href}`,
    title: entry.title,
    keywords: entry.keywords,
    description: entry.description,
    hint: entry.group,
    action: { _tag: "Navigate", href: entry.href },
  };
}

/** Every demo of every component page, deep-linked to its anchor. */
const DEMO_ROWS: readonly SiteRow[] = COMPONENT_PAGES.flatMap((component) =>
  component.demos.map((demo): SiteRow => ({
    id: `demo:${component.slug}#${demo.id}`,
    title: demo.title,
    keywords: [component.title, component.slug],
    hint: component.title,
    action: { _tag: "Navigate", href: `${componentHref(component.slug)}#${demo.id}` },
  }))
);

/** The rows of the Components page, in nav order. */
export const COMPONENT_ROWS: readonly SiteRow[] = COMPONENT_NAV.map((item) => ({
  id: `component:${item.href}`,
  title: item.label,
  action: { _tag: "Navigate", href: item.href },
}));

const GO_TO_ROWS: readonly SiteRow[] = [
  {
    id: "go-to:components",
    title: "Components",
    action: { _tag: "OpenPage", page: COMPONENTS_PAGE },
  },
];

function settingsEntry(page: SettingsPage): SiteRow {
  return {
    id: `settings:${page.id}`,
    title: page.label,
    keywords: page.keywords,
    action: { _tag: "OpenPage", page: settingsPageId(page) },
  };
}

function copyRows(pathname: string): readonly SiteRow[] {
  const component = componentForPath(pathname);
  const rows: SiteRow[] = [
    {
      id: "copy:install",
      title: "Copy install command",
      keywords: [INSTALL_COMMAND],
      action: {
        _tag: "Copy",
        target: { _tag: "Text", text: INSTALL_COMMAND },
        notice: "Copied install command",
      },
    },
    {
      id: "copy:link",
      title: "Copy link to this page",
      keywords: ["url", "address", "share"],
      action: { _tag: "Copy", target: { _tag: "PageLink" }, notice: "Copied link to this page" },
    },
  ];
  if (component !== undefined) {
    rows.push({
      id: "copy:markdown",
      title: "Copy Markdown URL",
      keywords: ["md", "llms"],
      action: {
        _tag: "Copy",
        target: { _tag: "SiteUrl", path: component.markdownUrl },
        notice: "Copied Markdown URL",
      },
    });
  }
  return rows;
}

/**
 * The palette's rows for one route: the component page's table of contents and the surface's
 * registered commands under "This page", the surface's settings, and the copy actions.
 *
 * @param pathname - The route on screen.
 * @param commands - The commands the surface registered, in registration order.
 * @param settings - The surface's settings.
 * @returns The rows the palette's pages list.
 */
export function sitePaletteModel(
  pathname: string,
  commands: readonly SiteCommand[],
  settings: SiteSettings
): SitePaletteModel {
  const toc = tocForPath(pathname).map((item): SiteRow => ({
    id: `toc:${item.id}`,
    title: item.title,
    action: { _tag: "Navigate", href: `${pathname}#${item.id}` },
  }));
  return {
    thisPage: [...toc, ...commands],
    settings: [...settings.pages.map(settingsEntry), ...settings.commands],
    settingsPages: settings.pages,
    copy: copyRows(pathname),
  };
}

function nonEmpty(groups: readonly SiteGroup[]): readonly SiteGroup[] {
  return groups.filter((group) => group.items.length > 0);
}

/**
 * The first page's groups. With nothing typed it is the curated home: This page, Go to, Settings
 * and Copy. Once the user types it ranks every kind of row in fixed groups: This page, Pages,
 * Demos, Settings and Copy, each capped. Typing matches a settings entry, never the options
 * inside it. Empty groups are left out.
 *
 * @param model - The rows for the route on screen.
 * @param query - What the user typed.
 * @returns The groups in display order.
 */
export function homeGroups(model: SitePaletteModel, query: string): readonly SiteGroup[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return nonEmpty([
      { value: GROUP.thisPage, items: model.thisPage },
      { value: GROUP.goTo, items: GO_TO_ROWS },
      { value: GROUP.settings, items: model.settings },
      { value: GROUP.copy, items: model.copy },
    ]);
  }
  return nonEmpty([
    { value: GROUP.thisPage, items: rankEntries(model.thisPage, tokens, GROUP_CAPS.thisPage) },
    { value: GROUP.pages, items: rankEntries(SEARCH_ENTRIES, tokens, GROUP_CAPS.pages).map(pageRow) },
    { value: GROUP.demos, items: rankEntries(DEMO_ROWS, tokens, GROUP_CAPS.demos) },
    { value: GROUP.settings, items: rankEntries(model.settings, tokens, GROUP_CAPS.settings) },
    { value: GROUP.copy, items: rankEntries(model.copy, tokens, GROUP_CAPS.copy) },
  ]);
}
