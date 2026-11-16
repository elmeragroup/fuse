"use client";

import { Pagination } from "@elmeragroup/fuse/pagination";

export function PaginationCustomText() {
  return (
    <Pagination.Root>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#previous" text="Newer" label="Newer invoices" />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#1" isActive>
            1
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#2">2</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#3">3</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next href="#next" text="Older" label="Older invoices" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination.Root>
  );
}
