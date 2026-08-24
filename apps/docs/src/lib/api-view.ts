/**
 * Turning the committed API artifact into what a reference row displays (docs-site.md §8).
 *
 * The presentation contract asks each row three questions the artifact does not answer
 * literally: what one line stands in for the type while the row is closed, what a missing
 * default looks like, and what a screen reader hears from a single `summary`. Answering them
 * here keeps the accordion a rendering of ready strings — which is what lets the accordion be
 * the page's only client component while the highlighter, the artifact read and the em-dash
 * all stay on the server. This module is server-side for that reason: it imports the
 * highlighter, so the row's shape and the em-dash itself live in `api-row.ts`, which the
 * client component can import without reaching `sugar-high`.
 */

import { highlight } from "sugar-high";

import type { ApiPropView } from "./api-row";
import type { ApiPart, ApiProp, RscStatus } from "./docs-model";
import { propDescription } from "./docs-model";
import { apiPartAnchor, apiPropAnchor } from "./nav";

/** One compound part's reference block. */
export type ApiPartView = {
  name: string;
  /** Anchor id of the part heading; the on-page TOC links to it. */
  anchor: string;
  rsc: RscStatus;
  /** How the part's RSC status reads on the page. */
  rscLabel: string;
  /** Packages whose props this part forwards. */
  forwardedFrom: readonly string[];
  forwardedCount: number;
  props: readonly ApiPropView[];
};

/**
 * A part's RSC status in the words a reader acts on: whether they may render it from a
 * server component, or whether it drags in a client boundary (performance.md §3).
 */
function rscLabel(rsc: RscStatus): string {
  return rsc === "server" ? "server-safe" : '"use client"';
}

/**
 * The label for a row's `summary`.
 *
 * A closed row is four cells of code in a grid; announced cell by cell it is noise. The
 * composed label says the same thing as one sentence — name, whether it is required, the
 * collapsed type, and the default when there is one.
 */
function propLabel(prop: ApiProp, closedType: string): string {
  const required = prop.required ? " required," : "";
  const fallback = prop.defaultValue === null ? "" : ` (default: ${prop.defaultValue})`;
  return `Prop: ${prop.name},${required} type: ${closedType}${fallback}`;
}

function toPropView(partName: string, prop: ApiProp): ApiPropView {
  const closedType = prop.shortType ?? prop.type;
  return {
    name: prop.name,
    id: apiPropAnchor(partName, prop.name),
    required: prop.required,
    closedType,
    signatureHtml: highlight(prop.type),
    defaultValue: prop.defaultValue,
    description: propDescription(prop),
    label: propLabel(prop, closedType),
  };
}

export function toPartView(part: ApiPart): ApiPartView {
  return {
    name: part.name,
    anchor: apiPartAnchor(part.name),
    rsc: part.rsc,
    rscLabel: rscLabel(part.rsc),
    forwardedFrom: part.forwardedFrom,
    forwardedCount: part.forwardedCount,
    props: part.props.map((prop) => toPropView(part.name, prop)),
  };
}
