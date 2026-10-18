import { Fragment } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { API_FUNCTIONS, API_SAME_AS } from "../generated/api-reference-extras";
import { namespaceOf } from "../lib/api-same-as";
import { readComponentApi } from "../lib/api-source";
import { toPartView } from "../lib/api-view";
import type { ApiPartView } from "../lib/api-view";
import { CLIENT_PART_NOTE } from "../lib/docs-model";
import type { ApiFunction } from "../lib/docs-model";
import { API_SECTION_ID, apiPartAnchor } from "../lib/nav";
import { componentHref } from "../lib/pages";
import { ApiPropRows } from "./api-prop-rows";
import { DocsCodeBlock } from "./docs-code-block";
import { DocsSectionHeading } from "./docs-section-heading";

type ApiReferenceProps = {
  slug: string;
};

const apiReference = tv({
  slots: {
    part: "mt-8",
    partHeader: "mt-[1.6rem] mb-[0.7rem] flex items-center gap-2",
    partHeading: "font-semibold text-base m-0 scroll-mt-[calc(var(--spacing-docs-header)_+_1rem)]",
    partHeadingCode: "text-sm",
    // RSC status is a per-part fact, so the reference shows it beside each part heading and
    // styles it here rather than in a shared badge.
    partRsc:
      "text-xs rounded-full border border-border px-1.5 py-0.5 font-mono whitespace-nowrap text-muted-foreground data-[rsc=server]:border-success/30 data-[rsc=server]:bg-success-soft data-[rsc=server]:text-success-soft-foreground",
    partNote: "text-xs mt-[0.6rem] text-muted-foreground",
    propGroupHeading: "font-medium text-xs mt-[1.2rem] mb-[0.55rem] text-muted-foreground",
    sameAsNote:
      "text-sm mt-[0.6rem] [&_a]:border-b [&_a]:border-border [&_a]:no-underline [&_a:hover]:border-current",
    functionText: "text-sm mt-[0.6rem]",
    functionParameters: "text-sm mt-[0.4rem] grid gap-2 [&_dd]:m-0 [&_dd]:text-muted-foreground",
  },
});

const {
  part,
  partHeader,
  partHeading,
  partHeadingCode,
  partRsc,
  partNote,
  propGroupHeading,
  sameAsNote,
  functionText,
  functionParameters,
} = apiReference();

/**
 * The one line that names a part or a namespace by its owner, such as "`PieChart.Tooltip` is
 * `Chart.Tooltip`." It stands in place of a repeated part's prop table and of an alias page's
 * whole reference.
 */
function SameAsLine({
  name,
  href,
  owner,
  suffix = ".",
}: {
  name: string;
  href: string;
  owner: string;
  suffix?: string;
}): ReactElement {
  return (
    <p className={sameAsNote()}>
      <code>{name}</code>
      {" is "}
      <a href={href}>
        <code>{owner}</code>
      </a>
      {suffix}
    </p>
  );
}

/** A part's heading, with its anchor, and an optional badge beside it. */
function PartHeader({ partView, badge }: { partView: ApiPartView; badge?: ReactNode }): ReactElement {
  return (
    <div className={partHeader()}>
      <h3 className={partHeading()} id={partView.anchor}>
        <code className={partHeadingCode()}>{partView.name}</code>
      </h3>
      {badge}
    </div>
  );
}

/**
 * A component page's API reference: one expandable table per
 * compound part, in the order the entry facade exports them.
 *
 * A server component reading the page's committed `api.json` — the same seam the demo
 * frame uses for demo sources. Everything except the row mechanics is decided here, on the
 * server: the artifact read, the short-type collapse and the em-dashes are all in the
 * prerendered HTML, so the client half is the `details` behaviour plus the shared
 * `DocsCodeBlock` that highlights a panel's full signature.
 *
 * RSC status is a per-part fact, so it sits next to the part heading rather than repeating
 * down a column.
 */
