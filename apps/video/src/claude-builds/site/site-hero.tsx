import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { ArrowRight } from "@elmeragroup/fuse/icons";
import type { BrandCode } from "@elmeragroup/fuse/theme";

import { useCopy, useVideoLocale } from "../../copy/copy";
import { centsFormat, HOURLY_PROFILE, marketOf } from "./site-market";
import type { SpotDay } from "./site-market";

/** The width of one hour's bar in the chart's 240-wide box, gap included. */
const BAR_PITCH = 10;

/** The day's hourly prices as bars, scaled between its low and its high. */
function HourlyBars({ day }: { readonly day: SpotDay }): ReactElement {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${String(HOURLY_PROFILE.length * BAR_PITCH)} 100`}
      preserveAspectRatio="none"
      className="h-28 w-full text-primary">
      {HOURLY_PROFILE.map((share, hour) => {
        const value = day.low + share * (day.high - day.low);
        const height = 8 + (value / day.high) * 92;
        return (
          <rect
            key={hour}
            x={hour * BAR_PITCH + 1}
            y={100 - height}
            width={BAR_PITCH - 2}
            height={height}
            rx={1.5}
            fill="currentColor"
            fillOpacity={0.3 + share * 0.7}
          />
        );
      })}
    </svg>
  );
}

/**
 * The site's hero: its heading, lede and calls to action beside a card with today's spot price
 * in the brand's market and how it moves through the day.
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
        <h1 className="text-5xl font-semibold leading-tight tracking-tight m-0 font-heading text-balance">
          {hero.title}
        </h1>
        <p className="text-lg max-w-md m-0 text-pretty text-muted-foreground">{hero.lede}</p>
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
          <p className="m-0 flex flex-col">
            <span className="text-xs text-muted-foreground">{hero.average}</span>
            <span className="text-3xl font-semibold tracking-tight font-heading tabular-nums">
              {hero.perKwh(price.format(market.spot.average))}
            </span>
          </p>
          <HourlyBars day={market.spot} />
          <dl className="text-sm m-0 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted-foreground">{hero.low}</dt>
              <dd className="font-semibold m-0 tabular-nums">{price.format(market.spot.low)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{hero.high}</dt>
              <dd className="font-semibold m-0 tabular-nums">{price.format(market.spot.high)}</dd>
            </div>
          </dl>
        </Card.Content>
      </Card.Root>
    </section>
  );
}
