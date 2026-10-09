"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { NumberField } from "@elmeragroup/fuse/number-field";
import { TextField } from "@elmeragroup/fuse/text-field";
import { DENSITIES, densityAttributes } from "@elmeragroup/fuse/theme";
import type { Density } from "@elmeragroup/fuse/theme";

import { SingleToggle } from "../../../components/single-toggle";
import { mediumControlPx } from "./landing-facts";
import { LANDING_DENSITY } from "./landing-theme-defaults";
import { stack } from "./product-parts";

const landingDensity = tv({
  slots: {
    section:
      "sm:px-6 sm:py-32 sm:gap-14 flex flex-col items-center gap-10 border-t border-border px-4 py-16 lg:px-20",
    head: "flex max-w-160 flex-col items-center gap-5 text-center",
    eyebrow: "text-xs tracking-landing-eyebrow font-mono text-primary uppercase",
    title: "text-4xl sm:text-landing-h3 tracking-landing-h2 font-semibold font-heading text-balance",
    note: "text-sm text-muted-foreground",
    card: "w-full max-w-140",
    row: "sm:grid-cols-2 grid grid-cols-1 gap-4",
    actions: "flex flex-wrap gap-3",
  },
});

const styles = landingDensity();

const DENSITY_LABELS = {
  dense: "Dense",
  comfortable: "Comfortable",
} as const satisfies Record<Density, string>;

const DENSITY_USES = {
  dense: "Internal tools",
  comfortable: "Customer apps",
} as const satisfies Record<Density, string>;

/**
 * A product sets density once, on the document. This demo stage is the exception: it carries the
 * demo-stage density attributes Fuse's generated stylesheet re-scopes the control metrics onto,
 * so the toggle resizes the form without re-laying the page.
 */
export function LandingDensity(): ReactElement {
  // The stage starts at the document's density, so the first paint matches.
  const [density, setDensity] = useState<Density>(LANDING_DENSITY);

  return (
    <section className={styles.section()} aria-labelledby="landing-density">
      <div className={styles.head()}>
        <p className={styles.eyebrow()}>data-density</p>
        <h2 id="landing-density" className={styles.title()}>
          Dense or comfortable, set per app.
        </h2>
        <SingleToggle
          label="Density"
          options={DENSITIES}
          labels={DENSITY_LABELS}
          value={density}
          onValueChange={setDensity}
        />
        <p className={styles.note()}>
          {`${DENSITY_USES[density]} · ${String(mediumControlPx(density))} px controls`}
        </p>
      </div>
      <div data-demo-stage {...densityAttributes(density)} className={styles.card()}>
        <Card.Root>
          <Card.Header>
            <Card.Title>Meter reading</Card.Title>
          </Card.Header>
          <Card.Content>
            <form
              className={stack}
              onSubmit={(event) => {
                event.preventDefault();
              }}>
              <TextField label="Meter number" filter="numeric" defaultValue="7070575000" />
              <div className={styles.row()}>
                <NumberField label="Reading" denomination="kWh" minValue={0} defaultValue={48213} />
                <TextField label="Date" defaultValue="02.10.2026" />
              </div>
              <div className={styles.actions()}>
                <Button type="submit">Save reading</Button>
                <Button type="reset" variant="ghost">
                  Cancel
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card.Root>
      </div>
    </section>
  );
}
