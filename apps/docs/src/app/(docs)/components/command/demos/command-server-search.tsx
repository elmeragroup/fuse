"use client";

import { Suspense, use, useId, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { Command } from "@elmeragroup/fuse/command";
import { SpinnerGap } from "@elmeragroup/fuse/icons";
import { loaderVariants } from "@elmeragroup/fuse/loader";

type OrderLine = { readonly product: string; readonly amount: number };

type StoredOrder = {
  readonly number: string;
  readonly customer: string;
  readonly placed: string;
  readonly status: "Paid" | "Unpaid" | "Refunded";
  readonly lines: readonly OrderLine[];
};

/** An order as the search returns it: the summary, without the lines. */
type Order = Omit<StoredOrder, "lines"> & { readonly total: number };

/** The order the user opened, and the request for its lines. */
type OpenedOrder = { readonly order: Order; readonly lines: Promise<readonly OrderLine[]> };

const STORED_ORDERS: readonly StoredOrder[] = [
  {
    number: "10418",
    customer: "Ada Lovelace",
    placed: "2 October 2026",
    status: "Paid",
    lines: [
      { product: "Charging box", amount: 9990 },
      { product: "Installation", amount: 4500 },
    ],
  },
  {
    number: "10427",
    customer: "Grace Hopper",
    placed: "4 October 2026",
    status: "Unpaid",
    lines: [{ product: "Heat pump service", amount: 2490 }],
  },
  {
    number: "10431",
    customer: "Ada Lovelace",
    placed: "6 October 2026",
    status: "Unpaid",
    lines: [
      { product: "Smart plug", amount: 499 },
      { product: "Smart thermostat", amount: 1490 },
    ],
  },
  {
    number: "10436",
    customer: "Katherine Johnson",
    placed: "7 October 2026",
    status: "Paid",
    lines: [
      { product: "Solar panel survey", amount: 1990 },
      { product: "Roof inspection", amount: 2900 },
    ],
  },
  {
    number: "10442",
    customer: "Margaret Hamilton",
    placed: "9 October 2026",
    status: "Refunded",
    lines: [{ product: "Charging cable", amount: 1290 }],
  },
  {
    number: "10455",
    customer: "Grace Hopper",
    placed: "11 October 2026",
    status: "Paid",
    lines: [{ product: "Electricity meter swap", amount: 1490 }],
  },
];

const ORDER_ACTIONS = ["Open order", "Copy order number", "Resend confirmation"];

const NOK = new Intl.NumberFormat("en-US", { style: "currency", currency: "NOK" });

const spinner = loaderVariants({ size: "small" }).icon();

/**
 * Stands in for the server. It answers after `delay` milliseconds, unless the request is aborted
 * first.
 */
function respond<T>(value: T, delay: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(value);
    }, delay);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });
}

/**
 * Matches the query against order numbers and customers, as the server would. A broad query
 * takes the stand-in longer, as a large result set would, so a stale request can finish last.
 */
function searchOrders(query: string, signal: AbortSignal): Promise<readonly Order[]> {
  const needle = query.trim().toLocaleLowerCase("en-US");
  const found = STORED_ORDERS.filter(
    (order) => order.number.includes(needle) || order.customer.toLocaleLowerCase("en-US").includes(needle)
  ).map(({ lines, ...summary }) => ({
    ...summary,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  }));
  return respond(found, 120 + 60 * found.length, signal);
}

function fetchOrderLines(number: string): Promise<readonly OrderLine[]> {
  return respond(STORED_ORDERS.find((order) => order.number === number)?.lines ?? [], 400);
}

/** What the status line says about the search. */
function searchStatus(query: string, pending: boolean, failed: boolean, count: number): ReactNode {
  if (query.trim() === "") {
    return null;
  }
  if (pending) {
    return (
      <>
        <SpinnerGap aria-hidden className={spinner} />
        Searching…
      </>
    );
  }
  if (failed) {
    return "The search failed. Try again.";
  }
  if (count === 0) {
    return `No orders match "${query}".`;
  }
  return count === 1 ? "1 order" : `${count} orders`;
}

