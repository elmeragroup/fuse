import type { ReactElement } from "react";

import { tv } from "tailwind-variants";

import { Alert } from "@elmeragroup/fuse/alert";
import { Badge } from "@elmeragroup/fuse/badge";
import { Heading } from "@elmeragroup/fuse/heading";
import { TextField } from "@elmeragroup/fuse/text-field";

import { ROLE_TILES } from "../../lib/color-roles";
import { PairTile } from "./pair-tile";

const statusBoard = tv({
  slots: {
    root: "flex flex-col gap-8 p-8",
    section: "flex flex-col gap-3",
    tiles: "grid grid-cols-4 gap-x-3 gap-y-5",
    badges: "flex flex-wrap gap-2",
    alerts: "flex flex-col gap-3",
  },
});

const styles = statusBoard();

/**
 * The status roles: error, info, success and warning with their soft forms, marked with live
 * contrast, then in the components that wear them: Badges, Alerts and a field's error. Alert
 * has no info variant, so info shows in the Badges only.
 */
export function StatusBoard(): ReactElement {
  return (
    <div className={styles.root()}>
      <section className={styles.section()} aria-label="Status pairs">
        <Heading level={2} size="lg">
          Status pairs
        </Heading>
        <div className={styles.tiles()}>
          {ROLE_TILES.status.map((tile) => (
            <PairTile key={tile.role} tile={tile} />
          ))}
        </div>
      </section>
      <section className={styles.section()} aria-label="Badges">
        <Heading level={2} size="lg">
          Badges
        </Heading>
        <div className={styles.badges()}>
          <Badge variant="destructive">Overdue</Badge>
          <Badge variant="info">New</Badge>
          <Badge variant="success">Paid</Badge>
          <Badge variant="warning">Due soon</Badge>
        </div>
        <div className={styles.badges()}>
          <Badge variant="outline-destructive">Overdue</Badge>
          <Badge variant="outline-success">Paid</Badge>
          <Badge variant="outline-warning">Due soon</Badge>
        </div>
      </section>
      <section className={styles.section()} aria-label="Alerts">
        <Heading level={2} size="lg">
          Alerts
        </Heading>
        <div className={styles.alerts()}>
          <Alert.Root variant="destructive">
            <Alert.Title>Payment failed</Alert.Title>
            <Alert.Description>Your card was declined. Try another card.</Alert.Description>
          </Alert.Root>
          <Alert.Root variant="success">
            <Alert.Title>Payment received</Alert.Title>
            <Alert.Description>Thanks. A receipt is on its way.</Alert.Description>
          </Alert.Root>
          <Alert.Root variant="warning">
            <Alert.Title>Verify your email</Alert.Title>
            <Alert.Description>The link we sent expires in 24 hours.</Alert.Description>
          </Alert.Root>
        </div>
      </section>
      <section className={styles.section()} aria-label="Field error">
        <Heading level={2} size="lg">
          Field error
        </Heading>
        <TextField
          label="Email"
          defaultValue="alex@example"
          isInvalid
          errorMessage="Enter an email address such as name@example.com."
        />
      </section>
    </div>
  );
}
