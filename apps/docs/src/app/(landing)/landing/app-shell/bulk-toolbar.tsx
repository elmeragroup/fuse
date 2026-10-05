"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Combobox } from "@elmeragroup/fuse/combobox";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { DeviceMobile, Receipt, Users, X } from "@elmeragroup/fuse/icons";
import { Tooltip } from "@elmeragroup/fuse/tooltip";

import { useSideOverlay } from "../window-side";
import { useDashboard } from "./dashboard-context";
import { canSendContractSms, canSendReceipt, SELLER_LIST } from "./dashboard-orders";
import type { Order, OrderStatus, Seller } from "./dashboard-orders";

const bulkToolbar = tv({
  slots: {
    // Floats over the list, clear of the window's faded bottom edge.
    bar: "landing-rise shadow-lg absolute inset-x-0 z-30 mx-auto flex w-max max-w-[calc(100%-2rem)] items-center gap-1 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground",
    count: "text-xs font-medium px-2 whitespace-nowrap tabular-nums",
    // A narrow list keeps the icons; each button names itself either way.
    label: "@md:inline hidden",
    divider: "mx-1 h-5 w-px bg-border",
    form: "flex flex-col gap-4",
  },
  variants: {
    // Order search keeps its pagination along the bottom, so the bar floats above it.
    above: { list: { bar: "bottom-6" }, pagination: { bar: "bottom-18" } },
  },
});

const styles = bulkToolbar();

/** The toast copy the bulk plan settles on: how many of the selection the action reached. */
function outcome(eligible: number, selected: number, verb: string, skipReason: string): string {
  const skipped = selected - eligible;
  return skipped === 0
    ? `${String(eligible)} of ${String(selected)} orders ${verb}.`
    : `${String(eligible)} of ${String(selected)} orders ${verb}. ${String(skipped)} skipped: ${skipReason}.`;
}

function ChangeSellerDialog({
  open,
  onOpenChange,
  selection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: readonly Order[];
}): ReactElement {
  const { dispatch, now, notify } = useDashboard();
  const [seller, setSeller] = useState<Seller | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Change seller</Dialog.Title>
          <Dialog.Description>{`The ${String(selection.length)} selected orders move to the seller you pick.`}</Dialog.Description>
        </Dialog.Header>
        <form
          className={styles.form()}
          onSubmit={(event) => {
            event.preventDefault();
            if (seller === null) {
              return;
            }
            dispatch({
              _tag: "Reassign",
              ids: selection.map((order) => order.id),
              seller: seller.id,
              at: now(),
            });
            dispatch({ _tag: "ClearChecks" });
            onOpenChange(false);
            notify({
              type: "success",
              title: "Seller changed",
              description: `${outcome(selection.length, selection.length, "moved", "")} ${seller.name} owns them now.`,
            });
          }}>
          <Combobox.Root
            items={[...SELLER_LIST]}
            value={seller}
            onValueChange={setSeller}
            itemToStringLabel={(item: Seller) => item.name}>
            <Combobox.Input aria-label="Seller" placeholder="Search sellers" />
            <Combobox.Content>
              <Combobox.Empty />
              <Combobox.List>
                <Combobox.Collection>
                  {(item: Seller) => (
                    <Combobox.Item key={item.id} value={item}>
                      {`${item.name} · ${item.team}`}
                    </Combobox.Item>
                  )}
                </Combobox.Collection>
              </Combobox.List>
            </Combobox.Content>
          </Combobox.Root>
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
            <Button type="submit" disabled={seller === null}>
              Change seller
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/**
 * The floating toolbar checked rows raise: send the signing SMS, send receipts or change seller
 * for the whole selection. The sales tool plans these as SALGSL-4115; each reports how many of the
 * selection it reached.
 */
export function BulkToolbar(): ReactElement | null {
  const { state, dispatch, now, notify } = useDashboard();
  const [changing, setChanging] = useSideOverlay(false);
  const selection = state.orders.filter((order) => state.checked.includes(order.id));

  if (selection.length === 0 && !changing) {
    return null;
  }

  const send = (
    eligibleFor: (status: OrderStatus) => boolean,
    title: string,
    verb: string,
    reason: string
  ) => {
    const eligible = selection.filter((order) => eligibleFor(order.status));
    dispatch({ _tag: "Log", ids: eligible.map((order) => order.id), title, at: now() });
    notify({
      type: eligible.length === 0 ? "error" : "success",
      title,
      description: outcome(eligible.length, selection.length, verb, reason),
    });
  };

  return (
    <>
      {selection.length === 0 ? null : (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className={bulkToolbar({ above: state.view === "order-search" ? "pagination" : "list" }).bar()}>
          <span className={styles.count()}>{`${String(selection.length)} selected`}</span>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Clear selection"
                  aria-keyshortcuts="Escape"
                  onClick={() => {
                    dispatch({ _tag: "ClearChecks" });
                  }}
                />
              }>
              <X />
            </Tooltip.Trigger>
            <Tooltip.Content>Clear selection</Tooltip.Content>
          </Tooltip.Root>
          <span aria-hidden className={styles.divider()} />
          <Button
            variant="ghost"
            size="xs"
            aria-label="Send SMS"
            onClick={() => {
              send(canSendContractSms, "Send SMS", "sent", "not awaiting customer approval");
            }}>
            <DeviceMobile data-icon="inline-start" />
            <span className={styles.label()}>Send SMS</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Send receipt"
            onClick={() => {
              send(canSendReceipt, "Send receipt", "sent", "no receipt before an order is done or cancelled");
            }}>
            <Receipt data-icon="inline-start" />
            <span className={styles.label()}>Send receipt</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            aria-label="Change seller"
            onClick={() => {
              setChanging(true);
            }}>
            <Users data-icon="inline-start" />
            <span className={styles.label()}>Change seller</span>
          </Button>
        </div>
      )}
      <ChangeSellerDialog open={changing} onOpenChange={setChanging} selection={selection} />
    </>
  );
}
