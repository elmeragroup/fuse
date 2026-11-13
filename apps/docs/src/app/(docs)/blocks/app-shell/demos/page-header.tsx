/**
 * The top of every page: its heading and description from the page list, and the page's own
 * actions at the end. It renders on the server, as every part without state can.
 */

import type { ReactElement, ReactNode } from "react";

import { Heading } from "@elmeragroup/fuse/heading";
import { Text } from "@elmeragroup/fuse/text";

import { appPage } from "./app-config";
import type { AppPageLabel } from "./app-config";

export type PageHeaderProps = {
  /** The page, by its label in the page list. */
  page: AppPageLabel;
  /** Buttons or a status at the header's end. */
  children?: ReactNode;
};

/** A page's heading, description and actions. */
export function PageHeader({ page, children }: PageHeaderProps): ReactElement {
  const { label, description } = appPage(page);
  return (
    <div className="md:px-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-4 pt-6 pb-2">
      {/* Takes focus from script only: the shell moves focus to the page's title after a client
          navigation, without a ring, since no key put it there. */}
      <div data-page-title tabIndex={-1} className="flex min-w-0 flex-col gap-1 outline-none">
        <Heading level={1} size="2xl" noMargin>
          {label}
        </Heading>
        <Text variant="muted" size="sm">
          {description}
        </Text>
      </div>
      {children === undefined ? null : <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
