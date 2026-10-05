import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import type { Site, SiteActions, SiteSection, SiteTone } from "./site-model";
import { SiteActionRow } from "./site-parts";

const siteBand = tv({
  slots: {
    band: "@3xl:py-20 relative isolate overflow-hidden py-14",
    inner: "max-w-6xl @3xl:px-10 mx-auto flex w-full flex-col gap-10 px-5",
    head: "flex flex-col gap-3",
    title: "text-3xl font-medium tracking-tight @3xl:text-4xl font-heading text-balance",
    aside: "flex flex-col gap-5",
    lede: "text-base max-w-xl text-pretty opacity-80",
  },
  variants: {
    // In dark mode a filled band takes the brand's soft surface, which every dark sheet keeps
    // dark: its `primary` and `secondary` are light inks there.
    tone: {
      // A band that follows one of its own tone drops its top padding: the two read as one
      // surface, and the previous band's bottom padding already spaces them.
      page: { band: "bg-background text-foreground [[data-tone=page]+&]:pt-0" },
      soft: { band: "bg-card-soft text-card-soft-foreground [[data-tone=soft]+&]:pt-0" },
      strong: {
        band: "landing-dark:bg-primary-soft landing-dark:text-primary-soft-foreground bg-primary text-primary-foreground [[data-tone=strong]+&]:pt-0",
      },
      inverse: {
        band: "landing-dark:bg-primary-soft landing-dark:text-primary-soft-foreground bg-secondary text-secondary-foreground [[data-tone=inverse]+&]:pt-0",
      },
    } satisfies Record<SiteTone, { band: string }>,
    // `center` stacks a centred heading over its lede; `split` puts the lede beside it.
    heading: {
      center: { head: "items-center text-center", aside: "items-center", lede: "mx-auto" },
      split: { head: "@3xl:flex-row @3xl:items-end @3xl:justify-between @3xl:gap-16" },
    },
  },
});

/** The tones that fill the band with a brand colour, where a nested card needs its own surface. */
const FILLED_TONES: ReadonlySet<SiteTone> = new Set(["strong", "inverse"]);

/**
 * A band of the page in its tone, with the section's heading and lede over its content. A
 * section whose head is `label` draws no heading: its title names the band's region instead.
 * A filled band carries `data-filled`, so a card inside it can pick a surface that stays apart
 * from the band in both schemes.
 */
export function Band({
  tone,
  heading,
  id,
  title,
  head = "shown",
  lede,
  actions,
  children,
}: {
  tone: SiteTone;
  heading: Site["headings"];
  id: string;
  title: string;
  head?: SiteSection["head"];
  lede?: string;
  /** Calls to action that belong to the heading rather than to one card. */
  actions?: SiteActions;
  children: ReactNode;
}): ReactElement {
  const styles = siteBand({ tone, heading });
  const titleId = `${id}-title`;
  const shown = head === "shown";
  return (
    <section
      id={id}
      {...(shown ? { "aria-labelledby": titleId } : { "aria-label": title })}
      data-tone={tone}
      data-filled={FILLED_TONES.has(tone) ? "" : undefined}
      className={styles.band()}>
      <div className={styles.inner()}>
        {shown ? (
          <div className={styles.head()}>
            <h2 id={titleId} className={styles.title()}>
              {title}
            </h2>
            {lede === undefined && actions === undefined ? null : (
              <div className={styles.aside()}>
                {lede === undefined ? null : <p className={styles.lede()}>{lede}</p>}
                {actions === undefined ? null : <SiteActionRow actions={actions} size="default" />}
              </div>
            )}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
