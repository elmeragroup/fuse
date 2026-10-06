import type { ReactElement } from "react";

import type { ElmeraIconProps } from "@elmeragroup/fuse/icons";
import type { BrandCode, SupportedLocale } from "@elmeragroup/fuse/theme";

/**
 * One brand's public website, reskinned with Fuse, as data. The theme owns colour, radius,
 * button shape and heading font; everything a brand changes beyond that lives here, so the
 * shared parts never branch on a brand code.
 */

/** A Fuse icon, as a component the config can name. */
export type SiteIcon = (props: ElmeraIconProps) => ReactElement;

/** A link inside the demo site. The site never navigates, so every target is a fragment. */
export type SiteLink = {
  readonly label: string;
  readonly href: `#${string}`;
};

/** A link in a nav panel: its title over one line that says what is behind it. */
export type SitePanelLink = SiteLink & {
  readonly description: string;
};

/** One entry in the primary nav: a panel of links, or a plain link. */
export type SiteNavItem =
  | {
      readonly _tag: "Menu";
      readonly label: string;
      readonly icon?: SiteIcon;
      readonly links: readonly SitePanelLink[];
    }
  | {
      readonly _tag: "Link";
      readonly label: string;
      readonly href: `#${string}`;
      readonly icon?: SiteIcon;
    };

/** The header: the utility row, the nav and the actions at its end. */
export type SiteHeader = {
  /** `single` puts the nav in the logo's row; `stacked` gives it a row of its own below. */
  readonly layout: "single" | "stacked";
  /** The audience tabs above or beside the nav (Privat, Bedrift), the first one current. */
  readonly segments?: {
    readonly label: string;
    readonly items: readonly [SiteLink, ...SiteLink[]];
  };
  /** Small links at the end of the utility row, such as customer service. */
  readonly utility?: readonly SiteLink[];
  readonly nav: {
    readonly label: string;
    readonly items: readonly SiteNavItem[];
  };
  readonly search?: string;
  readonly cta: SiteLink;
  readonly signIn?: SiteLink;
  /** The phone menu's trigger, which also names its Sheet. */
  readonly menu: string;
};

/** A photo with its alt text in the site's language and its intrinsic size. */
export type SiteImage = {
  readonly src: `/landing/sites/${string}.webp`;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
};

/** Ticked benefits under a heading, named for assistive technology. */
export type SiteChecklist = {
  readonly label: string;
  readonly title?: string;
  readonly items: readonly [string, ...string[]];
};

/** The hero's two calls to action: the primary one and an optional quieter one. */
export type SiteActions = readonly [SiteLink] | readonly [SiteLink, SiteLink];

/** A tile laid over the overlay hero's photo, filled with one of the theme's contract pairs. */
export type SiteHeroTile = {
  readonly tone: "secondary" | "primary" | "soft";
  readonly title: string;
  readonly text: string;
  readonly href: `#${string}`;
};

/**
 * The hero, one closed layout per reference. Each layout carries the fields its signature
 * needs: the centred one its announcement, the overlay one its tiles, the promo one its kicker.
 */
export type SiteHero =
  | {
      readonly layout: "centered";
      readonly announcement: { readonly text: string; readonly link: SiteLink };
      readonly title: string;
      readonly lede: string;
      readonly actions: SiteActions;
    }
  | {
      readonly layout: "card" | "angled";
      readonly title: string;
      readonly checklist: SiteChecklist;
      readonly actions: SiteActions;
      readonly image: SiteImage;
    }
  | {
      readonly layout: "panel";
      readonly title: string;
      readonly lede: string;
      readonly actions: SiteActions;
      readonly image: SiteImage;
    }
  | {
      readonly layout: "overlay";
      readonly title: string;
      readonly tiles: readonly [SiteHeroTile, SiteHeroTile, SiteHeroTile];
      readonly image: SiteImage;
    }
  | {
      readonly layout: "promo";
      readonly kicker: string;
      readonly title: string;
      readonly lede: string;
      readonly checklist: SiteChecklist;
      readonly actions: SiteActions;
      readonly image: SiteImage;
    };

/** What heads a help card: a Fuse icon on a disc, or a photo across the card's top. */
export type SiteHelpVisual =
  | { readonly _tag: "Icon"; readonly icon: SiteIcon }
  | { readonly _tag: "Photo"; readonly image: SiteImage };

/** A help or contact card: its icon or photo, a title, one paragraph and its actions. */
export type SiteHelpCard = {
  readonly visual: SiteHelpVisual;
  readonly title: string;
  readonly text: string;
  readonly actions: SiteActions;
};

/** A price area and today's spot price there, in øre or öre per kWh. */
export type SitePriceArea = {
  readonly code: string;
  readonly name: string;
  /** Today's average, lowest and highest hourly price. */
  readonly average: number;
  readonly low: number;
  readonly high: number;
};

/** A story card: a photo, a headline and the link under it. */
export type SiteStory = {
  readonly image: SiteImage;
  readonly title: string;
  readonly link: SiteLink;
};

/** An event in a financial calendar. */
export type SiteCalendarEvent = {
  /** ISO date, read in the site's locale. */
  readonly date: `${number}-${number}-${number}`;
  readonly title: string;
  readonly detail: string;
};

/** A brand in the group's grid. A Fuse brand re-themes the landing when picked. */
export type SiteBrandCard = {
  readonly brand: BrandCode;
  readonly name: string;
  readonly text: string;
};

/** A business area: an icon, a title, a paragraph and a link. */
export type SiteFeature = {
  readonly icon: SiteIcon;
  readonly title: string;
  readonly text: string;
  readonly link: SiteLink;
};

