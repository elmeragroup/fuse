import type { ReactElement } from "react";

import { Badge } from "@elmeragroup/fuse/badge";
import { Table } from "@elmeragroup/fuse/table";

import { moneyFormat } from "../brand/brand-market";
import type { MarketCurrency } from "../brand/brand-market";
import { useCopy, useVideoLocale } from "../copy/copy";
import { STATUS_BADGE } from "./customer-data";
import type { Order } from "./customer-data";

/** Props for {@link OrderRows}. */
export type OrderRowsProps = {
  /** The orders to list, in order. */
  readonly orders: readonly Order[];
  /** The currency of the app's brand market. */
  readonly currency: MarketCurrency;
};

/**
 * Orders as Fuse table rows: customer, a status badge in the video's locale and the amount in the
 * app's currency.
 *
 * @returns The table body.
 */
export function OrderRows({ orders, currency }: OrderRowsProps): ReactElement {
  const { density } = useCopy();
  const money = moneyFormat(useVideoLocale(), currency);
  return (
    <Table.Body>
      {orders.map((order) => (
        <Table.Row key={order.customer}>
          <Table.Cell>{order.customer}</Table.Cell>
          <Table.Cell>
            <Badge variant={STATUS_BADGE[order.status]} size="sm">
              {density.table[order.status]}
            </Badge>
          </Table.Cell>
          <Table.Cell className="text-right tabular-nums">{money.format(order.amount)}</Table.Cell>
        </Table.Row>
      ))}
    </Table.Body>
  );
}
