"use client";

import { createContext, use, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Command } from "@elmeragroup/fuse/command";

type Action = { readonly label: string; readonly run: () => void };

type ActionGroup = { readonly value: string; readonly items: readonly Action[] };

type Customer = { readonly id: string; readonly name: string; readonly city: string };

const CUSTOMERS: readonly Customer[] = [
  { id: "10231", name: "Ada Lovelace", city: "Bergen" },
  { id: "10232", name: "Grace Hopper", city: "Trondheim" },
  { id: "10233", name: "Margaret Hamilton", city: "Tromsø" },
];

const CUSTOMER_ACTIONS = ["Send invoice copy", "Register meter reading"];

/** The page on screen. An app reads it from its router, and this demo keeps it in state. */
type Route =
  | { readonly page: "overview" }
  | { readonly page: "customers" }
  | { readonly page: "customer"; readonly customer: Customer };

/** What the app's layout gives its pages. */
type AppContextValue = {
  readonly navigate: (route: Route) => void;
  readonly report: (summary: string) => void;
  /** Puts these groups above the app's own commands. */
  readonly setPageCommands: (groups: readonly ActionGroup[]) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function useApp(): AppContextValue {
  const app = use(AppContext);
  if (app === null) {
    throw new Error("A page renders inside the app's layout.");
  }
  return app;
}

/**
 * Adds the page's commands to the palette while the page is on screen. Pass the same array
 * until the commands change, as `useMemo` does, or the palette updates on every render.
 */
function usePageCommands(groups: readonly ActionGroup[]): void {
  const { setPageCommands } = useApp();
  useEffect(() => {
    setPageCommands(groups);
    return () => {
      setPageCommands([]);
    };
  }, [setPageCommands, groups]);
}

function OverviewPage() {
  return <p className="text-sm text-muted-foreground">{CUSTOMERS.length} customers</p>;
}

/** The customer list adds a command per customer. */
function CustomersPage() {
  const { navigate } = useApp();
  usePageCommands(
    useMemo(
      () => [
        {
          value: "Customers",
          items: CUSTOMERS.map((customer) => ({
            label: customer.name,
            run: () => {
              navigate({ page: "customer", customer });
            },
          })),
        },
      ],
      [navigate]
    )
  );
  return (
    <ul className="flex flex-col items-start gap-1">
      {CUSTOMERS.map((customer) => (
        <li key={customer.id}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigate({ page: "customer", customer });
            }}>
            {customer.name}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** A customer's page adds a group of actions on that customer, named after them. */
function CustomerPage({ customer }: { customer: Customer }) {
  const { report } = useApp();
  usePageCommands(
    useMemo(
      () => [
        {
          value: customer.name,
          items: CUSTOMER_ACTIONS.map((label) => ({
            label,
            run: () => {
              report(`${label}: ${customer.name}`);
            },
          })),
        },
      ],
      [customer, report]
    )
  );
  return (
    <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
      <dt className="text-muted-foreground">Customer number</dt>
      <dd>{customer.id}</dd>
      <dt className="text-muted-foreground">City</dt>
      <dd>{customer.city}</dd>
    </dl>
  );
}

function titleOf(route: Route): string {
  switch (route.page) {
    case "overview":
      return "Overview";
    case "customers":
      return "Customers";
    case "customer":
      return route.customer.name;
  }
}

function PageOf({ route }: { route: Route }): ReactElement {
  switch (route.page) {
    case "overview":
      return <OverviewPage />;
    case "customers":
      return <CustomersPage />;
    case "customer":
      return <CustomerPage customer={route.customer} />;
  }
}

/**
 * The app's layout, with one palette for every page. The header button opens it; the docs site
 * keeps ⌘K and Ctrl+K for its own palette. The Root stays mounted while the pages change, and its
 * `items` are the page's commands above the app's own.
 */
export function CommandAppPalette() {
  const [route, setRoute] = useState<Route>({ page: "customers" });
  const [open, setOpen] = useState(false);
  const [pageCommands, setPageCommands] = useState<readonly ActionGroup[]>([]);
  const [lastRun, setLastRun] = useState("");
  const app = useMemo<AppContextValue>(
    () => ({ navigate: setRoute, report: setLastRun, setPageCommands }),
    []
  );
  const commands = useMemo<readonly ActionGroup[]>(
    () => [
      ...pageCommands,
      {
        value: "Go to",
        items: [
          {
            label: "Overview",
            run: () => {
              setRoute({ page: "overview" });
            },
          },
          {
            label: "Customers",
            run: () => {
              setRoute({ page: "customers" });
            },
          },
        ],
      },
    ],
    [pageCommands]
  );
  // A command that changes the page changes the page's commands while the dialog still fades
  // out. The layout passes the palette the rows it showed until it opens again.
  const [shown, setShown] = useState(commands);
  if (open && shown !== commands) {
    setShown(commands);
  }
  return (
    <AppContext.Provider value={app}>
      <div className="max-w-xl flex w-full flex-col gap-3">
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex items-center gap-1 border-b border-border px-3 py-2">
            <nav aria-label="App" className="flex gap-1">
              <Button
                variant={route.page === "overview" ? "secondary" : "ghost"}
                size="sm"
                aria-current={route.page === "overview" ? "page" : undefined}
                onClick={() => {
                  setRoute({ page: "overview" });
                }}>
                Overview
              </Button>
              <Button
                variant={route.page === "overview" ? "ghost" : "secondary"}
                size="sm"
                aria-current={route.page === "customers" ? "page" : undefined}
                onClick={() => {
                  setRoute({ page: "customers" });
                }}>
                Customers
              </Button>
            </nav>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => {
                setOpen(true);
              }}>
              Search commands
            </Button>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <p className="text-base font-medium">{titleOf(route)}</p>
            <PageOf route={route} />
          </div>
        </div>
        <p role="status" className="text-sm text-muted-foreground">
          {lastRun === "" ? "No command run yet." : `Ran: ${lastRun}`}
        </p>
        <Command.Root grouped items={shown} open={open} onOpenChange={setOpen}>
          <Command.Content>
            <Command.Input />
            <Command.Empty />
            <Command.List>
              {(group: ActionGroup) => (
                <Command.Group key={group.value} items={group.items}>
                  <Command.Label>{group.value}</Command.Label>
                  <Command.Collection>
                    {(action: Action) => (
                      <Command.Item
                        key={action.label}
                        value={action}
                        onClick={() => {
                          setOpen(false);
                          action.run();
                        }}>
                        {action.label}
                      </Command.Item>
                    )}
                  </Command.Collection>
                </Command.Group>
              )}
            </Command.List>
            <Command.Footer>
              <Command.NavigateHint />
              <Command.SelectHint>Run</Command.SelectHint>
              <Command.CloseHint />
            </Command.Footer>
          </Command.Content>
        </Command.Root>
      </div>
    </AppContext.Provider>
  );
}
