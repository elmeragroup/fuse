import type { ReactElement } from "react";

import { requireComponent } from "../lib/component-page";
import { API_SECTION_ID, apiPartAnchor } from "../lib/nav";
import { ApiTable } from "./ApiTable";
import "./ComponentSections.css";

export type ApiReferenceProps = {
  slug: string;
};

/**
 * The generated API reference of a component page (docs-site.md §3.4 item 4, §8): one
 * table per compound part, in the order the entry facade exports them.
 */
export function ApiReference({ slug }: ApiReferenceProps): ReactElement {
  const component = requireComponent(slug);
  return (
    <section aria-labelledby={API_SECTION_ID}>
      <h2 className="ComponentSectionHeading" id={API_SECTION_ID}>
        API reference
      </h2>
      {component.parts.map((part) => (
        <ApiTable key={part.name} part={part} id={apiPartAnchor(part.name)} />
      ))}
    </section>
  );
}
