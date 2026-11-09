import type { ReactElement } from "react";

import { DocsPage, pageMetadata } from "../../../../components/docs-page";
import { BehaviourSection } from "./sections/behaviour-section";
import { BoundariesSection } from "./sections/boundaries-section";
import { CancelableSection } from "./sections/cancelable-section";
import { ComponentMapSection } from "./sections/component-map-section";
import { DateApiSection } from "./sections/date-api-section";
import { InstallSection } from "./sections/install-section";
import { KindsSection } from "./sections/kinds-section";
import { ValidationSection } from "./sections/validation-section";

const HREF = "/handbook/temporal-migration";

export const metadata = pageMetadata(HREF);

/**
 * The migration guide from the interim React Aria date tier and `@internationalized/date` to the
 * Temporal date components. Each section is its own module beside this page; the conversion table
 * renders from `sections/date-recipes.ts`, whose expressions `test/temporal-recipes.test.ts` runs.
 */
export default function TemporalMigrationPage(): ReactElement {
  return (
    <DocsPage href={HREF}>
      <h2 id="why">Why and what changes</h2>
      <p>
        Fuse&apos;s date components were an interim tier on React Aria and{" "}
        <code>@internationalized/date</code>. The Temporal tier replaces them with Fuse-owned, Base UI-style
        parts whose values are TC39 Temporal objects: the date type the platform now ships, with no date
        library to share between server and client. The labeled composites keep the interim prop names, so
        most call sites change only their import and their value type. The interim{" "}
        <code>@elmeragroup/fuse/react-aria/*</code> date subpaths keep working unchanged until a later release
        removes them, so you can move one screen at a time.
      </p>
      <InstallSection />
      <ComponentMapSection />
      <DateApiSection />
      <BoundariesSection />
      <KindsSection />
      <ValidationSection />
      <BehaviourSection />
      <CancelableSection />
    </DocsPage>
  );
}