/** A card that leads somewhere: a title, one line about it and the link at its foot. */
export type SiteLinkCard = {
  readonly title: string;
  readonly text: string;
  readonly link: SiteLink;
};

/**
 * A photo beside its copy: an optional kicker over the heading, a lead line, paragraphs, an
 * optional checklist and one action. Each spotlight carries the section's heading level.
 */
export type SiteSpotlight = {
  readonly image: SiteImage;
  readonly kicker?: string;
  readonly title: string;
  readonly lead?: string;
  readonly paragraphs: readonly [string, ...string[]];
  readonly checklist?: SiteChecklist;
  readonly action: SiteLink;
};

/** A customer's review: a star rating out of five, its headline, the quote and who said it. */
export type SiteReview = {
  readonly rating: 1 | 2 | 3 | 4 | 5;
  readonly title: string;
  readonly quote: string;
  readonly author: string;
};

/** The surface a band of the page sits on, each a contract pair of the theme. */
export type SiteTone = "page" | "soft" | "strong" | "inverse";

/**
 * What every section has: an id, the band's tone and its title. A reference that draws a
 * section without a heading sets `head: "label"`, and the title then names the section's region
 * for assistive technology instead of being drawn.
 */
type SiteSectionBase = {
  readonly id: string;
  readonly tone: SiteTone;
  readonly title: string;
  readonly head?: "shown" | "label";
};

/**
 * How a spotlight section frames each photo and its copy, one per reference: a flush tinted
 * panel, a soft rounded panel, a raised card, copy beside an illustration on the band, or an
 * oval photo on an offset oval.
 */
export type SiteSpotlightFrame = "panel" | "soft" | "card" | "art" | "oval";

/** The sections below the hero, rendered in config order. */
export type SiteSection = SiteSectionBase &
  (
    | {
        readonly _tag: "Help";
        readonly lede?: string;
        readonly cards: readonly SiteHelpCard[];
      }
    | {
        readonly _tag: "PriceArea";
        readonly lede: string;
        readonly label: string;
        readonly placeholder: string;
        readonly unit: string;
        readonly labels: {
          readonly average: string;
          readonly low: string;
          readonly high: string;
          /** What the result says before an area is picked. */
          readonly empty: string;
          /** Names the hourly chart, with the area's code appended. */
          readonly chart: string;
        };
        readonly areas: readonly [SitePriceArea, ...SitePriceArea[]];
        readonly note: { readonly title: string; readonly text: string };
      }
    | {
        readonly _tag: "Stories";
        readonly lede?: string;
        readonly stories: readonly SiteStory[];
        readonly more?: SiteLink;
      }
    | {
        readonly _tag: "Share";
        readonly lede: string;
        readonly actions: SiteActions;
        readonly quote: {
          readonly ticker: string;
          readonly price: number;
          readonly currency: string;
          /** Today's change in percent. */
          readonly change: number;
          readonly changeLabel: string;
          /** The closing prices the sparkline draws, oldest first. */
          readonly history: readonly number[];
          readonly facts: readonly { readonly label: string; readonly value: string }[];
          readonly updated: string;
        };
        readonly calendar: { readonly title: string; readonly events: readonly SiteCalendarEvent[] };
      }
    | {
        readonly _tag: "Brands";
        readonly lede: string;
        readonly brands: readonly SiteBrandCard[];
      }
    | {
        readonly _tag: "Features";
        readonly lede: string;
        readonly features: readonly SiteFeature[];
      }
    | {
        readonly _tag: "Closing";
        readonly lede: string;
        readonly actions: SiteActions;
      }
    | {
        /** A row of shortcuts: underlined `tabs`, or filled `tiles` with an arrow. */
        readonly _tag: "QuickLinks";
        readonly style: "tabs" | "tiles";
        readonly links: readonly [SiteLink, ...SiteLink[]];
      }
    | {
        readonly _tag: "LinkCards";
        readonly cards: readonly [SiteLinkCard, ...SiteLinkCard[]];
      }
    | {
        /**
         * Photos beside their copy. `alternate` swaps the photo's side on every row; `start` and
         * `end` keep it on one side. A section without a shown head gives each spotlight an `h2`.
         */
        readonly _tag: "Spotlights";
        readonly frame: SiteSpotlightFrame;
        readonly order: "alternate" | "start" | "end";
        readonly spotlights: readonly [SiteSpotlight, ...SiteSpotlight[]];
      }
    | {
        readonly _tag: "Reviews";
        /** Follows the rating in the stars' accessible name: "5 av 5 stjerner". */
        readonly ratingLabel: string;
        readonly reviews: readonly [SiteReview, ...SiteReview[]];
      }
    | {
        /** The partners' names, each in a round badge. */
        readonly _tag: "Partners";
        readonly lede?: string;
        readonly partners: readonly [string, ...string[]];
      }
  );

/** One brand's site. */
export type Site = {
  readonly brand: BrandCode;
  /** The site's owner, which names the window's region: "Fjordkraft website". */
  readonly name: string;
  readonly domain: string;
  readonly locale: SupportedLocale;
  /**
   * `elmera-group` is the group's lockup and `brand` the brand's own logo from Fuse.
   * `wordmark` is the landing's one-ink wordmark, for a brand whose Fuse mark keeps a brand colour
   * that one of the schemes hides, as TrøndelagKraft's yellow lamp does on a light header.
   */
  readonly logo: "elmera-group" | "brand" | "wordmark";
  /** `center` stacks section headings over their lede; `split` sets the lede beside the heading. */
  readonly headings: "center" | "split";
  readonly header: SiteHeader;
  readonly hero: SiteHero;
  readonly sections: readonly SiteSection[];
  /** The line under the site in the window's chrome, in English like the rest of the landing. */
  readonly caption: string;
};
