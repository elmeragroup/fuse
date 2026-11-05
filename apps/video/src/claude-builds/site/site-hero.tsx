import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { BarChart } from "@elmeragroup/fuse/chart";
import type { ChartConfig } from "@elmeragroup/fuse/chart";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { Heading } from "@elmeragroup/fuse/heading";
import { ArrowRight } from "@elmeragroup/fuse/icons";
import { Text } from "@elmeragroup/fuse/text";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { useCopy, useVideoLocale } from "../../copy/copy";
import { FrameChart } from "../../primitives/frame-chart";
import { centsFormat, hourlyPrices, marketOf, SITE_NOW } from "./site-market";
import type { SiteMarket } from "./site-market";

/**
 * The day's prices as a Fuse bar chart, one bar per hour on the market's currency: the hours at or
 * below the day's average in the positive sentiment role and those above it in the negative one,
 * the legend naming both sides, a dashed line at the average and the hours before `SITE_NOW` faded.
 * The prices change with the brand's market, so the chart mounts anew for each currency and draws
 * at rest (see {@link FrameChart}). It fills the box it sits in.
 */
function HourlyPrices({ market }: { readonly market: SiteMarket }): ReactElement {
  const { hero } = useCopy().claudeBuilds.site;
  const { average } = market.spot;
  const config = {
    price: {
      label: hero.today,
      color: {
        threshold: average,
        below: { color: "chart-sentiment-positive", label: hero.below },
        above: { color: "chart-sentiment-negative", label: hero.above },
      },
      format: { preset: "unit-price", currency: market.currency, vat: "included" },
    },
  } as const satisfies ChartConfig;
  return (
    <FrameChart
      key={market.currency}
      data={hourlyPrices(market)}
      config={config}
      xKey="hour"
      interval="hour"
      timeZone="UTC"
      now={SITE_NOW}
      data-fade="past"
      aria-label={hero.today}>
      <BarChart.XAxis />
      <BarChart.Bar dataKey="price" />
      <BarChart.ReferenceLine y={average} variant="dashed" tone="muted" />
      <BarChart.Legend />
    </FrameChart>
  );
}

/**
 * The site's hero: its heading, lede and calls to action beside a card with today's spot price
 * in the brand's market, a Fuse bar chart of how it moves through the day, and the day's low and
 * high as a Fuse description list.
 *
 * @param props.brand - The brand, whose market sets the area and the currency.
 * @returns The hero, filling its section.
 */
export function SiteHero({ brand }: { readonly brand: BrandCode }): ReactElement {
  const { hero, areas } = useCopy().claudeBuilds.site;
  const market = marketOf(brand);
  const price = centsFormat(useVideoLocale(), market.currency);
  return (
    <section className="grid h-full grid-cols-[minmax(0,1fr)_22rem] items-center gap-12 bg-background px-10 text-foreground">
      <div className="flex flex-col items-start gap-6">
        <Heading
          level={1}
          size="5xl"
          font="semi-bold"
          className="leading-tight tracking-tight m-0 text-balance">
          {hero.title}
        </Heading>
        <Text variant="muted" className="text-lg max-w-md m-0 text-pretty">
          {hero.lede}
        </Text>
        <div className="flex gap-3">
          <Button size="lg">
            {hero.primary}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button size="lg" variant="outline">
            {hero.secondary}
          </Button>
        </div>
      </div>
      <Card.Root>
        <Card.Header>
          <Card.Title size="default">{hero.today}</Card.Title>
          <Card.Description>{areas[market.currency]}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {/* A figure under its label. Text would size both spans to its own size, so this stays a paragraph. */}
          <p className="m-0 flex flex-col">
            <span className="text-xs text-muted-foreground">{hero.average}</span>
            <span className="text-3xl font-semibold tracking-tight font-heading tabular-nums">
              {hero.perKwh(price.format(market.spot.average))}
            </span>
          </p>
          {/* The chart takes the room the hand-drawn bars had and the room the one-row low and high
              leave, so the card keeps its size. */}
          <div className="h-31">
            <HourlyPrices market={market} />
          </div>
          {/* One row of two label and value pairs. The label type's line height follows the density,
              so the row holds 24 px, the label type's tallest, and the card keeps one size. */}
          <DescriptionList.Root className="h-6">
            <DescriptionList.Content layout="inline" className="h-full grid-cols-2 items-center gap-x-3">
              <DescriptionList.Item className="col-span-1">
                <DescriptionList.Term className="text-muted-foreground">{hero.low}</DescriptionList.Term>
                <DescriptionList.Details className="font-semibold tabular-nums">
                  {price.format(market.spot.low)}
                </DescriptionList.Details>
              </DescriptionList.Item>
              <DescriptionList.Item className="col-span-1">
                <DescriptionList.Term className="text-muted-foreground">{hero.high}</DescriptionList.Term>
                <DescriptionList.Details className="font-semibold tabular-nums">
                  {price.format(market.spot.high)}
                </DescriptionList.Details>
              </DescriptionList.Item>
            </DescriptionList.Content>
          </DescriptionList.Root>
        </Card.Content>
      </Card.Root>
    </section>
  );
}
