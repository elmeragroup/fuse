import { Fragment } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { readComponentApi } from "../lib/api-source";
import { toPartView } from "../lib/api-view";
import { API_SECTION_ID } from "../lib/nav";
import { ApiPropRows } from "./api-prop-rows";
import { DocsSectionHeading } from "./docs-section-heading";

export type ApiReferenceProps = {
  slug: string;
};

const apiReference = tv({
  slots: {
    part: "mt-8",
    partHeader: "mt-[1.6rem] mb-[0.7rem] flex items-center gap-2",
    partHeading: "font-semibold text-base m-0 scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)]",
    partHeadingCode: "text-sm",
    // RSC status is a per-part fact: the reference wears
    // it next to the part heading, so it is styled here rather than in a shared badge.
    partRsc:
      "text-xs rounded-full border border-border px-1.5 py-0.5 font-mono whitespace-nowrap text-muted-foreground data-[rsc=server]:border-success/30 data-[rsc=server]:bg-success-soft data-[rsc=server]:text-success-soft-foreground",
    partNote: "text-xs mt-[0.6rem] text-muted-foreground",
    propGroupHeading: "font-medium text-xs mt-[1.2rem] mb-[0.55rem] text-muted-foreground",
  },
});

const { part, partHeader, partHeading, partHeadingCode, partRsc, partNote, propGroupHeading } =
  apiReference();

/**
 * A component page's API reference: one expandable table per
 * compound part, in the order the entry facade exports them.
 *
 * An async server component reading the page's committed `api.json` — the same seam the demo
 * frame uses for demo sources. Everything except the row mechanics is decided here, on the
 * server: the artifact read, the short-type collapse and the em-dashes are all in the
 * prerendered HTML, so the client half is the `details` behaviour plus the shared
 * `DocsCodeBlock` that highlights a panel's full signature.
 *
 * RSC status is a per-part fact, so it sits next to the part heading rather than repeating
 * down a column.
 */
export async function ApiReference({ slug }: ApiReferenceProps): Promise<ReactElement> {
  const api = await readComponentApi(slug);
  const parts = api.parts.map(toPartView);

  return (
    <section aria-labelledby={API_SECTION_ID}>
      <DocsSectionHeading id={API_SECTION_ID}>API reference</DocsSectionHeading>
      {parts.map((partView) => (
        <section className={part()} key={partView.name} aria-labelledby={partView.anchor}>
          <div className={partHeader()}>
            <h3 className={partHeading()} id={partView.anchor}>
              <code className={partHeadingCode()}>{partView.name}</code>
            </h3>
            <span className={partRsc()} data-rsc={partView.rsc}>
              {partView.rscLabel}
            </span>
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
