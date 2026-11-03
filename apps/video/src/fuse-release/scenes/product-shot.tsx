import type { ReactElement } from "react";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Field } from "@elmeragroup/fuse/field";
import { Meter } from "@elmeragroup/fuse/meter";
import { Switch } from "@elmeragroup/fuse/switch";
import { Tabs } from "@elmeragroup/fuse/tabs";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { budgetFor } from "../../brand/brand-market";
import { BrandWordmark } from "../../brand/brand-wordmark";
import { useCopy, useVideoLocale } from "../../copy/copy";
import { numberFormat } from "../../copy/intl";
import { WeekBars, weekTotal } from "../../sample/week-bars";

/**
 * The customer page the brand morph re-themes: a usage card, a budget meter, a notification
 * switch and an invoice action, built from Fuse parts as the landing's product shot is. Labels
 * follow the video's locale and money follows the brand's market.
 *
 * @param props.brand - The brand, whose market sets the currency.
 * @returns The window.
 */
export function ProductShot({ brand }: { readonly brand: BrandCode }): ReactElement {
  const { brandMorph: copy } = useCopy();
  const locale = useVideoLocale();
  const budget = budgetFor(brand, locale);
  const change = numberFormat(locale, { style: "percent", signDisplay: "exceptZero" });
  const share = numberFormat(locale, { style: "percent" });
  const [overview, invoices, agreements] = copy.tabs;

  return (
    <Tabs.Root
      value="overview"
      className="rounded-2xl shadow-2xl flex h-125 w-230 flex-col overflow-hidden border border-border bg-background text-foreground">
      <div className="flex h-15 shrink-0 items-center gap-6 border-b border-border px-6">
        <BrandWordmark brand={brand} />
        <Tabs.List variant="line" className="min-w-0 flex-1">
          <Tabs.Trigger value="overview" className="px-2">
            {overview}
          </Tabs.Trigger>
          <Tabs.Trigger value="invoices" className="px-2">
            {invoices}
          </Tabs.Trigger>
          <Tabs.Trigger value="agreements" className="px-2">
            {agreements}
          </Tabs.Trigger>
        </Tabs.List>
        <Avatar.Root className="size-8 shrink-0">
          <Avatar.Fallback>IL</Avatar.Fallback>
        </Avatar.Root>
      </div>
      <Tabs.Content
        value="overview"
        className="grid flex-1 grid-cols-[minmax(0,26fr)_minmax(0,19fr)] gap-5 p-5">
        <Card.Root>
          <Card.Content className="flex h-full flex-col gap-4 pt-6">
            <div className="flex items-start justify-between gap-3">
              <Card.Title>{copy.usage}</Card.Title>
              <Card.Description>{copy.period}</Card.Description>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-5xl font-semibold tracking-tight m-0 font-heading leading-none tabular-nums">
                {weekTotal(locale)}
                <span className="text-base font-normal tracking-normal ml-1 text-muted-foreground">kWh</span>
              </p>
              <Badge variant="success">{copy.delta(change.format(-0.04))}</Badge>
            </div>
            <WeekBars weekdays className="gap-2.5" />
          </Card.Content>
        </Card.Root>
        <div className="flex min-w-0 flex-col gap-5">
          <Card.Root>
            <Card.Content className="pt-6">
              <Meter
                label={copy.budget}
                value={budget.share * 100}
                maxValue={100}
                valueLabel={copy.budgetOf(budget.spent, budget.limit)}
              />
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content className="pt-6">
              <Field.Root orientation="horizontal" className="items-center">
                <Field.Content>
                  <Field.Label>{copy.notify(share.format(0.8))}</Field.Label>
                </Field.Content>
                <Switch checked />
              </Field.Root>
            </Card.Content>
          </Card.Root>
          <Button size="lg" className="mt-auto w-full">
            {copy.cta}
          </Button>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
