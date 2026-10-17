import type { ReactElement } from "react";

import { Accordion } from "@elmeragroup/fuse/accordion";
import { Alert } from "@elmeragroup/fuse/alert";
import { Avatar } from "@elmeragroup/fuse/avatar";
import { Badge } from "@elmeragroup/fuse/badge";
import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";
import { Button } from "@elmeragroup/fuse/button";
import { ButtonGroup } from "@elmeragroup/fuse/button-group";
import { Code } from "@elmeragroup/fuse/code";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { Empty } from "@elmeragroup/fuse/empty";
import { Heading } from "@elmeragroup/fuse/heading";
import { MagnifyingGlass, Receipt } from "@elmeragroup/fuse/icons";
import { FkasMeter } from "@elmeragroup/fuse/illustrations";
import { InputGroup } from "@elmeragroup/fuse/input-group";
import { Item } from "@elmeragroup/fuse/item";
import { Kbd, KbdGroup } from "@elmeragroup/fuse/kbd";
import { Pagination } from "@elmeragroup/fuse/pagination";
import { Table } from "@elmeragroup/fuse/table";
import { Tabs } from "@elmeragroup/fuse/tabs";
import { Text } from "@elmeragroup/fuse/text";
import { useTheme } from "@elmeragroup/fuse/theme";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";
import { ToggleGroup } from "@elmeragroup/fuse/toggle-group";

import { currencyOf } from "../../../brand/brand-market";
import { INSTALL_COMMAND } from "../../../brand/fuse-facts";
import { useCopy, useVideoLocale } from "../../../copy/copy";
import { formatDay } from "../../../copy/format-day";
import { CURRENT_DAYS, WEEK_KWH } from "../../../sample/customer-data";
import { OrderRows } from "../../../sample/order-rows";
import { CUSTOMER, PEOPLE, TABLE_ORDERS, TIMELINE_DAYS } from "../../sample-data";

/** The pages a table's pagination offers; the second is current. */
const PAGES = [1, 2, 3] as const;

/**
 * The orders table of its plate brand's internal app, amounts in its market's currency, over the
 * pagination that pages it.
 */
export function TableTile(): ReactElement {
  const { table } = useCopy().density;
  const currency = currencyOf(useTheme().brand);
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>{table.customer}</Table.Head>
            <Table.Head>{table.status}</Table.Head>
            <Table.Head className="text-right">{table.amount}</Table.Head>
          </Table.Row>
        </Table.Header>
        <OrderRows orders={TABLE_ORDERS} currency={currency} />
      </Table.Root>
      <Pagination.Root>
        <Pagination.Content>
          <Pagination.Item>
            <Pagination.Previous href="#previous" />
          </Pagination.Item>
          {PAGES.map((page) => (
            <Pagination.Item key={page}>
              <Pagination.Link href={`#${String(page)}`} isActive={page === 2}>
                {page}
              </Pagination.Link>
            </Pagination.Item>
          ))}
          <Pagination.Item>
            <Pagination.Next href="#next" />
          </Pagination.Item>
        </Pagination.Content>
      </Pagination.Root>
    </div>
  );
}

/** A customer's details as a description list, under the trail that leads to them. */
export function DescriptionListTile(): ReactElement {
  const { details, breadcrumb } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href="#customers">{breadcrumb.customers}</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{CUSTOMER.name}</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
      <DescriptionList.Root>
        <DescriptionList.Heading>{details.heading}</DescriptionList.Heading>
        <DescriptionList.Content>
          <DescriptionList.Term>{details.name}</DescriptionList.Term>
          <DescriptionList.Details>{CUSTOMER.name}</DescriptionList.Details>
          <DescriptionList.Term>{details.customerNumber}</DescriptionList.Term>
          <DescriptionList.Details>{CUSTOMER.customerNumber}</DescriptionList.Details>
          <DescriptionList.Term>{details.address}</DescriptionList.Term>
          <DescriptionList.Details>{CUSTOMER.address}</DescriptionList.Details>
        </DescriptionList.Content>
      </DescriptionList.Root>
    </div>
  );
}

/** An order's history as a timeline, its days in the video's locale. */
export function TimelineTile(): ReactElement {
  const { timeline } = useCopy().brandBook.collage;
  const locale = useVideoLocale();
  return (
    <TimelineList.Root>
      {timeline.map((title, index) => {
        const day = TIMELINE_DAYS[index] ?? TIMELINE_DAYS[0];
        return (
          <TimelineList.Item key={title}>
            <TimelineList.Title>{title}</TimelineList.Title>
            <TimelineList.Time date={new Date(day)}>{formatDay(locale, day)}</TimelineList.Time>
          </TimelineList.Item>
        );
      })}
    </TimelineList.Root>
  );
}

/** Status badges over a segmented button group. */
export function BadgeTile(): ReactElement {
  const copy = useCopy();
  const { table } = copy.density;
  const { periods } = copy.brandBook.collage;
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{table.active}</Badge>
        <Badge variant="soft-success">{table.active}</Badge>
        <Badge variant="soft-warning">{table.pending}</Badge>
        <Badge variant="outline">{table.paused}</Badge>
      </div>
      <ButtonGroup.Root aria-label={periods.join(", ")}>
        {periods.map((period) => (
          <Button key={period} variant="outline" size="sm">
            {period}
          </Button>
        ))}
      </ButtonGroup.Root>
    </div>
  );
}

