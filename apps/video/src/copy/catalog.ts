import type { SupportedLocale } from "@elmeragroup/fuse/theme";

import type { MarketCurrency } from "../brand/brand-market";

/** The locales the release video renders in, one composition each. */
export const VIDEO_LOCALES = ["en-US", "nb-NO", "sv-SE"] as const satisfies readonly SupportedLocale[];

/** A locale the release video renders in. */
export type VideoLocale = (typeof VIDEO_LOCALES)[number];

/**
 * Every string the release video shows, per scene. Each locale's catalog fills the same shape, so
 * a missing string fails the type check. Product names, component names, the package name, the
 * site address and code stay as they are in every locale. Numbers, dates and currency come
 * formatted from the caller, which formats them for the video's locale.
 */
export type Copy = {
  readonly hero: {
    readonly eyebrow: string;
    readonly lead: string;
    readonly accent: string;
  };
  readonly brandMorph: {
    /** The plain statement beside the attribute chip. */
    readonly caption: string;
    readonly tabs: readonly [string, string, string];
    readonly usage: string;
    readonly period: string;
    /** The week-on-week change, given the formatted percentage. */
    readonly delta: (percent: string) => string;
    readonly budget: string;
    /** The budget line, given the formatted amount spent and the limit. */
    readonly budgetOf: (spent: string, limit: string) => string;
    readonly notify: (percent: string) => string;
    readonly cta: string;
  };
  readonly density: {
    readonly title: string;
    readonly internal: string;
    readonly external: string;
    /** The control-height label, given the height in px. */
    readonly controls: (px: number) => string;
    readonly table: {
      readonly title: string;
      readonly customer: string;
      readonly status: string;
      readonly amount: string;
      readonly active: string;
      readonly pending: string;
      readonly paused: string;
    };
    readonly form: {
      readonly title: string;
      readonly meter: string;
      readonly reading: string;
      readonly date: string;
      readonly save: string;
      readonly cancel: string;
    };
  };
  readonly montage: {
    readonly app: string;
    readonly search: string;
    readonly select: {
      readonly label: string;
    };
    readonly dialog: {
      readonly trigger: string;
      readonly title: string;
      readonly description: string;
      readonly cancel: string;
      readonly confirm: string;
    };
    readonly sheet: {
      readonly title: string;
      readonly description: string;
      readonly customer: string;
      readonly product: string;
      readonly productValue: string;
      readonly start: string;
      readonly submit: string;
    };
    readonly command: {
      /** What the cursor types; it must match some of `items` in the locale. */
      readonly query: string;
      readonly placeholder: string;
      readonly items: readonly [string, string, string, string, string, string];
    };
    readonly toast: {
      readonly title: string;
      /** The toast's body, given the formatted reading and meter number. */
      readonly description: (reading: string, meter: string) => string;
    };
  };
  readonly install: {
    readonly title: string;
    readonly lede: string;
    readonly copy: string;
  };
  readonly lockup: {
    readonly caption: string;
  };
  readonly claudeBuilds: ClaudeBuildsCopy;
  readonly brandBook: BrandBookCopy;
};

/** One of the site's sections, in the order Claude builds them. */
export type SiteSection = "header" | "hero" | "plans" | "calculator" | "faq" | "footer";

/** A todo on Claude's list: what it reads, and the spinner's label while it is current. */
export type TodoCopy = {
  readonly label: string;
  readonly working: string;
};

/** A plan card on the site. */
export type PlanCopy = {
  readonly name: string;
  readonly text: string;
  readonly features: readonly [string, string, string];
};

/**
 * The strings of the Claude Code film: the session in the terminal and the site Claude builds.
 * Claude Code's own interface is English in every locale, as the product is; what the user types,
 * what Claude answers and the site's copy follow the locale. Paths, commands and attributes are
 * code and stay in the film's script.
 */
