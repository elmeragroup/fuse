import type { ReactElement, ReactNode, RefObject } from "react";

import type { BrandCode } from "@elmeragroup/fuse/theme";

import type { SiteSection } from "../../copy/catalog";
import type { FrameClock } from "../../motion/frame-clock";
import { SeekedOverlay } from "../../motion/seeked-overlay";
import { Rise } from "../../primitives/rise";
import { useAnchoredPoint } from "../../primitives/stage";
import type { StagePoint } from "../../primitives/stage";
import { SiteCalculator } from "./site-calculator";
import { SiteFaq } from "./site-faq";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { SiteHero } from "./site-hero";
import { SITE_SECTIONS, SITE_WIDTH, sectionHeight, SITE_HEIGHT } from "./site-layout";
import { SitePlans } from "./site-plans";

/** The attribute that marks the page, which points on it are measured from. */
const PAGE_ATTRIBUTE = "data-site-page";

/** The page's top-left corner, where a point sits until its element is measured. */
const PAGE_ORIGIN: StagePoint = { x: 0, y: 0 };

/**
 * The centre of an element on the page, in site pixels, from its untransformed layout, so the
 * camera's scale and scroll and a section's rise never move it.
 *
 * @param ref - The element to measure, inside a {@link SitePage}.
 * @returns The element's centre, or the page's top-left corner before the first layout.
 */
export function usePagePoint(ref: RefObject<HTMLElement | null>): StagePoint {
  return useAnchoredPoint(ref, PAGE_ATTRIBUTE, PAGE_ORIGIN);
}

/** Props for {@link SitePage}. */
export type SitePageProps = {
  readonly brand: BrandCode;
  /** Each section's write, which lands the section on its `lands` frame; it is laid out before it, and hidden. */
  readonly writes: Readonly<Record<SiteSection, { readonly lands: number }>>;
  readonly yearlyKwh: number;
  /** The frame the first question opens on, with Fuse's own motion. */
  readonly faqOpensAt: number;
  readonly clock: FrameClock;
  /** Receives the calculator's order button. */
  readonly order: RefObject<HTMLButtonElement | null>;
  /** Drawn over the page, in its coordinates: the cursor. */
  readonly children?: ReactNode;
};

/**
 * The site Claude builds, every section in its reserved box from the first frame. A section
 * rises in on the frame its write returns, the way a dev server swaps in a saved file.
 *
 * @returns The page, `SITE_WIDTH` wide and `SITE_HEIGHT` tall.
 */
export function SitePage({
  brand,
  writes,
  yearlyKwh,
  faqOpensAt,
  clock,
  order,
  children,
}: SitePageProps): ReactElement {
  const sections = {
    header: <SiteHeader brand={brand} />,
    hero: <SiteHero brand={brand} />,
    plans: <SitePlans brand={brand} />,
    calculator: <SiteCalculator brand={brand} yearlyKwh={yearlyKwh} order={order} />,
    // The accordion is no overlay, but it animates its opening as one does: Base UI animates only
    // a change it sees, so the motion host replays it closed and opens it on its frame.
    faq: (
      <SeekedOverlay openAt={faqOpensAt} clock={clock}>
        {({ open }) => <SiteFaq open={open} />}
      </SeekedOverlay>
    ),
    footer: <SiteFooter brand={brand} />,
  } satisfies Record<SiteSection, ReactNode>;
  return (
    <div
      {...{ [PAGE_ATTRIBUTE]: "" }}
      className="relative bg-background"
      style={{ width: SITE_WIDTH, height: SITE_HEIGHT }}>
      {SITE_SECTIONS.map((section) => (
        <Rise key={section} at={writes[section].lands} distance={16} className="relative">
          <div style={{ height: sectionHeight(section) }}>{sections[section]}</div>
        </Rise>
      ))}
      {children}
    </div>
  );
}
