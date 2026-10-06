"use client";

import { useEffect } from "react";
import type { ReactElement } from "react";

import dynamic from "next/dynamic";

import { Loader } from "@elmeragroup/fuse/loader";
import { Sheet } from "@elmeragroup/fuse/sheet";

import { useDashboard } from "./dashboard-context";
import { nextOrderId } from "./dashboard-state";

// The form carries the date picker, the Dashboard's largest dependency, so its code loads apart,
// after the Dashboard mounts. The Sheet around it stays in the Dashboard's code and mounts closed,
// so an opening before the form arrives still plays the enter transition, Escape still closes it,
// and the loader holds the body until the form replaces it. The server renders nothing for a
// closed Sheet, so the form needs no server rendering.
const NewOrderForm = dynamic(async () => (await import("./new-order-form")).NewOrderForm, {
  ssr: false,
  loading: () => (
    <Sheet.Body>
      <Loader aria-label="Loading the form" />
    </Sheet.Body>
  ),
});

export type NewOrderSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Starts a private power order the way a seller does in the sales tool's `power-private` form:
 * the customer and their contact details, the facility, then the agreement. It saves as a draft
 * in Drafts, and Elhub fills in the price area and grid owner once the order is sent.
 */
export function NewOrderSheet({ open, onOpenChange }: NewOrderSheetProps): ReactElement {
  const { state } = useDashboard();
  useEffect(() => {
    // A failed fetch is not an error yet: opening the Sheet imports the module again.
    import("./new-order-form").catch(() => undefined);
  }, []);
  return (
    <Sheet.Root open={open} onOpenChange={onOpenChange}>
      <Sheet.Content size="lg">
        <Sheet.Header>
          <Sheet.Title>New order</Sheet.Title>
          <Sheet.Description>{`Saved as draft ${String(nextOrderId(state.orders))} until you send it.`}</Sheet.Description>
        </Sheet.Header>
        <NewOrderForm
          onSaved={() => {
            onOpenChange(false);
          }}
        />
      </Sheet.Content>
    </Sheet.Root>
  );
}
