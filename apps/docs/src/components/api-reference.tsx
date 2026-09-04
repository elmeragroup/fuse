import { Fragment } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { readComponentApi } from "../lib/api-source";
import { toPartView } from "../lib/api-view";
import { API_SECTION_ID } from "../lib/nav";
import { ApiPropRows } from "./api-prop-rows";
import { DocsRscBadge } from "./docs-rsc-badge";
import { DocsSectionHeading } from "./docs-section-heading";

export type ApiReferenceProps = {
  slug: string;
};

const apiReference = tv({
  slots: {
    part: "mt-8",
    partHeader: "mt-[1.6rem] mb-[0.7rem] flex items-center gap-[0.55rem]",
    partHeading:
      "font-semibold [&_code]:font-docs-mono m-0 scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)] text-[1rem] [&_code]:text-[13px]",
    partNote: "text-docs-sub mt-[0.6rem] text-[0.78rem]",
    propGroupHeading: "font-medium text-docs-sub mt-[1.2rem] mb-[0.55rem] text-[0.78rem] tracking-[0.01em]",
  },
});

/**
 * A component page's API reference (docs-site.md §3.4 item 4, §8): one expandable table per
 * compound part, in the order the entry facade exports them.
 *
 * An async server component reading the page's committed `api.json` — the same seam the demo
 * frame uses for demo sources. Everything except the row mechanics is decided here, on the
 * server: the artifact read, the short-type collapse and the em-dashes are all in the
 * prerendered HTML, so the client half is the `details` behaviour plus the shared
 * `DocsCodeBlock` that highlights a panel's full signature.
 *
 * RSC status is a per-part fact, so it sits next to the part heading rather than repeating
 * down a column (§8, performance.md §3).
 */
export async function ApiReference({ slug }: ApiReferenceProps): Promise<ReactElement> {
  const api = await readComponentApi(slug);
  const parts = api.parts.map(toPartView);
  const { part, partHeader, partHeading, partNote, propGroupHeading } = apiReference();

  return (
    <section aria-labelledby={API_SECTION_ID}>
      <DocsSectionHeading id={API_SECTION_ID}>API reference</DocsSectionHeading>
      {parts.map((partView) => (
        <section className={part()} key={partView.name} aria-labelledby={partView.anchor}>
          <div className={partHeader()}>
            <h3 className={partHeading()} id={partView.anchor}>
              <code>{partView.name}</code>
            </h3>
            <DocsRscBadge variant="part" rsc={partView.rsc}>
              {partView.rscLabel}
            </DocsRscBadge>
          </div>
          {partView.propGroups.length === 0 ? (
            <p className={partNote()}>Every prop is forwarded to the underlying part.</p>
          ) : (
            partView.propGroups.map((group) => (
              <Fragment key={group.key}>
                {group.label === null ? null : <h4 className={propGroupHeading()}>{group.label}</h4>}
                <ApiPropRows
                  partName={
                    group.label === null ? `${partView.name} props` : `${partView.name} ${group.label}`
                  }
                  props={group.props}
                />
              </Fragment>
            ))
          )}
          {partView.forwardedCount > 0 ? (
            <p className={partNote()}>
              Plus {partView.forwardedCount} forwarded props from {partView.forwardedFrom.join(", ")}.
            </p>
          ) : null}
        </section>
      ))}
    </section>
  );
}