export function ApiReference({ slug }: ApiReferenceProps): ReactElement {
  const api = readComponentApi(slug);
  const shared = API_SAME_AS[slug];
  const functions = API_FUNCTIONS[slug];
  const [first] = api.parts;
  const firstOwner = first === undefined ? undefined : shared?.parts[first.name];

  const alias = shared?.alias ?? null;
  if (alias !== null && first !== undefined && firstOwner !== undefined) {
    return (
      <section aria-labelledby={API_SECTION_ID}>
        <DocsSectionHeading id={API_SECTION_ID}>API reference</DocsSectionHeading>
        <SameAsLine
          name={namespaceOf(first.name)}
          href={`${componentHref(alias)}#${API_SECTION_ID}`}
          owner={namespaceOf(firstOwner.name)}
          suffix=" under another name."
        />
      </section>
    );
  }

  return (
    <section aria-labelledby={API_SECTION_ID}>
      <DocsSectionHeading id={API_SECTION_ID}>API reference</DocsSectionHeading>
      {api.parts.map((apiPart) => {
        const partView = toPartView(apiPart);
        const owner = shared?.parts[apiPart.name];
        const reference = functions?.[apiPart.name];
        if (owner !== undefined) {
          return (
            <section className={part()} key={partView.name} aria-labelledby={partView.anchor}>
              <PartHeader partView={partView} />
              <SameAsLine
                name={partView.name}
                href={`${componentHref(owner.slug)}#${apiPartAnchor(owner.name)}`}
                owner={owner.name}
              />
            </section>
          );
        }
        return reference === undefined ? (
          <PartReference key={partView.name} partView={partView} />
        ) : (
          <FunctionReference key={partView.name} partView={partView} reference={reference} />
        );
      })}
    </section>
  );
}

/** A function part's reference: its signature, its parameters and what it returns. */
function FunctionReference({
  partView,
  reference,
}: {
  partView: ApiPartView;
  reference: ApiFunction;
}): ReactElement {
  return (
    <section className={part()} aria-labelledby={partView.anchor}>
      <PartHeader partView={partView} badge={<RscBadge partView={partView} />} />
      <DocsCodeBlock source={reference.signature} />
      <p className={functionText()}>{reference.description}</p>
      {reference.parameters.length === 0 ? null : (
        <>
          <h4 className={propGroupHeading()}>Parameters</h4>
          <dl className={functionParameters()}>
            {reference.parameters.map((parameter) => (
              <div key={parameter.name}>
                <dt>
                  <code>
                    {parameter.name}
                    {parameter.optional ? "?" : ""}: {parameter.type}
                  </code>
                </dt>
                <dd>{parameter.description}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <h4 className={propGroupHeading()}>Returns</h4>
      <p className={functionText()}>
        <code>{reference.returns.type}</code>
        {reference.returns.description === "" ? null : ` ${reference.returns.description}`}
      </p>
    </section>
  );
}

/**
 * A part's RSC status beside its heading. A client part's title says that a Server Component can
 * still render it, because the directive only moves the part's own code to the client.
 */
function RscBadge({ partView }: { partView: ApiPartView }): ReactElement {
  return (
    <span
      className={partRsc()}
      data-rsc={partView.rsc}
      title={partView.rsc === "client" ? CLIENT_PART_NOTE : undefined}>
      {partView.rscLabel}
    </span>
  );
}

/** One part's own reference: its heading, RSC badge and prop tables. */
function PartReference({ partView }: { partView: ApiPartView }): ReactElement {
  return (
    <section className={part()} aria-labelledby={partView.anchor}>
      <PartHeader partView={partView} badge={<RscBadge partView={partView} />} />
      {partView.propGroups.length === 0 ? (
        <p className={partNote()}>Every prop is forwarded to the underlying part.</p>
      ) : (
        partView.propGroups.map((group) => (
          <Fragment key={group.key}>
            {group.label === null ? null : <h4 className={propGroupHeading()}>{group.label}</h4>}
            <ApiPropRows
              partName={group.label === null ? `${partView.name} props` : `${partView.name} ${group.label}`}
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
  );
}
