"use client";

import { useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import { cn, tv } from "tailwind-variants";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { Card } from "@elmeragroup/fuse/card";
import { Field } from "@elmeragroup/fuse/field";
import { ElmeraGroupLogo } from "@elmeragroup/fuse/icons";
import { RadioItem, RadioItemGroup } from "@elmeragroup/fuse/radio-group";
import { Switch } from "@elmeragroup/fuse/switch";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Toast } from "@elmeragroup/fuse/toast";

import { SingleToggle } from "../../../components/single-toggle";
import { BudgetMeter, Labelled, stack } from "./product-parts";
import { AgreementsTab, InvoicesTab, MetersTab } from "./product-tabs";

const productShot = tv({
  slots: {
    section: "sm:py-34 sm:gap-18 flex flex-col items-center gap-12 border-t border-border py-16 lg:px-20",
    head: "sm:px-6 flex max-w-170 flex-col items-center gap-5 px-4 text-center",
    eyebrow: "text-xs tracking-landing-eyebrow font-mono text-primary uppercase",
    title: "text-4xl sm:text-landing-h2 tracking-landing-h2 font-semibold font-heading text-balance",
    lede: "text-base sm:text-lg leading-relaxed text-pretty text-muted-foreground",
    // The window keeps one width and a floor height, so switching tabs never resizes it.
    frame: "sm:px-6 w-full max-w-257 px-4 lg:px-0",
    window: "rounded-2xl shadow-2xl w-full overflow-hidden border border-border bg-background",
    header: "sm:px-6 sm:gap-6 flex h-15 items-center gap-3 border-b border-border px-2",
    headerMark: "sm:block hidden size-4 shrink-0 text-foreground",
    // Phones give the avatar's room to the tabs.
    headerAvatar: "sm:flex hidden size-8 shrink-0",
    headerTab: "px-2",
    // Phones scroll the tab row like a native tab bar instead of clipping it.
    headerTabs: "landing-rail min-w-0 flex-1 overflow-x-auto",
    body: "sm:p-6 md:grid-cols-[minmax(0,26fr)_minmax(0,19fr)] md:min-h-170 grid grid-cols-1 content-start gap-6 p-4",
    column: "flex min-w-0 flex-col gap-6",
    usageHead: "flex flex-wrap items-start justify-between gap-3",
    figureRow: "mt-4 flex flex-wrap items-center gap-3",
    figure: "text-5xl font-semibold tracking-tight font-heading leading-none tabular-nums",
    unit: "text-base font-normal tracking-normal ml-1 text-muted-foreground",
    chart: "sm:h-55 mt-6 flex h-40 items-end gap-0.75",
    barSlot: "relative flex h-full min-w-0 flex-1 items-end",
    axis: "text-xs mt-2 flex justify-between font-mono text-muted-foreground tabular-nums",
    meter: "mt-6 border-t border-border pt-5",
    // Content without a Card.Header above it gets the header's top padding back.
    headless: "pt-6",
    switchRow: "items-start",
  },
});

const styles = productShot();

/** One usage bar; the latest days carry the full primary, the rest a tint of it. */
const usageBar = tv({
  base: "landing-bar h-full w-full rounded-t-sm",
  variants: {
    current: { true: "bg-primary", false: "bg-primary/30" },
  },
});

