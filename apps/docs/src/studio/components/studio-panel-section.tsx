import { useId } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

const studioPanelSection = tv({
  slots: {
    section: "flex flex-col gap-2 border-b border-border px-3 py-3 last:border-b-0",
    title: "text-xs font-medium px-2 text-muted-foreground",
  },
});

const styles = studioPanelSection();

export type StudioPanelSectionProps = {
  title: string;
  children: ReactNode;
};

/**
 * One titled section of a side panel. The inspector and the navigator are plain stacks of these,
 * so a later page or the token editor adds a section by composing one more.
 */
export function StudioPanelSection({ title, children }: StudioPanelSectionProps): ReactElement {
  const id = useId();
  return (
    <section aria-labelledby={id} className={styles.section()}>
      <h2 id={id} className={styles.title()}>
        {title}
      </h2>
      {children}
    </section>
  );
}
