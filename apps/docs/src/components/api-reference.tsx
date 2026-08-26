import type { ReactElement } from "react";

import { readComponentApi } from "../lib/api-source";
import { toPartView } from "../lib/api-view";
import { API_SECTION_ID } from "../lib/nav";
import { ApiPropRows } from "./api-prop-rows";
import "./api-reference.css";
import "./component-sections.css";

export type ApiReferenceProps = {
  slug: string;
};

/**
 * A component page's API reference (docs-site.md §3.4 item 4, §8): one expandable table per
 * compound part, in the order the entry facade exports them.
 *
 * An async server component reading the page's committed `api.json` — the same seam the demo
 * frame uses for demo sources. Everything except the row mechanics is decided here, on the
 * server: the artifact read, the short-type collapse, the highlighted signatures and the
 * em-dashes are all in the prerendered HTML, so the client half is the `details` behaviour
 * and nothing else.
 *
 * RSC status is a per-part fact, so it sits next to the part heading rather than repeating
 * down a column (§8, performance.md §3).
 */
export async function ApiReference({ slug }: ApiReferenceProps): Promise<ReactElement> {
  const api = await readComponentApi(slug);
  const parts = api.parts.map(toPartView);

  return (
    <section aria-labelledby={API_SECTION_ID}>
      <h2 className="ComponentSectionHeading" id={API_SECTION_ID}>
        API reference
      </h2>
      {parts.map((part) => (
        <section className="ApiPart" key={part.name} aria-labelledby={part.anchor}>
          <div className="ApiPartHeader">
            <h3 id={part.anchor}>
              <code>{part.name}</code>
            </h3>
            <span className="ApiPartRsc" data-rsc={part.rsc}>
              {part.rscLabel}
            </span>
          </div>
          {part.props.length === 0 ? (
            <p className="ApiPartNote">Every prop is forwarded to the underlying part.</p>
          ) : (
            <ApiPropRows partName={part.name} props={part.props} />
          )}
          {part.forwardedCount > 0 ? (
            <p className="ApiPartNote">
              Plus {part.forwardedCount} forwarded props from {part.forwardedFrom.join(", ")}.
            </p>
          ) : null}
        </section>
      ))}
    </section>
  );
}
