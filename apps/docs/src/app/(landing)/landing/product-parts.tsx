import { Fragment } from "react";
import type { ReactElement, ReactNode } from "react";

import Link from "next/link";
import { tv } from "tailwind-variants";

const productParts = tv({
  slots: {
    // The labels name the components each card is built from and link to their docs.
    parts:
      "text-2xs tracking-landing-caption mb-2 flex flex-wrap gap-x-1.5 font-mono text-muted-foreground uppercase",
    part: "underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring",
  },
});

const styles = productParts();

export type Part = { name: string; slug: string };

export type LabelledProps = {
  parts: readonly Part[];
  children: ReactNode;
};

/** A card with the components it is built from named above it, each linking to its docs page. */
export function Labelled({ parts, children }: LabelledProps): ReactElement {
  return (
    <div>
      <p className={styles.parts()}>
        {parts.map((part, index) => (
          <Fragment key={part.slug}>
            {index > 0 ? <span aria-hidden>·</span> : null}
            <Link href={`/components/${part.slug}`} className={styles.part()}>
              {part.name}
            </Link>
          </Fragment>
        ))}
      </p>
      {children}
    </div>
  );
}
