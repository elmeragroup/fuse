"use client";

import { useState } from "react";
import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Button } from "@elmeragroup/fuse/button";
import { Dialog } from "@elmeragroup/fuse/dialog";
import { TextField } from "@elmeragroup/fuse/text-field";

import { SingleToggle } from "../product-parts";
import { useFunnel } from "./funnel-context";
import type { Product } from "./funnel-orders";
import { nextOrderId } from "./funnel-state";

const newOrderDialog = tv({
  slots: {
    form: "flex flex-col gap-4",
    pair: "sm:grid-cols-2 grid grid-cols-1 gap-4",
    products: "flex flex-col gap-2",
    productsLabel: "text-sm font-medium m-0 text-foreground",
  },
});

const styles = newOrderDialog();

const PRODUCTS = ["Spotpris", "Fastpris 12 mnd", "StrømSmart+"] as const satisfies readonly Product[];
const PRODUCT_LABELS = {
  Spotpris: "Spotpris",
  "Fastpris 12 mnd": "Fastpris",
  "StrømSmart+": "StrømSmart+",
} as const satisfies Record<Product, string>;

const METER_POINT = /^7070\d{14}$/u;
const SSN = /^\d{11}$/u;

/** FormData values for these text controls are strings; `File` is possible in the type only. */
function field(data: FormData, name: string): string {
  const value = data.get(name);
  return value instanceof File ? "" : (value ?? "").trim();
}

export type NewOrderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Starts a draft the way a seller does: the customer, the facility's meter point and a product.
 * Elhub fills in the price area and grid owner once the order is sent.
 */
export function NewOrderDialog({ open, onOpenChange }: NewOrderDialogProps): ReactElement {
  const { state, dispatch, now, notify } = useFunnel();
  const [product, setProduct] = useState<Product>("Spotpris");
  const [errors, setErrors] = useState<{ meter: boolean; ssn: boolean }>({ meter: false, ssn: false });

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setErrors({ meter: false, ssn: false });
        onOpenChange(next);
      }}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>New order</Dialog.Title>
          <Dialog.Description>{`Saved as draft ${String(nextOrderId(state.orders))} until you send it.`}</Dialog.Description>
        </Dialog.Header>
        <form
          className={styles.form()}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const draft = {
              customer: field(data, "customer"),
              ssn: field(data, "ssn").replaceAll(/\s/gu, ""),
              address: field(data, "address"),
              meterPointId: field(data, "meter").replaceAll(/\s/gu, ""),
              product,
            };
            const invalid = { meter: !METER_POINT.test(draft.meterPointId), ssn: !SSN.test(draft.ssn) };
            setErrors(invalid);
            if (invalid.meter || invalid.ssn) {
              return;
            }
            dispatch({ _tag: "CreateDraft", draft, at: now() });
            onOpenChange(false);
            notify({
              type: "success",
              title: "Draft saved",
              description: `${draft.product} for ${draft.customer}`,
            });
          }}>
          <TextField name="customer" label="Customer" autoComplete="off" isRequired />
          <div className={styles.pair()}>
            <TextField
              name="ssn"
              label="SSN"
              description="11 digits"
              filter="numeric"
              autoComplete="off"
              isRequired
              isInvalid={errors.ssn}
              errorMessage={errors.ssn ? "Enter all 11 digits." : null}
            />
            <TextField
              name="meter"
              label="Meter point ID"
              description="18 digits from 7070"
              filter="numeric"
              autoComplete="off"
              isRequired
              isInvalid={errors.meter}
              errorMessage={
                errors.meter ? "A Norwegian meter point ID has 18 digits and starts with 7070." : null
              }
            />
          </div>
          <TextField name="address" label="Facility address" autoComplete="off" isRequired />
          <div className={styles.products()}>
            <p className={styles.productsLabel()}>Product</p>
            <SingleToggle
              label="Product"
              options={PRODUCTS}
              labels={PRODUCT_LABELS}
              value={product}
              onValueChange={setProduct}
            />
          </div>
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="outline" />}>Cancel</Dialog.Close>
            <Button type="submit">Save draft</Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  );
}
