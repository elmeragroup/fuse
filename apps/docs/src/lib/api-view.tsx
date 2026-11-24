/**
 * Turning the committed API artifact into what a reference row displays.
 *
 * This module prepares each row's values on the server, including the one-line type a closed
 * row shows. It renders the full signature with `DocsCodeBlock`, which also renders demo source
 * and MDX fences. It hands the signature to the client accordion as a finished element, so
 * `sugar-high` never reaches the client graph and no signature is highlighted at hydration.
 */

import { DocsCodeBlock } from "../components/docs-code-block";
import type { ApiPropView } from "./api-row";
import type { ApiPart, ApiProp, RscStatus } from "./docs-model";
import { groupApiProps, propDescription } from "./docs-model";
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
  propGroups: readonly ApiPropGroupView[];
};

/** One visually distinct source group inside a part's prop reference. */
export type ApiPropGroupView = {
  key: string;
  label: string | null;
  props: readonly ApiPropView[];
};

/**
 * A part's RSC status in the words a reader acts on: whether they may render it from a
 * server component, or whether it drags in a client boundary.
 */
function rscLabel(rsc: RscStatus): string {
  return rsc === "server" ? "server-safe" : '"use client"';
}

function toPropView(partName: string, prop: ApiProp): ApiPropView {
  return {
    name: prop.name,
    id: apiPropAnchor(partName, prop.name),
    required: prop.required,
    closedType: prop.shortType ?? prop.type,
    signature: <DocsCodeBlock variant="signature" source={prop.type} />,
    defaultValue: prop.defaultValue,
    description: propDescription(prop),
  };
}

function toPropGroups(part: ApiPart): readonly ApiPropGroupView[] {
  return groupApiProps(part.props).map((group) => ({
    key: group.key,
    label: group.label,
    props: group.props.map((prop) => toPropView(part.name, prop)),
  }));
}

export function toPartView(part: ApiPart): ApiPartView {
  const propGroups = toPropGroups(part);
  return {
    name: part.name,
    anchor: apiPartAnchor(part.name),
    rsc: part.rsc,
    rscLabel: rscLabel(part.rsc),
    forwardedFrom: part.forwardedFrom,
    forwardedCount: part.forwardedCount,
    propGroups,
  };
}