/** Customers as avatars beside list items. */
export function PeopleTile(): ReactElement {
  const { people } = useCopy().brandBook.collage;
  return (
    <Item.Group>
      {PEOPLE.map((person) => (
        <Item.Root key={person.name} size="sm">
          <Item.Media>
            <Avatar.Root className="size-8">
              <Avatar.Fallback>{person.initials}</Avatar.Fallback>
            </Avatar.Root>
          </Item.Media>
          <Item.Content>
            <Item.Title>{person.name}</Item.Title>
            <Item.Description>{people.since(String(person.since))}</Item.Description>
          </Item.Content>
        </Item.Root>
      ))}
    </Item.Group>
  );
}

/** The install command as code, and the palette's shortcut as keys. */
export function CodeTile(): ReactElement {
  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <Code code={INSTALL_COMMAND} className="rounded-lg border border-border bg-card px-4 py-3" />
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    </div>
  );
}

/** The brand's type: a heading in its heading face over body text. */
export function TypeTile(): ReactElement {
  const { type } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <Heading level={2} size="4xl" className="m-0">
        Aa
      </Heading>
      <Heading level={3} size="xl" className="m-0">
        {type.heading}
      </Heading>
      <Text variant="muted">{type.body}</Text>
    </div>
  );
}

/** Fjordkraft's meter illustration, at its own size and colours. */
export function IllustrationTile(): ReactElement {
  return (
    <div className="flex h-full items-center justify-center">
      <FkasMeter className="h-40 w-auto" />
    </div>
  );
}

/** A search box with its shortcut as keys. */
export function SearchTile(): ReactElement {
  const { search } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full items-center">
      <InputGroup.Root>
        <InputGroup.Addon>
          <MagnifyingGlass aria-hidden />
        </InputGroup.Addon>
        <InputGroup.Input aria-label={search.placeholder} placeholder={search.placeholder} />
        <InputGroup.Addon align="inline-end">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </InputGroup.Addon>
      </InputGroup.Root>
    </div>
  );
}

/** An empty invoice list. */
export function EmptyTile(): ReactElement {
  const { empty } = useCopy().brandBook.collage;
  return (
    <Empty.Root>
      <Empty.Header>
        <Empty.Media variant="icon">
          <Receipt aria-hidden />
        </Empty.Media>
        <Empty.Title>{empty.title}</Empty.Title>
        <Empty.Description>{empty.description}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  );
}

/** A warning that asks for the month's reading. */
export function AlertTile(): ReactElement {
  const { alert } = useCopy().brandBook.collage;
  return (
    <Alert.Root variant="warning">
      <Alert.Title>{alert.title}</Alert.Title>
      <Alert.Description>{alert.description}</Alert.Description>
    </Alert.Root>
  );
}

/** Three questions, the first one open. */
export function AccordionTile(): ReactElement {
  const { accordion } = useCopy().brandBook.collage;
  return (
    <Accordion.Root value={[accordion[0].question]}>
      {accordion.map(({ question, answer }) => (
        <Accordion.Item key={question} value={question}>
          <Accordion.Header>
            <Accordion.Trigger>{question}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>{answer}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}

/** Tabs over a week of use, the current days in the primary role, with a period switch. */
export function TabsTile(): ReactElement {
  const { tabs, periods } = useCopy().brandBook.collage;
  const [day, week, month] = periods;
  const locale = useVideoLocale();
  const max = Math.max(...WEEK_KWH);
  const total = WEEK_KWH.reduce((sum, day) => sum + day, 0);
  const [overview, invoices, agreements] = tabs.items;
  return (
    <Tabs.Root value="overview" className="flex h-full flex-col gap-3">
      <Tabs.List variant="line">
        <Tabs.Trigger value="overview">{overview}</Tabs.Trigger>
        <Tabs.Trigger value="invoices">{invoices}</Tabs.Trigger>
        <Tabs.Trigger value="agreements">{agreements}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="overview" className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{tabs.usage}</span>
          <ToggleGroup.Root value={["week"]} size="sm" aria-label={tabs.usage}>
            <ToggleGroup.Item value="day">{day}</ToggleGroup.Item>
            <ToggleGroup.Item value="week">{week}</ToggleGroup.Item>
            <ToggleGroup.Item value="month">{month}</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
        <p className="text-3xl font-semibold m-0 font-heading leading-none tabular-nums">
          {new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(total)}
          <span className="text-sm font-normal ml-1 text-muted-foreground">kWh</span>
        </p>
        <div className="flex min-h-0 flex-1 items-end gap-1.5">
          {WEEK_KWH.map((value, index) => (
            <div
              key={index}
              className={
                index >= WEEK_KWH.length - CURRENT_DAYS
                  ? "flex-1 rounded-t-sm bg-primary"
                  : "flex-1 rounded-t-sm bg-primary/30"
              }
              style={{ height: `${String((value / max) * 100)}%` }}
            />
          ))}
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}
