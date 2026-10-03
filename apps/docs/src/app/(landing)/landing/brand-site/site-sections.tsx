import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { ArrowRight, Star, TrendUp } from "@elmeragroup/fuse/icons";
import type { BrandCode, SupportedLocale } from "@elmeragroup/fuse/theme";

import { BrandWordmark } from "../brand-wordmark";
import { Band } from "./site-band";
import type { Site, SiteHelpCard, SiteSection } from "./site-model";
import { SiteActionRow, SiteButton, SitePhoto } from "./site-parts";
import { SitePriceArea } from "./site-price-area";
import { SiteSpotlights } from "./site-spotlights";

const siteCards = tv({
  slots: {
    grid: "@3xl:grid-cols-3 m-0 grid list-none gap-5 p-0",
    // Two help cards share the row between them; three or more take a third each.
    helpGrid: "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-5 p-0",
    story: "flex flex-col gap-4",
    storyPhoto: "h-auto w-full rounded-xl outline-1 -outline-offset-1 outline-foreground/10",
    storyTitle: "text-lg font-medium text-balance",
    storyLink:
      "text-sm font-medium group/story inline-flex min-h-8 items-center gap-3 self-start rounded-full text-current no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    storyArrow:
      "ease-snap flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-200 group-hover/story:translate-x-0.5",
    more: "self-center",
    share: "@3xl:grid-cols-2 grid gap-5",
    quote: "shadow-xs flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-card-foreground",
    quoteTicker: "text-sm font-medium text-muted-foreground",
    quotePrice: "flex items-baseline gap-2",
    quoteValue: "text-5xl font-semibold tracking-tight tabular-nums",
    quoteCurrency: "text-sm text-muted-foreground",
    quoteChange: "text-sm flex items-center gap-1.5 text-success tabular-nums",
    spark: "h-16 w-full text-primary",
    facts: "m-0 grid grid-cols-3 gap-3 border-t border-border pt-4",
    factLabel: "text-xs text-muted-foreground",
    factValue: "text-sm font-semibold m-0 tabular-nums",
    updated: "text-xs text-muted-foreground",
    calendar:
      "shadow-xs flex flex-col gap-1 rounded-xl border border-border bg-card p-6 text-card-foreground",
    calendarTitle: "text-sm font-medium pb-2 text-muted-foreground",
    events: "m-0 list-none p-0",
    eventText: "flex flex-col gap-0.5",
    event: "flex items-center gap-4 border-t border-border py-3.5",
    eventDate:
      "flex size-12 shrink-0 flex-col items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground",
    eventDay: "text-lg font-semibold leading-none tabular-nums",
    eventMonth: "text-2xs font-medium uppercase",
    eventTitle: "text-sm font-medium",
    eventDetail: "text-xs text-muted-foreground",
    brands: "@xl:grid-cols-2 @4xl:grid-cols-5 m-0 grid list-none gap-3 p-0",
    brand:
      "landing-press shadow-xs flex h-full w-full cursor-pointer flex-col items-start gap-3 rounded-lg border border-border bg-card p-4 text-left text-card-foreground outline-none hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    brandLogo: "flex h-7 items-center text-foreground",
    brandName: "text-sm font-semibold",
    brandText: "text-xs text-pretty text-muted-foreground",
    features: "@3xl:grid-cols-3 @3xl:gap-0 m-0 grid list-none gap-8 p-0",
    feature:
      "@3xl:border-l @3xl:px-8 @3xl:first:border-l-0 @3xl:first:pl-0 flex flex-col items-start gap-3 border-border",
    featureIcon:
      "mb-2 flex size-9 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground",
    featureTitle: "text-lg font-semibold",
    featureText: "text-sm text-pretty text-muted-foreground",
    featureLink:
      "text-sm font-medium group/feature mt-1 inline-flex min-h-6 items-center gap-1.5 rounded-sm text-primary no-underline outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
    featureArrow: "ease-snap size-3.5 transition-transform duration-200 group-hover/feature:translate-x-0.5",
    glow: "max-w-3xl pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto aspect-square -translate-y-1/2 rounded-full bg-radial from-primary-soft to-transparent to-70%",
    closingActions: "justify-center",
  },
});

const cards = siteCards();