export type ClaudeBuildsCopy = {
  readonly terminal: {
    /** The welcome line, given the user's name. */
    readonly welcome: (name: string) => string;
    /** The welcome box's title on its border: the CLI's name and version. */
    readonly title: string;
    /** Who the session belongs to: a team, never a person. */
    readonly user: string;
    /** The model the welcome box names. */
    readonly model: string;
    readonly placeholder: string;
    /** What the user types. Lowercase and casual, as people type into a terminal. */
    readonly prompt: string;
    /** Claude's first answer. */
    readonly reply: string;
    readonly thinking: string;
    /** The spinner's hint, given the seconds the work has run. */
    readonly interrupt: (seconds: number) => string;
    readonly shortcuts: string;
    readonly todosTool: string;
    /** A write's result, given its length in lines and its path. */
    readonly wrote: (lines: number, path: string) => string;
    /** The install's result, given the seconds it took. */
    readonly installed: (seconds: string) => string;
    /** The click's result in the browser, given the toast it raised. */
    readonly clicked: (toast: string) => string;
    /** Claude's word once the page is built, before the brands. */
    readonly built: string;
    /** Claude's last word. */
    readonly done: string;
    readonly todos: Readonly<Record<SiteSection | "brands", TodoCopy>>;
  };
  readonly site: {
    readonly nav: readonly [string, string, string];
    readonly navLabel: string;
    readonly signIn: string;
    readonly order: string;
    /** The price area each market's site shows, by its code and the area's name. */
    readonly areas: Readonly<Record<MarketCurrency, string>>;
    readonly hero: {
      readonly title: string;
      readonly lede: string;
      readonly primary: string;
      readonly secondary: string;
      readonly today: string;
      readonly average: string;
      readonly low: string;
      readonly high: string;
      /** A price per kWh, given the formatted amount. */
      readonly perKwh: (amount: string) => string;
    };
    readonly plans: {
      readonly title: string;
      readonly lede: string;
      readonly popular: string;
      /** A monthly fee, given the formatted amount. */
      readonly perMonth: (amount: string) => string;
      readonly choose: string;
      readonly spot: PlanCopy;
      readonly fixed: PlanCopy;
      readonly green: PlanCopy;
    };
    readonly calculator: {
      readonly title: string;
      readonly lede: string;
      readonly area: string;
      readonly use: string;
      readonly estimate: string;
      readonly note: string;
    };
    readonly faq: {
      readonly title: string;
      readonly items: readonly [
        { readonly question: string; readonly answer: string },
        { readonly question: string; readonly answer: string },
        { readonly question: string; readonly answer: string },
        { readonly question: string; readonly answer: string },
      ];
    };
    readonly footer: {
      readonly columns: readonly [
        { readonly title: string; readonly links: readonly [string, string, string] },
        { readonly title: string; readonly links: readonly [string, string, string] },
        { readonly title: string; readonly links: readonly [string, string, string] },
      ];
      /** The legal line, given the brand's name. */
      readonly legal: (brand: string) => string;
    };
    readonly toast: {
      readonly title: string;
      readonly description: string;
    };
  };
  readonly lockup: {
    readonly caption: string;
  };
};

/**
 * Every string the brand book shows. Token names, component names, brand names, hex values and the
 * site address stay as they are in every locale, as in the release cut.
 */
export type BrandBookCopy = {
  readonly identity: {
    readonly tagline: string;
  };
  readonly schemes: {
    readonly light: string;
    readonly dark: string;
  };
  readonly palette: {
    /** The line under the role name. */
    readonly caption: string;
  };
  readonly anatomy: {
    readonly title: string;
    readonly subtitle: string;
    readonly card: {
      readonly title: string;
      readonly status: string;
      readonly meter: string;
      readonly notify: string;
      readonly save: string;
      readonly cancel: string;
    };
  };
  readonly collage: CollageCopy;
  readonly closing: {
    /** The two flipping tiles; the third flips to the Elmera mark. */
    readonly words: readonly [string, string];
    readonly caption: string;
  };
};

/** The collage's plates: the posters' lines and every component's content. */
export type CollageCopy = {
  /** The poster label, given the version. */
  readonly posterLabel: (version: string) => string;
  readonly posterTitle: string;
  readonly rolesTitle: string;
  readonly dialog: {
    readonly title: string;
    readonly description: string;
    readonly cancel: string;
    readonly confirm: string;
  };
  readonly command: {
    /** What the palette shows typed; it must match some of `items` in the locale. */
    readonly query: string;
    readonly placeholder: string;
    readonly items: readonly [string, string, string, string, string, string];
  };
  readonly sidebar: {
    readonly group: string;
    readonly items: readonly [string, string, string, string, string];
  };
  readonly toast: {
    readonly title: string;
    /** The toast's body, given the formatted reading and meter number. */
    readonly description: (reading: string, meter: string) => string;
  };
  readonly select: {
    readonly label: string;
  };
  readonly form: {
    readonly title: string;
    readonly email: string;
    readonly phone: string;
    readonly paper: string;
    readonly save: string;
  };
  readonly tabs: {
    readonly items: readonly [string, string, string];
    readonly usage: string;
  };
  /** A day, a week and a month, as a period switch names them. */
  readonly periods: readonly [string, string, string];
  readonly accordion: readonly [
    { readonly question: string; readonly answer: string },
    { readonly question: string; readonly answer: string },
    { readonly question: string; readonly answer: string },
  ];
  readonly alert: {
    readonly title: string;
    readonly description: string;
  };
  readonly addons: {
    readonly label: string;
    readonly alerts: string;
    readonly alertsDescription: string;
    readonly paper: string;
    readonly paperDescription: string;
  };
  readonly contract: {
    readonly label: string;
    readonly fixed: string;
    readonly spot: string;
  };
  readonly budget: {
    readonly slider: string;
    readonly meter: string;
  };
  readonly breadcrumb: {
    readonly customers: string;
  };
  readonly menu: {
    readonly trigger: string;
    readonly items: readonly [string, string, string];
    readonly destructive: string;
  };
  readonly popover: {
    readonly trigger: string;
    readonly title: string;
    readonly description: string;
  };
  readonly tooltip: string;
  readonly people: {
    readonly since: (year: string) => string;
  };
  readonly empty: {
    readonly title: string;
    readonly description: string;
  };
  readonly toolbar: {
    readonly label: string;
    readonly duplicate: string;
  };
  readonly timeline: readonly [string, string, string];
  readonly details: {
    readonly heading: string;
    readonly name: string;
    readonly customerNumber: string;
    readonly address: string;
  };
  readonly combobox: {
    readonly label: string;
  };
  readonly type: {
    readonly heading: string;
    readonly body: string;
  };
  readonly search: {
    readonly placeholder: string;
  };
};
