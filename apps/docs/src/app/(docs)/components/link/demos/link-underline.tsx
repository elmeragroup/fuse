"use client";

import { Card } from "@elmeragroup/fuse/card";
import { Link } from "@elmeragroup/fuse/link";
import { Text } from "@elmeragroup/fuse/text";

export function LinkUnderline() {
  return (
    <div className="max-w-md flex flex-col gap-6">
      <Text>
        Questions about your invoice? <Link href="#help-invoices">Read the invoice help articles</Link>.
      </Text>
      <nav aria-label="Legal">
        <ul className="text-sm flex flex-wrap gap-x-4 gap-y-1">
          <li>
            <Link href="#privacy" underline="hover" variant="muted">
              Privacy
            </Link>
          </li>
          <li>
            <Link href="#cookies" underline="hover" variant="muted">
              Cookies
            </Link>
          </li>
          <li>
            <Link href="#accessibility-statement" underline="hover" variant="muted">
              Accessibility statement
            </Link>
          </li>
        </ul>
      </nav>
      <Card.Root>
        <Card.Header>
          <Card.Title>
            <Link href="#invoice-1042" underline="none">
              Invoice 1042
            </Link>
          </Card.Title>
          <Card.Description>Due 14 March</Card.Description>
        </Card.Header>
      </Card.Root>
    </div>
  );
}