/** The lines of the opened order, read from the request its row started. */
function OrderLines({ lines }: { lines: Promise<readonly OrderLine[]> }) {
  const loaded = use(lines);
  return (
    <ul className="flex flex-col gap-1">
      {loaded.map((line) => (
        <li key={line.product} className="flex justify-between gap-4">
          <span>{line.product}</span>
          <span className="text-muted-foreground tabular-nums">{NOK.format(line.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Searches orders on the server as the user types, and opens one order's details and actions on
 * a page of its own. The query and the results live above `Command.Root`, so going back shows the
 * same results.
 */
export function CommandServerSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<readonly Order[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const request = useRef<AbortController | null>(null);
  const [opened, setOpened] = useState<OpenedOrder | null>(null);
  const [lastRun, setLastRun] = useState("");
  const summaryId = useId();

  function search(next: string) {
    setQuery(next);
    // Abort the request before, so its results can't replace this one's.
    request.current?.abort();
    request.current = null;
    if (next.trim() === "") {
      setResults([]);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    startTransition(async () => {
      try {
        const found = await searchOrders(next, controller.signal);
        // React joins state set after an await to the transition only inside startTransition.
        startTransition(() => {
          setResults(found);
          setFailed(false);
        });
      } catch {
        if (!controller.signal.aborted) {
          startTransition(() => {
            setFailed(true);
          });
        }
      }
    });
  }

  return (
    <div className="max-w-xl flex w-full flex-col gap-3">
      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground">
        <Command.Root defaultPages={["orders"]}>
          <Command.Page
            id="orders"
            label="Orders"
            items={results}
            filter={null}
            value={query}
            onValueChange={search}
            itemToStringValue={(order) => `${order.number} ${order.customer}`}>
            <Command.Input placeholder="Order number or customer…" />
            <Command.Status>{searchStatus(query, pending, failed, results.length)}</Command.Status>
            <Command.List>
              {(order: Order) => (
                <Command.PageTrigger
                  key={order.number}
                  value={order}
                  page="order"
                  onClick={() => {
                    setOpened({ order, lines: fetchOrderLines(order.number) });
                  }}>
                  Order {order.number}
                  <span className="text-xs text-muted-foreground">{order.customer}</span>
                </Command.PageTrigger>
              )}
            </Command.List>
            <Command.Footer>
              <Command.NavigateHint />
              <Command.SelectHint>Open</Command.SelectHint>
            </Command.Footer>
          </Command.Page>
          {opened !== null && (
            <Command.Page id="order" label={`Order ${opened.order.number}`} items={ORDER_ACTIONS}>
              <Command.Input placeholder="Search actions…" aria-describedby={summaryId} />
              {/* Inset to the rows' text: the list's surface gap, then a row's own padding. */}
              <div className="border-b border-border p-(--surface-gap-sm)">
                <div className="text-sm flex flex-col gap-3 px-(--row-px)">
                  <dl id={summaryId} className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                    <dt className="text-muted-foreground">Customer</dt>
                    <dd>{opened.order.customer}</dd>
                    <dt className="text-muted-foreground">Placed</dt>
                    <dd>{opened.order.placed}</dd>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{opened.order.status}</dd>
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="tabular-nums">{NOK.format(opened.order.total)}</dd>
                  </dl>
                  <Suspense fallback={<p className="text-muted-foreground">Loading the order lines…</p>}>
                    <OrderLines lines={opened.lines} />
                  </Suspense>
                </div>
              </div>
              <Command.Empty />
              <Command.List>
                {(action: string) => (
                  <Command.Item
                    key={action}
                    value={action}
                    onClick={() => {
                      setLastRun(`${action}: Order ${opened.order.number}`);
                    }}>
                    {action}
                  </Command.Item>
                )}
              </Command.List>
              <Command.Footer>
                <Command.NavigateHint />
                <Command.SelectHint>Run</Command.SelectHint>
                <Command.BackHint />
              </Command.Footer>
            </Command.Page>
          )}
        </Command.Root>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {lastRun === "" ? "No action run yet." : `Ran: ${lastRun}`}
      </p>
    </div>
  );
}