const USAGE = {
  day: {
    total: 14,
    delta: "−6% vs yesterday",
    values: [
      0.4, 0.3, 0.3, 0.3, 0.4, 0.6, 1.1, 1.4, 1.2, 0.8, 0.6, 0.5, 0.6, 0.5, 0.6, 0.8, 1.2, 1.6, 1.7, 1.5, 1.1,
      0.9, 0.6, 0.5,
    ],
    ticks: ["00", "06", "12", "18", "23"],
    current: 4,
  },
  week: {
    total: 96,
    delta: "−4% vs last week",
    values: [13.1, 12.4, 14.0, 15.2, 13.6, 14.8, 12.9],
    ticks: ["Mon", "Wed", "Fri", "Sun"],
    current: 1,
  },
  month: {
    total: 412,
    delta: "−8% vs September",
    values: [
      12.8, 12.1, 13.9, 15.5, 11.7, 10.5, 16.1, 14.6, 13.1, 11.8, 12.5, 15.0, 17.3, 15.8, 13.2, 12.7, 14.2,
      12.8, 11.4, 12.0, 15.7, 18.0, 16.7, 14.3, 13.6, 12.5, 13.6, 16.5, 17.6, 15.1, 13.9,
    ],
    ticks: ["1 Oct", "8", "15", "22", "31"],
    current: 7,
  },
} as const;

type Period = keyof typeof USAGE;

const PERIODS = ["day", "week", "month"] as const satisfies readonly Period[];
const PERIOD_LABELS = { day: "Day", week: "Week", month: "Month" } satisfies Record<Period, string>;

/** The two custom properties the `landing-bar` utility reads; a period switch retargets them. */
type BarStyle = CSSProperties & { "--bar-scale": string; "--bar-delay": string };

function UsageCard(): ReactElement {
  const [period, setPeriod] = useState<Period>("month");
  const data = USAGE[period];
  const max = Math.max(...data.values);

  return (
    <Labelled
      parts={[
        { name: "Card", slug: "card" },
        { name: "ToggleGroup", slug: "toggle-group" },
        { name: "Badge", slug: "badge" },
        { name: "Meter", slug: "meter" },
      ]}>
      <Card.Root>
        <Card.Content className={styles.headless()}>
          <div className={styles.usageHead()}>
            <div>
              <Card.Title>Usage</Card.Title>
              <Card.Description>October · Storgata 1, Bergen</Card.Description>
            </div>
            <SingleToggle
              label="Period"
              size="sm"
              options={PERIODS}
              labels={PERIOD_LABELS}
              value={period}
              onValueChange={setPeriod}
            />
          </div>
          <div className={styles.figureRow()}>
            <p className={styles.figure()}>
              <span key={period} className="landing-swap inline-block">
                {data.total}
              </span>
              <span className={styles.unit()}>kWh</span>
            </p>
            <Badge variant="success">{data.delta}</Badge>
          </div>
          <div className={styles.chart()} role="img" aria-label={`Usage this ${period}: ${data.total} kWh`}>
            {data.values.map((value, index) => {
              const bar: BarStyle = {
                "--bar-scale": String(Math.max(value / max, 0.04)),
                "--bar-delay": `${index * 10}ms`,
              };
              return (
                <div key={index} className={styles.barSlot()}>
                  <div
                    className={usageBar({ current: index >= data.values.length - data.current })}
                    style={bar}
                  />
                </div>
              );
            })}
          </div>
          <div className={styles.axis()} aria-hidden>
            {data.ticks.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </div>
          <div className={styles.meter()}>
            <BudgetMeter />
          </div>
        </Card.Content>
      </Card.Root>
    </Labelled>
  );
}

const CONTRACTS = {
  spot: { title: "Spot price", note: "Follows the hourly market" },
  fixed: { title: "Fixed for 12 months", note: "89.9 øre/kWh until Oct 2027" },
} as const;

type Contract = keyof typeof CONTRACTS;

function PriceModelCard(): ReactElement {
  const toastManager = Toast.useToastManager();
  const [choice, setChoice] = useState<Contract>("spot");
  const [current, setCurrent] = useState<Contract>("spot");

  return (
    <Labelled
      parts={[
        { name: "SelectionItem", slug: "selection-item" },
        { name: "Button", slug: "button" },
        { name: "Toast", slug: "toast" },
      ]}>
      <Card.Root>
        <Card.Header>
          <Card.Title>Price model</Card.Title>
          <Card.Description>Change once a month, free of charge.</Card.Description>
        </Card.Header>
        <Card.Content className={stack}>
          <RadioItemGroup
            label="Price model"
            value={choice}
            onChange={(next) => {
              if (next === "spot" || next === "fixed") {
                setChoice(next);
              }
            }}>
            {(["spot", "fixed"] as const).map((key) => (
              <RadioItem key={key} value={key}>
                <RadioItem.Content>
                  <RadioItem.Title>{CONTRACTS[key].title}</RadioItem.Title>
                  <RadioItem.Description>{CONTRACTS[key].note}</RadioItem.Description>
                </RadioItem.Content>
                {key === current ? (
                  <RadioItem.Actions>
                    <Badge variant="info" size="sm">
                      Current
                    </Badge>
                  </RadioItem.Actions>
                ) : null}
              </RadioItem>
            ))}
          </RadioItemGroup>
          <Button
            onClick={() => {
              setCurrent(choice);
              toastManager.add({
                type: "success",
                title:
                  choice === current
                    ? `${CONTRACTS[choice].title} kept`
                    : `${CONTRACTS[choice].title} from 1 November`,
                description: "We email you the terms.",
              });
            }}>
            {choice === current
              ? `Keep ${CONTRACTS[choice].title.toLowerCase()}`
              : `Switch to ${CONTRACTS[choice].title.toLowerCase()}`}
          </Button>
        </Card.Content>
      </Card.Root>
    </Labelled>
  );
}

const ALERTS = [
  { id: "price", title: "Price alerts", description: "When spot passes 120 øre", on: true },
  { id: "outage", title: "Outages near me", description: "From the grid company", on: false },
] as const;

function NotificationsCard(): ReactElement {
  return (
    <Labelled
      parts={[
        { name: "Field", slug: "field" },
        { name: "Switch", slug: "switch" },
      ]}>
      <Card.Root>
        <Card.Content className={cn(stack, styles.headless())}>
          {ALERTS.map((alert) => (
            <Field.Root key={alert.id} orientation="horizontal" className={styles.switchRow()}>
              <Field.Content>
                <Field.Label>{alert.title}</Field.Label>
                <Field.Description>{alert.description}</Field.Description>
              </Field.Content>
              <Switch defaultChecked={alert.on} />
            </Field.Root>
          ))}
        </Card.Content>
      </Card.Root>
    </Labelled>
  );
}

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "invoices", label: "Invoices" },
  { value: "agreements", label: "Agreements" },
  { value: "meters", label: "Meters" },
] as const;