const siteHelpCard = tv({
  slots: {
    card: "flex h-full flex-col items-start gap-3 rounded-xl p-6",
    disc: "mb-2 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground",
    discIcon: "size-6",
    photo:
      "mb-2 aspect-16/9 w-full rounded-lg object-cover outline-1 -outline-offset-1 outline-foreground/10",
    title: "text-xl font-medium font-heading text-balance",
    text: "text-sm text-pretty opacity-80",
    actions: "mt-auto pt-3",
  },
  variants: {
    // An icon card is a tint of the brand; a photo card is a raised white card the photo leads.
    // Inside a filled band in dark mode both step down to the page, where the band is the soft tint.
    visual: {
      Icon: {
        card: "landing-dark:in-data-filled:bg-background bg-primary-soft text-primary-soft-foreground",
      },
      Photo: {
        card: "shadow-sm landing-dark:in-data-filled:bg-background bg-card text-card-foreground ring-1 ring-border",
      },
    } satisfies Record<SiteHelpCard["visual"]["_tag"], { card: string }>,
  },
});

/** A help card: its icon on a disc or its photo, the title, a line and the card's actions. */
function HelpCard({ card }: { card: SiteHelpCard }): ReactElement {
  const styles = siteHelpCard({ visual: card.visual._tag });
  return (
    <div className={styles.card()}>
      {card.visual._tag === "Icon" ? (
        <span aria-hidden className={styles.disc()}>
          <card.visual.icon className={styles.discIcon()} />
        </span>
      ) : (
        <SitePhoto image={card.visual.image} className={styles.photo()} />
      )}
      <h3 className={styles.title()}>{card.title}</h3>
      <p className={styles.text()}>{card.text}</p>
      <SiteActionRow
        actions={card.actions}
        primary="outline"
        quiet="outline"
        size="sm"
        className={styles.actions()}
      />
    </div>
  );
}

const siteShortcuts = tv({
  slots: {
    list: "m-0 grid list-none p-0",
    link: "landing-press group/shortcut flex h-full items-center no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    label: "text-pretty",
    arrow: "ease-snap size-5 shrink-0 transition-transform duration-200 group-hover/shortcut:translate-x-0.5",
  },
  variants: {
    // `tabs` underline each shortcut with a heavy rule, as TrøndelagKraft's do; `tiles` fill each
    // one with the brand colour and point an arrow onward, as Gudbrandsdal Energi's do.
    style: {
      tabs: {
        list: "@3xl:grid-cols-5 @md:grid-cols-3 max-w-4xl mx-auto w-full grid-cols-2 gap-x-6 gap-y-3",
        link: "text-base font-semibold @3xl:text-lg min-h-14 justify-center border-b-4 border-current text-center font-heading text-current transition-colors duration-150 hover:border-primary",
        arrow: "hidden",
      },
      tiles: {
        list: "@3xl:grid-cols-3 max-w-4xl mx-auto w-full grid-cols-1 gap-4",
        link: "text-xl font-semibold @3xl:text-2xl tracking-tight min-h-20 justify-between gap-3 rounded-lg bg-primary px-6 font-heading text-primary-foreground transition-colors duration-150 hover:bg-primary/90",
      },
    },
  },
});

const siteLinkCards = tv({
  slots: {
    list: "@3xl:grid-cols-3 m-0 grid list-none gap-4 p-0",
    card: "shadow-xs rounded-2xl hover:shadow-md relative flex h-full flex-col gap-2 bg-card p-6 text-card-foreground transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring",
    title: "text-2xl font-medium font-heading text-balance text-primary",
    text: "text-base text-pretty",
    // The link stretches over the whole card, so the card is one target with one name.
    link: "text-base font-medium group/card after:rounded-2xl mt-auto flex items-center gap-3 self-start pt-4 text-current no-underline outline-none after:absolute after:inset-0",
    // `accent` stays apart from the card in both schemes; most dark sheets set the soft tint to it.
    arrow:
      "ease-snap flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-200 group-hover/card:translate-x-0.5",
  },
});

const linkCards = siteLinkCards();

const siteReviews = tv({
  slots: {
    list: "@3xl:grid-cols-3 m-0 grid list-none gap-5 p-0",
    card: "rounded-2xl flex h-full flex-col items-center gap-4 bg-secondary-soft px-7 py-10 text-center text-secondary-soft-foreground",
    stars: "flex gap-1 text-primary",
    star: "size-5",
    title: "text-xl font-semibold tracking-tight font-heading text-balance",
    quote: "text-base m-0 text-pretty",
    author: "text-sm mt-auto opacity-80",
  },
});

