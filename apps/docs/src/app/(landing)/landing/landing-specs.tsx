import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

const landingSpecs = tv({
  slots: {
    section: "sm:px-6 sm:py-30 border-t border-border px-4 py-16 lg:px-20",
    inner: "max-w-landing sm:gap-14 mx-auto flex w-full flex-col gap-10",
    head: "flex flex-col justify-between gap-6 lg:flex-row lg:items-end",
    title: "text-4xl sm:text-landing-h3 tracking-landing-h2 font-semibold font-heading text-balance",
    lede: "text-base sm:text-lg leading-relaxed max-w-105 shrink-0 text-pretty text-muted-foreground",
    grid: "sm:grid-cols-3 grid grid-cols-2 border-t border-border lg:grid-cols-5",
    stat: "sm:py-8 flex flex-col gap-2 border-border py-6 pr-6 not-first:pl-0 lg:not-first:border-l lg:not-first:pl-6",
    // The number leads visually; the term stays first in the list for screen readers.
    value:
      "text-6xl sm:text-landing-stat tracking-landing-stat font-medium order-first font-heading tabular-nums",
    unit: "text-2xl font-normal tracking-normal ml-1 text-muted-foreground",
    label: "text-sm font-medium mt-3",
    note: "text-sm text-pretty text-muted-foreground",
  },
});

const styles = landingSpecs();

const SPECS = [
  { value: "67", label: "Components", note: "Built on Base UI. Date components use React Aria." },
  { value: "20", label: "Themes", note: "Six brands × two segments × two variants." },
  { value: "4", label: "Locales", note: "Norwegian, Swedish, Finnish and English." },
  { value: "2", label: "Densities", note: "Dense for internal tools, comfortable for customer apps." },
  {
    value: "24",
    unit: "px",
    label: "Minimum target",
    note: "At both densities. Reduced motion is set in one place.",
  },
] as const;

export function LandingSpecs(): ReactElement {
  return (
    <section className={styles.section()} aria-labelledby="landing-specs">
      <div className={styles.inner()}>
        <div className={styles.head()}>
          <h2 id="landing-specs" className={styles.title()}>
            Built into the components.
          </h2>
          <p className={styles.lede()}>
            Field connects labels and error messages. Focus, overlays and locale each have one shared
            implementation, so they work the same in every product.
          </p>
        </div>
        <dl className={styles.grid()}>
          {SPECS.map((spec) => (
            <div key={spec.label} className={styles.stat()}>
              <dt className={styles.label()}>{spec.label}</dt>
              <dd className={styles.value()}>
                {spec.value}
                {"unit" in spec ? <span className={styles.unit()}>{spec.unit}</span> : null}
              </dd>
              <dd className={styles.note()}>{spec.note}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
