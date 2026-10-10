import { Fragment } from "react";
import type { ReactElement, ReactNode } from "react";

import Link from "next/link";
import { cn, tv } from "tailwind-variants";

import { Meter } from "@elmeragroup/fuse/meter";

import { landingComponent } from "./landing-facts";

const productParts = tv({
  slots: {
    // The labels name the components each card is built from and link to their docs.
    parts:
      "text-2xs tracking-landing-caption mb-2 flex flex-wrap gap-x-1.5 font-mono text-muted-foreground uppercase",
    part: "underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring",
  },
});

const styles = productParts();

/** The vertical stack the product cards, the tabs and the density form lay their content out with. */
export const stack = cn("flex flex-col gap-4");

export type Part = { name: string; slug: string };

export type LabelledProps = {
  parts: readonly Part[];
  children: ReactNode;
};

/**
 * A card with the components it is built from named above it, each linking to its docs page.
 * A slug the site serves no page for throws, so a renamed component cannot leave a dead label.
 */
export function Labelled({ parts, children }: LabelledProps): ReactElement {
  return (
    <div>
      <p className={styles.parts()}>
        {parts.map((part, index) => (
          <Fragment key={part.slug}>
            {index > 0 ? <span aria-hidden>·</span> : null}
            <Link href={landingComponent(part.slug).href} className={styles.part()}>
              {part.name}
            </Link>
          </Fragment>
        ))}
      </p>
      {children}
    </div>
  );
}

/** The budget meter the usage card and the nav's Meter stage both show. */
export function BudgetMeter(): ReactElement {
  return <Meter label="Monthly budget" value={864} maxValue={1200} valueLabel="NOK 864 of 1 200" />;
}
