"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { tv } from "tailwind-variants";

import { AlertDialog } from "@elmeragroup/fuse/alert-dialog";
import { Avatar } from "@elmeragroup/fuse/avatar";
import { Badge } from "@elmeragroup/fuse/badge";
import { Button } from "@elmeragroup/fuse/button";
import { DescriptionList } from "@elmeragroup/fuse/description-list";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import {
  ArrowsClockwise,
  CaretDown,
  CheckCircle,
  Copy,
  DotsThree,
  WarningCircle,
} from "@elmeragroup/fuse/icons";
import { ScrollArea } from "@elmeragroup/fuse/scroll-area";
import { Textarea } from "@elmeragroup/fuse/textarea";
import { BRANDS } from "@elmeragroup/fuse/theme";
import { TimelineList } from "@elmeragroup/fuse/timeline-list";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { useLandingTheme } from "../landing-theme";
import { useSideOverlay } from "../window-side";
import { useDashboard } from "./dashboard-context";
import {
  canSendContractSms,
  canSendReceipt,
  dateTime,
  formatKwh,
  maskSsn,
  ORDER_STATUSES,
  priceAreaLabel,
  productPrice,
  SELLERS,
  STATUS_ORDER,
} from "./dashboard-orders";
import type { ElhubCheck, Order } from "./dashboard-orders";
import { retryApplies } from "./dashboard-state";
import { Kbd } from "./kbd";
import { OrderStatusIcon } from "./order-status-icon";

const orderDetail = tv({
  slots: {
    root: "flex h-full min-h-0 flex-col",
    bar: "flex h-12 shrink-0 items-center gap-2 border-b border-border px-4",
    barId: "text-xs font-mono text-muted-foreground tabular-nums",
    barEnd: "ml-auto flex items-center gap-1",
    scroll: "min-h-0 flex-1",
    // Contained like the list, so long values wrap at the pane's width.
    body: "flex flex-col gap-7 px-5 pt-5 pb-24 contain-inline-size",
    titleBlock: "flex flex-col gap-1",
    title: "text-lg font-semibold m-0 text-balance text-foreground",
    subtitle: "text-sm m-0 text-muted-foreground",
    actions: "flex flex-wrap items-center gap-2",
    statusLabel: "max-w-48 truncate",
    sectionHead: "text-sm font-medium m-0 mb-2 text-foreground",
    // Linear's property panel: a narrow label column, values on one line where they fit, and
    // spacing instead of a rule between rows. Below 18rem, as in a 320px phone's Sheet, the
    // label column would leave values about 108px, so each label sits above its value instead.
    // The desktop pane and a 390px phone's Sheet both measure about 19.5rem and keep the column.
    // The section is the query container: a container query never matches its own element, so
    // the list's gap and its rows' direction both answer to this one width.
    propertySection: "@container",
    properties: "@2xs:gap-0 flex flex-col gap-2",
    property: "@2xs:min-h-7 @2xs:flex-row @2xs:items-start @2xs:gap-3 flex flex-col",
    term: "sm:border-0 @2xs:sm:w-28 @2xs:w-32 @2xs:shrink-0 border-0 py-0.5 text-muted-foreground",
    details: "sm:border-0 min-w-0 flex-1 border-0 py-0.5 text-pretty",
    mono: "text-xs font-mono tabular-nums",
    // A phrase of a comma-separated value wraps as a unit, and inside itself only when it alone
    // outgrows the column.
    phrase: "inline-block max-w-full",
    // Copy buttons sit inside the row's line box, so the value keeps the row's height.
    valueRow: "-my-0.5 flex min-w-0 items-center gap-1.5",
    // An 18-digit ID can outgrow a narrow value column; it wraps rather than pushing its copy
    // button out of the pane.
    meterPointId: "text-xs min-w-0 font-mono break-all tabular-nums",
    // `outline` draws in the text colour; the border token keeps the badge quiet.
    channel: "border-border",
    seller: "flex items-center gap-2",
    sellerAvatar: "size-5",
    elhub: "flex flex-col gap-3 rounded-lg border border-border p-3",
    elhubHead: "flex items-start gap-2.5",
    elhubIcon: "mt-0.5 size-4 shrink-0",
    elhubText: "flex min-w-0 flex-1 flex-col gap-0.5",
    elhubTitle: "text-sm font-medium m-0 text-foreground",
    elhubNote: "text-xs m-0 text-muted-foreground",
    composer: "flex flex-col gap-2",
    composerActions: "flex items-center justify-end gap-2",
    author: "text-muted-foreground",
  },
  variants: {
    elhub: {
      ok: { elhubIcon: "text-success" },
      problem: { elhubIcon: "text-warning" },
      waiting: { elhubIcon: "text-muted-foreground" },
    },
  },
});