export function ProductShot(): ReactElement {
  return (
    <section className={styles.section()} aria-labelledby="landing-components">
      <div className={styles.head()}>
        <p className={styles.eyebrow()}>Components</p>
        <h2 id="landing-components" className={styles.title()}>
          A customer page built with Fuse.
        </h2>
        <p className={styles.lede()}>Every control below is a Fuse component in the current theme.</p>
      </div>
      <div className={styles.frame()}>
        <Tabs.Root defaultValue="overview" className={styles.window()}>
          <div className={styles.header()}>
            <ElmeraGroupLogo variant="mark" className={styles.headerMark()} aria-hidden />
            <Tabs.List variant="line" className={styles.headerTabs()}>
              {TABS.map((tab) => (
                <Tabs.Trigger key={tab.value} value={tab.value} className={styles.headerTab()}>
                  {tab.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <Avatar.Root className={styles.headerAvatar()}>
              <Avatar.Fallback>KN</Avatar.Fallback>
            </Avatar.Root>
          </div>
          <Tabs.Content value="overview" className={styles.body()}>
            <UsageCard />
            <div className={styles.column()}>
              <PriceModelCard />
              <NotificationsCard />
            </div>
          </Tabs.Content>
          <Tabs.Content value="invoices" className={styles.body()}>
            <InvoicesTab />
          </Tabs.Content>
          <Tabs.Content value="agreements" className={styles.body()}>
            <AgreementsTab />
          </Tabs.Content>
          <Tabs.Content value="meters" className={styles.body()}>
            <MetersTab />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </section>
  );
}
