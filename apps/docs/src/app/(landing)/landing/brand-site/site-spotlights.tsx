import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { SiteChecklist } from "./site-checklist";
import type { SiteSection, SiteSpotlightFrame } from "./site-model";
import { SiteButton, SitePhoto } from "./site-parts";

/** The parts a spotlight frame restyles. */
type SpotlightSlot = "list" | "item" | "media" | "photo" | "backdrop" | "copy" | "kicker" | "title" | "text";

/**
 * A photo beside its copy, in one of five frames: TrøndelagKraft's flush tinted panels,
 * Gudbrandsdal Energi's soft rounded panel, Telinet's raised card and its illustration on the
 * band, and Fjordkraft's oval photo on an offset oval.
 */
const siteSpotlight = tv({
  slots: {
    list: "flex flex-col",
    item: "grid *:min-w-0",
    media: "relative",
    photo: "",
    backdrop: "hidden",
    copy: "flex flex-col items-start justify-center gap-4",
    kicker: "text-xs font-medium tracking-widest uppercase opacity-75",
    title: "text-3xl font-semibold tracking-tight @3xl:text-4xl font-heading text-balance hyphens-auto",
    lead: "text-base font-semibold @3xl:text-lg text-pretty",
    text: "text-base @3xl:text-lg max-w-prose text-pretty",
    action: "mt-2",
    // The illustration frame closes with a plain underlined link, as its reference does.
    textLink:
      "text-base font-medium mt-1 inline-flex min-h-6 items-center rounded-sm text-current underline decoration-current/40 underline-offset-4 transition-colors duration-150 outline-none hover:decoration-current focus-visible:ring-2 focus-visible:ring-ring",
  },
  variants: {
    frame: {
      panel: {
        list: "gap-6",
        item: "@3xl:grid-cols-2 overflow-hidden rounded-lg",
        media: "@3xl:min-h-80 min-h-56",
        photo: "absolute inset-0 size-full object-cover",
        copy: "@3xl:p-12 bg-primary-soft p-7 text-primary-soft-foreground",
      },
      soft: {
        list: "gap-6",
        item: "@3xl:grid-cols-[2fr_3fr] @3xl:gap-12 @3xl:p-14 rounded-2xl items-center gap-7 bg-primary-soft p-6 text-primary-soft-foreground",
        media: "aspect-square overflow-hidden rounded-xl",
        photo: "size-full object-cover",
      },
      card: {
        list: "gap-8",
        item: "shadow-lg @3xl:grid-cols-2 overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-border",
        media: "@3xl:min-h-96 min-h-60",
        photo: "absolute inset-0 size-full object-cover",
        copy: "@3xl:p-12 p-7",
        kicker: "text-muted-foreground opacity-100",
        text: "text-muted-foreground",
      },
      art: {
        list: "gap-10",
        item: "@3xl:grid-cols-2 @3xl:gap-16 items-center gap-8",
        media: "flex justify-center",
        photo: "@3xl:max-w-xs h-auto w-full max-w-56",
        copy: "@3xl:max-w-lg",
        title: "font-medium",
      },
      oval: {
        list: "gap-12",
        item: "@3xl:grid-cols-2 @3xl:gap-16 items-center gap-10",
        media: "max-w-md mx-auto aspect-6/5 w-full",
        // An oval in the band's own ink trails the photo, as the reference's offset ovals do.
        backdrop: "absolute inset-y-[8%] -left-[10%] block w-full rounded-full bg-current opacity-10",
        photo: "relative size-full rounded-full object-cover",
      },
    } satisfies Record<SiteSpotlightFrame, Partial<Record<SpotlightSlot, string>>>,
    side: {
      start: {},
      end: { media: "@3xl:order-last" },
    },
  },
});

type SpotlightsSection = Extract<SiteSection, { _tag: "Spotlights" }>;

/** Which side a spotlight's photo takes: the section's side, or every other one when alternating. */
function photoSide(order: SpotlightsSection["order"], index: number): "start" | "end" {
  switch (order) {
    case "start":
    case "end":
      return order;
    case "alternate":
      return index % 2 === 0 ? "start" : "end";
  }
}

/**
 * A spotlight section's rows. Each spotlight's title takes `level`: `h2` when the section draws
 * no heading of its own, so every row stays in the page's outline.
 */
export function SiteSpotlights({
  section,
  level,
}: {
  section: SpotlightsSection;
  level: 2 | 3;
}): ReactElement {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={siteSpotlight({ frame: section.frame }).list()}>
      {section.spotlights.map((spotlight, index) => {
        const styles = siteSpotlight({ frame: section.frame, side: photoSide(section.order, index) });
        return (
          <article key={spotlight.title} className={styles.item()}>
            <div className={styles.media()}>
              <span aria-hidden className={styles.backdrop()} />
              <SitePhoto image={spotlight.image} className={styles.photo()} />
            </div>
            <div className={styles.copy()}>
              {spotlight.kicker === undefined ? null : <p className={styles.kicker()}>{spotlight.kicker}</p>}
              <Heading className={styles.title()}>{spotlight.title}</Heading>
              {spotlight.lead === undefined ? null : <p className={styles.lead()}>{spotlight.lead}</p>}
              {spotlight.paragraphs.map((paragraph) => (
                <p key={paragraph} className={styles.text()}>
                  {paragraph}
                </p>
              ))}
              {spotlight.checklist === undefined ? null : <SiteChecklist checklist={spotlight.checklist} />}
              {section.frame === "art" ? (
                <a href={spotlight.action.href} className={styles.textLink()}>
                  {spotlight.action.label}
                </a>
              ) : (
                <SiteButton link={spotlight.action} size="lg" className={styles.action()} />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
