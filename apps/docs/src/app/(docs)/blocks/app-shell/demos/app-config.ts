/**
 * The app's configuration: where it is mounted, its language, and its pages. The sidebar, the
 * breadcrumb and the command menu all read the one page list, so a new page shows up in all three
 * at once.
 *
 * `APP_BASE` is where the app is mounted. Here that is the docs site's preview route; in your app
 * it is `""` when the app owns the whole site, or a prefix such as `"/dashboard"`. Link home through
 * `APP_HOME`, which is `/` for an app at the root.
 */

import type { ComponentType } from "react";

import { Gauge, Gear, Receipt, SquaresFour } from "@elmeragroup/fuse/icons";
import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";
import type { SupportedLocale } from "@elmeragroup/fuse/theme";

/** Where the app is mounted: `""` when the app is the whole site, or a prefix such as `"/dashboard"`. */
export const APP_BASE = "/blocks/app-shell/preview";

/**
 * The app's home page for a mount point: the prefix itself, or `/` for an app that owns the whole
 * site, where an empty href would point at the current page.
 *
 * @param base - Where the app is mounted.
 * @returns The home route.
 */
export function appHome(base: string): string {
  return base === "" ? "/" : base;
}

/** The home route of this app, which the logo, the breadcrumb and Overview link to. */
export const APP_HOME = appHome(APP_BASE);

/**
 * The app's locale, for `LocaleProvider` and for the parts that take a locale of their own, such
 * as `Sparkline`, which renders on the server without hooks.
 */
export const APP_LOCALE = "en-US" satisfies SupportedLocale;

/** The sidebar's groups, in order. */
const GROUPS = ["Portfolio", "Billing", "Account"] as const;

/** One of the sidebar's groups. */
export type AppPageGroup = (typeof GROUPS)[number];

/** One page of the app. */
export type AppPage = {
  /** The page's route. */
  readonly href: string;
  /** The page's name in the sidebar, the breadcrumb, its heading and the command menu. */
  readonly label: string;
  /** One line under the page's heading. */
  readonly description: string;
  readonly icon: ComponentType<ElmeraIconProps>;
  readonly group: AppPageGroup;
  /** Extra words the command menu matches. */
  readonly keywords: string;
};

/** Every page, in sidebar order, by its route below the mount point; Overview is the home. */
const PAGE_DEFINITIONS = [
  {
    route: "",
    label: "Overview",
    description: "Consumption, spot price and invoicing across the portfolio.",
    icon: SquaresFour,
    group: "Portfolio",
    keywords: "dashboard home kpi",
  },
  {
    route: "/metering-points",
    label: "Metering points",
    description: "Every point we supply, with its contract and its last 30 days.",
    icon: Gauge,
    group: "Portfolio",
    keywords: "customers meters gsrn elhub",
  },
  {
    route: "/invoices",
    label: "Invoices",
    description: "February's invoices, their payments and what each one charged.",
    icon: Receipt,
    group: "Billing",
    keywords: "bills payments overdue",
  },
  {
    route: "/settings",
    label: "Settings",
    description: "Your profile, invoicing defaults and notifications.",
    icon: Gear,
    group: "Account",
    keywords: "profile preferences notifications",
  },
] as const satisfies readonly (Omit<AppPage, "href"> & { readonly route: string })[];

/** A page's sidebar label. */
export type AppPageLabel = (typeof PAGE_DEFINITIONS)[number]["label"];

/**
 * The pages of an app mounted at `base`, in sidebar order.
 *
 * @param base - Where the app is mounted.
 * @returns Each page with its full route: the home for Overview, and `base` plus the page's route
 *   for the rest.
 */
export function appPages(base: string): readonly AppPage[] {
  return PAGE_DEFINITIONS.map(({ route, ...page }) => ({
    ...page,
    href: route === "" ? appHome(base) : `${base}${route}`,
  }));
}

/** Every page of this app, in sidebar order. */
export const APP_PAGES: readonly AppPage[] = appPages(APP_BASE);

/** The sidebar's groups with their pages, in order. */
export const APP_PAGE_GROUPS: readonly {
  readonly label: AppPageGroup;
  readonly pages: readonly AppPage[];
}[] = GROUPS.map((label) => ({
  label,
  pages: APP_PAGES.filter((page) => page.group === label),
}));

/** Whether `path` is the page's route or a route below it. */
function isUnder(path: string, href: string): boolean {
  return path === href || path.startsWith(href.endsWith("/") ? href : `${href}/`);
}

/**
 * The page a pathname shows: the page whose route is the longest prefix of it, so a detail route
 * under a page still marks that page as current.
 *
 * @param pathname - The current pathname, as `usePathname` returns it.
 * @param pages - The app's pages; this app's by default.
 * @returns The page, or `undefined` outside the app.
 */
export function pageForPath(pathname: string, pages: readonly AppPage[] = APP_PAGES): AppPage | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/$/u, "") : pathname;
  return pages
    .filter((page) => isUnder(path, page.href))
    .toSorted((left, right) => right.href.length - left.href.length)[0];
}

/**
 * The page with a label, for the page's own heading.
 *
 * @param label - One of the pages' labels.
 * @returns The page.
 */
export function appPage(label: AppPageLabel): AppPage {
  const page = APP_PAGES.find((candidate) => candidate.label === label);
  if (page === undefined) {
    throw new Error(`No app page is labelled ${label}.`);
  }
  return page;
}