const styles = orderDetail();

/** The demo's simulated Elhub round trip. */
const ELHUB_ROUND_TRIP_MS = 900;

function CopyButton({ value, label }: { value: string; label: string }): ReactElement {
  const { notify } = useDashboard();
  return (
    <Tooltip.Root>
      <Tooltip.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            onClick={() => {
              navigator.clipboard.writeText(value).then(
                () => {
                  notify({ type: "success", title: "Copied", description: value });
                },
                () => {
                  notify({
                    type: "error",
                    title: "Could not copy",
                    description: "The browser refused clipboard access.",
                  });
                }
              );
            }}
          />
        }>
        <Copy />
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}

function StatusMenu({ order }: { order: Order }): ReactElement {
  const { dispatch, now, notify } = useDashboard();
  const label = ORDER_STATUSES[order.status].label;
  const [open, setOpen] = useSideOverlay(false);
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger render={<Button variant="outline" size="sm" aria-label={`Status: ${label}`} />}>
        <OrderStatusIcon status={order.status} />
        <span className={styles.statusLabel()}>{label}</span>
        <CaretDown data-icon="inline-end" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.RadioGroup
          value={order.status}
          onValueChange={(value) => {
            const status = STATUS_ORDER.find((candidate) => candidate === value);
            if (status === undefined || status === order.status) {
              return;
            }
            dispatch({ _tag: "SetStatus", id: order.id, status, at: now() });
            notify({
              type: "success",
              title: `Moved to ${ORDER_STATUSES[status].label}`,
              description: `Order ${String(order.id)}, ${order.customer}`,
            });
          }}>
          <DropdownMenu.Label>Change status</DropdownMenu.Label>
          {STATUS_ORDER.map((status) => (
            <DropdownMenu.RadioItem key={status} value={status}>
              <OrderStatusIcon status={status} />
              {ORDER_STATUSES[status].label}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

type ElhubRetry = { pending: boolean; retry: () => void };

/**
 * Retries the Elhub owner check; a meter point Elhub does not know fails again. The answer is
 * dropped, toast and all, when the order's status moved while Elhub was asked.
 */
function useElhubRetry(order: Order): ElhubRetry {
  const { dispatch, now, notify } = useDashboard();
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The order as it is when the round trip ends, not as it was when the retry started.
  const latest = useRef(order);
  useLayoutEffect(() => {
    latest.current = order;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  const retry = () => {
    const expected = order.status;
    setPending(true);
    timer.current = setTimeout(() => {
      setPending(false);
      if (!retryApplies(latest.current, expected)) {
        return;
      }
      if (order.elhub._tag === "MeterPointNotFound") {
        dispatch({ _tag: "Log", ids: [order.id], title: "Elhub check failed again", at: now() });
        notify({
          type: "error",
          title: "Elhub still has no such meter point",
          description: `Check ${order.meterPointId} with ${order.customer}.`,
        });
        return;
      }
      dispatch({ _tag: "VerifyElhub", id: order.id, expected, at: now() });
      notify({
        type: "success",
        title: "Elhub check passed",
        description: `Order ${String(order.id)} moved to In progress.`,
      });
    }, ELHUB_ROUND_TRIP_MS);
  };
  return { pending, retry };
}

const ELHUB_COPY = {
  Verified: { tone: "ok", title: "Owner matches the customer" },
  OwnerMismatch: { tone: "problem", title: "Owner does not match" },
  MeterPointNotFound: { tone: "problem", title: "Meter point not found" },
  NotChecked: { tone: "waiting", title: "Not checked yet" },
} as const satisfies Record<ElhubCheck["_tag"], { tone: "ok" | "problem" | "waiting"; title: string }>;

function elhubNote(check: ElhubCheck): string {
  switch (check._tag) {
    case "Verified":
      return `Checked ${dateTime(check.checkedAt)}`;
    case "OwnerMismatch":
      return `Elhub has ${check.registeredOwner} as the owner. Checked ${dateTime(check.checkedAt)}.`;
    case "MeterPointNotFound":
      return `Elhub has no meter point with this ID. Checked ${dateTime(check.checkedAt)}.`;
    case "NotChecked":
      return "Elhub is asked when the order is sent.";
  }
}

function ElhubSection({ order }: { order: Order }): ReactElement {
  const { pending, retry } = useElhubRetry(order);
  const copy = ELHUB_COPY[order.elhub._tag];
  const tone = orderDetail({ elhub: copy.tone });
  const Icon = copy.tone === "ok" ? CheckCircle : WarningCircle;
  return (
    <section aria-labelledby={`elhub-${String(order.id)}`}>
      <h3 id={`elhub-${String(order.id)}`} className={styles.sectionHead()}>
        Elhub verification
      </h3>
      <div className={styles.elhub()}>
        <div className={styles.elhubHead()}>
          <Icon className={tone.elhubIcon()} />
          <div className={styles.elhubText()}>
            <p className={styles.elhubTitle()}>{copy.title}</p>
            <p className={styles.elhubNote()}>{elhubNote(order.elhub)}</p>
          </div>
        </div>
        {copy.tone === "problem" ? (
          <Button variant="outline" size="sm" isPending={pending} onClick={retry}>
            <ArrowsClockwise data-icon="inline-start" />
            Retry Elhub
          </Button>
        ) : null}
      </div>
    </section>
  );
}

type Property = { term: string; value: ReactNode };

function properties(order: Order, brand: string): readonly Property[] {
  const seller = SELLERS[order.seller];
  const facility: readonly Property[] =
    order.facility._tag === "Known"
      ? [
          { term: "Price area", value: priceAreaLabel(order.facility.priceArea) },
          { term: "Grid owner", value: order.facility.gridOwner },
          {
            term: "Annual use",
            value: <span className={styles.mono()}>{formatKwh(order.facility.annualKwh)}</span>,
          },
        ]
      : [{ term: "Price area", value: "Looked up in Elhub when sent" }];
  return [
    { term: "Customer", value: order.customer },
    { term: "SSN", value: <span className={styles.mono()}>{maskSsn(order.ssn)}</span> },
    { term: "Facility address", value: <Phrases value={order.address} /> },
    {
      term: "Meter point ID",
      value: (
        <span className={styles.valueRow()}>
          <span className={styles.meterPointId()}>{order.meterPointId}</span>
          <CopyButton value={order.meterPointId} label="Copy meter point ID" />
        </span>
      ),
    },
    ...facility,
    { term: "Product", value: order.product },
    { term: "Price", value: <Phrases value={productPrice(order.product)} /> },
    { term: "Campaign", value: order.campaign ?? "None" },
    { term: "Startup", value: order.startup },
    { term: "Sales type", value: order.salesType },
    {
      term: "Sales channel",
      value: (
        <Badge variant="outline" size="sm" className={styles.channel()}>
          {order.channel}
        </Badge>
      ),
    },
    {
      term: "Seller",
      value: (
        <span className={styles.seller()}>
          <Avatar.Root className={styles.sellerAvatar()}>
            <Avatar.Fallback>{seller.initials}</Avatar.Fallback>
          </Avatar.Root>
          {seller.name}
        </span>
      ),
    },
    { term: "Brand", value: brand },
  ];
}

function Activity({ order }: { order: Order }): ReactElement {
  const { dispatch, now, notify } = useDashboard();
  const [draft, setDraft] = useState("");
  const submit = () => {
    const text = draft.trim();
    if (text === "") {
      return;
    }
    dispatch({ _tag: "Comment", id: order.id, text, at: now() });
    setDraft("");
    notify({ type: "success", title: "Comment added", description: `Order ${String(order.id)}` });
  };
  return (
    <section aria-labelledby={`activity-${String(order.id)}`}>
      <h3 id={`activity-${String(order.id)}`} className={styles.sectionHead()}>
        Activity
      </h3>
      <TimelineList.Root>
        {order.activity.map((event) => (
          <TimelineList.Item key={event.id}>
            <TimelineList.Title>{event.title}</TimelineList.Title>
            <TimelineList.Time date={event.at}>{dateTime(event.at)}</TimelineList.Time>
            <TimelineList.Description>
              {event.detail}
              {event.author === undefined ? null : (
                <span className={styles.author()}>{` · ${SELLERS[event.author].name}`}</span>
              )}
            </TimelineList.Description>
          </TimelineList.Item>
        ))}
      </TimelineList.Root>
      <form
        className={styles.composer()}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}>
        <Textarea
          aria-label="Comment"
          placeholder="Leave a comment for the team"
          value={draft}
          rows={2}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className={styles.composerActions()}>
          <Kbd keys={["⌘", "↵"]} />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={draft.trim() === ""}
            aria-keyshortcuts="Meta+Enter Control+Enter">
            Comment
          </Button>
        </div>
      </form>
    </section>
  );
}

function MoreActions({ order, onCancel }: { order: Order; onCancel: () => void }): ReactElement {
  const { dispatch, now, notify } = useDashboard();
  const closed = order.status === "Cancelled" || order.status === "Done";
  const [open, setOpen] = useSideOverlay(false);
  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}>
        <DotsThree />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Item
          disabled={!canSendContractSms(order.status)}
          onClick={() => {
            dispatch({ _tag: "Log", ids: [order.id], title: "Contract sent by SMS", at: now() });
            notify({
              type: "success",
              title: "Contract sent by SMS",
              description: `${order.customer} gets a new signing link.`,
            });
          }}>
          Resend contract
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={!canSendReceipt(order.status)}
          onClick={() => {
            dispatch({ _tag: "Log", ids: [order.id], title: "Receipt sent by email", at: now() });
            notify({
              type: "success",
              title: "Receipt sent",
              description: `Order ${String(order.id)}, ${order.customer}`,
            });
          }}>
          Send receipt
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={closed || order.status === "SendtToTm"}
          onClick={() => {
            dispatch({ _tag: "SetStatus", id: order.id, status: "SendtToTm", at: now() });
            notify({
              type: "success",
              title: "Sent to telemarketing",
              description: `Mysil's team calls ${order.customer}.`,
            });
          }}>
          Send to telemarketing
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item variant="destructive" disabled={closed} onClick={onCancel}>
          Cancel order…
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export type OrderDetailProps = {
  order: Order;
  /** A heading element for the order's customer; the Sheet passes its own title part. */
  renderTitle?: (title: string) => ReactElement;
  /** Trailing bar controls, such as the Sheet's close button. */
  barEnd?: ReactNode;
};

/**
 * One order's detail: its status menu and actions, its properties, the Elhub owner check and
 * its activity log with a comment composer. Every action confirms through the window's toasts.
 */
export function OrderDetail({ order, renderTitle, barEnd }: OrderDetailProps): ReactElement {
  const { dispatch, now, notify } = useDashboard();
  const { theme } = useLandingTheme();
  const [confirming, setConfirming] = useSideOverlay(false);
  const title = renderTitle?.(order.customer) ?? <h2 className={styles.title()}>{order.customer}</h2>;
  const product = order.campaign === undefined ? order.product : `${order.product} · ${order.campaign}`;

  return (
    <div className={styles.root()}>
      <div className={styles.bar()}>
        <OrderStatusIcon status={order.status} />
        <span className={styles.barId()}>{order.id}</span>
        <CopyButton value={String(order.id)} label="Copy order number" />
        <div className={styles.barEnd()}>
          <MoreActions
            order={order}
            onCancel={() => {
              setConfirming(true);
            }}
          />
          {barEnd}
        </div>
      </div>
      <ScrollArea.Root className={styles.scroll()}>
        <div className={styles.body()}>
          <div className={styles.titleBlock()}>
            {title}
            <p className={styles.subtitle()}>{product}</p>
          </div>
          <div className={styles.actions()}>
            <StatusMenu order={order} />
          </div>
          <DescriptionList.Root className={styles.propertySection()}>
            <h3 className={styles.sectionHead()}>Properties</h3>
            <DescriptionList.Content className={styles.properties()}>
              {properties(order, BRANDS[theme.brand].displayName).map((property) => (
                <PropertyRow key={property.term} property={property} />
              ))}
            </DescriptionList.Content>
          </DescriptionList.Root>
          <ElhubSection order={order} />
          <Activity order={order} />
        </div>
      </ScrollArea.Root>
      <AlertDialog.Root open={confirming} onOpenChange={setConfirming}>
        <AlertDialog.Content
          title={`Cancel order ${String(order.id)}?`}
          actionLabel="Cancel order"
          cancelLabel="Keep order"
          onAction={() => {
            dispatch({ _tag: "SetStatus", id: order.id, status: "Cancelled", at: now() });
            setConfirming(false);
            notify({
              type: "success",
              title: "Order cancelled",
              description: `${order.customer} gets no contract.`,
            });
          }}>
          {`${order.customer} gets no contract, and the order moves to Cancelled. You can reopen it from the status menu.`}
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  );
}

/** Renders a comma-separated value so a narrow column breaks it after a comma, not mid-phrase. */
function Phrases({ value }: { value: string }): ReactElement {
  const parts = value.split(", ");
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index === 0 ? null : " "}
          <span className={styles.phrase()}>{index < parts.length - 1 ? `${part},` : part}</span>
        </Fragment>
      ))}
    </>
  );
}

function PropertyRow({ property }: { property: Property }): ReactElement {
  return (
    <div className={styles.property()}>
      <DescriptionList.Term className={styles.term()}>{property.term}</DescriptionList.Term>
      <DescriptionList.Details className={styles.details()}>{property.value}</DescriptionList.Details>
    </div>
  );
}
