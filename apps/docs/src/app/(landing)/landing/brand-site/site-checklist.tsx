import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Check } from "@elmeragroup/fuse/icons";

import type { SiteChecklist as SiteChecklistConfig } from "./site-model";

const siteChecklist = tv({
  slots: {
    root: "flex flex-col gap-3",
    title: "text-base font-semibold",
    list: "m-0 flex list-none flex-col gap-2.5 p-0",
    item: "text-base flex items-start gap-3 text-pretty",
    // The tick sits on the first line's centre: a 24px disc beside 24px-high body lines.
    tick: "flex size-6 shrink-0 items-center justify-center rounded-full",
    icon: "size-4",
  },
  variants: {
    // `inverse` sits on a strong brand block, where the page's primary disc would disappear. In
    // dark mode that block is the soft surface, where the primary disc shows again.
    tone: {
      default: { tick: "bg-primary text-primary-foreground" },
      inverse: {
        tick: "landing-dark:bg-primary landing-dark:text-primary-foreground bg-primary-foreground text-primary",
      },
    },
  },
  defaultVariants: { tone: "default" },
});

/** A named list of ticked benefits, with an optional heading above it. */
export function SiteChecklist({
  checklist,
  tone,
}: {
  checklist: SiteChecklistConfig;
  tone?: "default" | "inverse";
}): ReactElement {
  const styles = siteChecklist({ tone });
  return (
    <div className={styles.root()}>
      {checklist.title === undefined ? null : <p className={styles.title()}>{checklist.title}</p>}
      <ul aria-label={checklist.label} className={styles.list()}>
        {checklist.items.map((item) => (
          <li key={item} className={styles.item()}>
            <span aria-hidden className={styles.tick()}>
              <Check className={styles.icon()} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
