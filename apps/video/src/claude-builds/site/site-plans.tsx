import type { ReactElement } from "react";

import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Check } from "@elmeragroup/fuse/icons";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import type { PlanCopy } from "../../copy/catalog";
import { useCopy, useVideoLocale } from "../../copy/copy";
import { centsFormat, marketOf } from "./site-market";

/** The three plans in the order the site lists them; the fixed price is the one most chosen. */
const PLANS = ["spot", "fixed", "green"] as const;

/** One plan's card: its name, what it is, its monthly fee, what it includes and its action. */
function PlanCard({
  plan,
  fee,
  popular,
}: {
  readonly plan: PlanCopy;
  readonly fee: string;
  readonly popular: string | null;
}): ReactElement {
  const { plans } = useCopy().claudeBuilds.site;
  return (
    <Card.Root className={popular === null ? "h-full" : "h-full border-primary"}>
      <Card.Header>
        <Card.Title size="lg">{plan.name}</Card.Title>
        {popular === null ? null : (
          <Card.Action>
            <Badge>{popular}</Badge>
          </Card.Action>
        )}
        <Card.Description>{plan.text}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-1 flex-col gap-4">
        <p className="text-2xl font-semibold tracking-tight m-0 font-heading tabular-nums">
          {plans.perMonth(fee)}
        </p>
        <ul className="text-sm m-0 flex list-none flex-col gap-2 p-0">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </Card.Content>
      <Card.Footer>
        <Button className="w-full" variant={popular === null ? "outline" : "default"}>
          {plans.choose}
        </Button>
      </Card.Footer>
    </Card.Root>
  );
}

/**
 * The site's plans: a heading over three plan cards with their fees in the brand's currency.
 *
 * @param props.brand - The brand, whose market sets the currency.
 * @returns The plans, filling their section.
 */
export function SitePlans({ brand }: { readonly brand: BrandCode }): ReactElement {
  const { plans } = useCopy().claudeBuilds.site;
  const market = marketOf(brand);
  const money = centsFormat(useVideoLocale(), market.currency);
  return (
    <section className="flex h-full flex-col gap-8 bg-background px-10 pt-4 text-foreground">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-3xl font-semibold tracking-tight m-0 font-heading">{plans.title}</h2>
        <p className="m-0 text-muted-foreground">{plans.lede}</p>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan}
            plan={plans[plan]}
            fee={money.format(market.fees[plan])}
            popular={plan === "fixed" ? plans.popular : null}
          />
        ))}
      </div>
    </section>
  );
}