const reviews = siteReviews();

const sitePartners = tv({
  slots: {
    list: "m-0 flex list-none flex-wrap justify-center gap-4 p-0",
    badge:
      "text-sm font-semibold @3xl:size-32 flex size-28 items-center justify-center rounded-full border border-border bg-card p-4 text-center text-balance text-card-foreground",
  },
});

const partners = sitePartners();

/** Today's price change, signed, as the share card states it. */
function formatChange(change: number, locale: SupportedLocale): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "always",
    minimumFractionDigits: 2,
  }).format(change / 100);
}

/** The closing prices as an area under a line, scaled to a 100 × 32 box with room to breathe. */
function sparkPaths(history: readonly number[]) {
  const low = Math.min(...history);
  const high = Math.max(...history);
  const span = high - low || 1;
  const points = history.map((price, index) => {
    const x = (index / Math.max(history.length - 1, 1)) * 100;
    const y = 30 - ((price - low) / span) * 26;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M${points.join(" L")}`;
  return { line, area: `${line} L100,32 L0,32 Z` };
}

/** A calendar date's day and short month in the site's language. */
function calendarDay(date: string, locale: SupportedLocale) {
  const at = new Date(`${date}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(at),
    month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(at).replace(".", ""),
  };
}

type SectionProps = {
  section: SiteSection;
  site: Site;
  /** Picks a brand from the group's grid; the landing re-themes and shows that brand's site. */
  onPickBrand: (brand: BrandCode) => void;
};

/** One section below the hero, drawn from its config. */
export function SiteSectionView({ section, site, onPickBrand }: SectionProps): ReactElement {
  // Prefixed with the brand, so a section's id never meets one of the landing's own.
  const band = {
    tone: section.tone,
    heading: site.headings,
    id: `${site.brand}-${section.id}`,
    title: section.title,
    head: section.head,
  };
  switch (section._tag) {
    case "Help":
      return (
        <Band {...band} lede={section.lede}>
          <ul className={cards.helpGrid()}>
            {section.cards.map((card) => (
              <li key={card.title}>
                <HelpCard card={card} />
              </li>
            ))}
          </ul>
        </Band>
      );
    case "PriceArea":
      return (
        <Band {...band} lede={section.lede}>
          <SitePriceArea section={section} locale={site.locale} />
        </Band>
      );
    case "Stories":
      return (
        <Band {...band} lede={section.lede}>
          <ul className={cards.grid()}>
            {section.stories.map((story) => (
              <li key={story.link.href} className={cards.story()}>
                <SitePhoto image={story.image} className={cards.storyPhoto()} />
                <h3 className={cards.storyTitle()}>{story.title}</h3>
                <a href={story.link.href} className={cards.storyLink()}>
                  {story.link.label}
                  <span aria-hidden className={cards.storyArrow()}>
                    <ArrowRight />
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {section.more === undefined ? null : (
            <SiteButton link={section.more} variant="outline" size="lg" className={cards.more()} />
          )}
        </Band>
      );
    case "Share": {
      const { quote, calendar } = section;
      const spark = sparkPaths(quote.history);
      return (
        <Band {...band} lede={section.lede} actions={section.actions}>
          <div className={cards.share()}>
            <div className={cards.quote()}>
              <p className={cards.quoteTicker()}>{quote.ticker}</p>
              <p className={cards.quotePrice()}>
                <span className={cards.quoteValue()}>
                  {new Intl.NumberFormat(site.locale, { minimumFractionDigits: 2 }).format(quote.price)}
                </span>
                <span className={cards.quoteCurrency()}>{quote.currency}</span>
              </p>
              <p className={cards.quoteChange()}>
                <TrendUp aria-hidden />
                {`${formatChange(quote.change, site.locale)} ${quote.changeLabel}`}
              </p>
              <svg aria-hidden viewBox="0 0 100 32" preserveAspectRatio="none" className={cards.spark()}>
                <path d={spark.area} fill="currentColor" fillOpacity={0.12} />
                <path
                  d={spark.line}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <dl className={cards.facts()}>
                {quote.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt className={cards.factLabel()}>{fact.label}</dt>
                    <dd className={cards.factValue()}>{fact.value}</dd>
                  </div>
                ))}
              </dl>
              <p className={cards.updated()}>{quote.updated}</p>
            </div>
            <div className={cards.calendar()}>
              <h3 className={cards.calendarTitle()}>{calendar.title}</h3>
              <ol className={cards.events()}>
                {calendar.events.map((event) => {
                  const { day, month } = calendarDay(event.date, site.locale);
                  return (
                    <li key={event.date} className={cards.event()}>
                      <time dateTime={event.date} className={cards.eventDate()}>
                        <span className={cards.eventDay()}>{day}</span>
                        <span className={cards.eventMonth()}>{month}</span>
                      </time>
                      <span className={cards.eventText()}>
                        <span className={cards.eventTitle()}>{event.title}</span>
                        <span className={cards.eventDetail()}>{event.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </Band>
      );
    }
    case "Brands":
      return (
        <Band {...band} lede={section.lede}>
          <ul aria-label={section.title} className={cards.brands()}>
            {section.brands.map((brand) => (
              <li key={brand.brand}>
                <button type="button" className={cards.brand()} onClick={() => onPickBrand(brand.brand)}>
                  <span aria-hidden className={cards.brandLogo()}>
                    <BrandWordmark brand={brand.brand} />
                  </span>
                  <span className={cards.brandName()}>{brand.name}</span>
                  <span className={cards.brandText()}>{brand.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </Band>
      );
    case "Features":
      return (
        <Band {...band} lede={section.lede}>
          <ul className={cards.features()}>
            {section.features.map((feature) => (
              <li key={feature.title} className={cards.feature()}>
                <span aria-hidden className={cards.featureIcon()}>
                  <feature.icon />
                </span>
                <h3 className={cards.featureTitle()}>{feature.title}</h3>
                <p className={cards.featureText()}>{feature.text}</p>
                <a href={feature.link.href} className={cards.featureLink()}>
                  {feature.link.label}
                  <ArrowRight aria-hidden className={cards.featureArrow()} />
                </a>
              </li>
            ))}
          </ul>
        </Band>
      );
    case "QuickLinks": {
      const styles = siteShortcuts({ style: section.style });
      return (
        <Band {...band}>
          <ul className={styles.list()}>
            {section.links.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={styles.link()}>
                  <span className={styles.label()}>{link.label}</span>
                  <ArrowRight aria-hidden className={styles.arrow()} />
                </a>
              </li>
            ))}
          </ul>
        </Band>
      );
    }
    case "LinkCards":
      return (
        <Band {...band}>
          <ul className={linkCards.list()}>
            {section.cards.map((card) => (
              <li key={card.link.href} className={linkCards.card()}>
                <h3 className={linkCards.title()}>{card.title}</h3>
                <p className={linkCards.text()}>{card.text}</p>
                <a href={card.link.href} className={linkCards.link()}>
                  {card.link.label}
                  <span aria-hidden className={linkCards.arrow()}>
                    <ArrowRight />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Band>
      );
    case "Spotlights":
      return (
        <Band {...band}>
          <SiteSpotlights section={section} level={section.head === "label" ? 2 : 3} />
        </Band>
      );
    case "Reviews":
      return (
        <Band {...band}>
          <ul className={reviews.list()}>
            {section.reviews.map((review) => (
              <li key={review.author}>
                <figure className={reviews.card()}>
                  <span
                    role="img"
                    aria-label={`${String(review.rating)} ${section.ratingLabel}`}
                    className={reviews.stars()}>
                    {Array.from({ length: review.rating }, (_, index) => (
                      <Star key={index} weight="fill" aria-hidden className={reviews.star()} />
                    ))}
                  </span>
                  <h3 className={reviews.title()}>{review.title}</h3>
                  <blockquote className={reviews.quote()}>{review.quote}</blockquote>
                  <figcaption className={reviews.author()}>{review.author}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </Band>
      );
    case "Partners":
      return (
        <Band {...band} lede={section.lede}>
          <ul className={partners.list()}>
            {section.partners.map((partner) => (
              <li key={partner} className={partners.badge()}>
                {partner}
              </li>
            ))}
          </ul>
        </Band>
      );
    case "Closing":
      return (
        <Band {...band} heading="center" lede={section.lede}>
          <div aria-hidden className={cards.glow()} />
          <SiteActionRow actions={section.actions} className={cards.closingActions()} />
        </Band>
      );
  }
}
