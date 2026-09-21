"use client";

import { Pagination } from "@elmeragroup/fuse/pagination";

export function PaginationEllipsis() {
  return (
    <Pagination.Root>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#previous" />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#1">1</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#12">12</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#13" isActive>
            13
          </Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#14">14</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Ellipsis />
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link href="#40">40</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next href="#next" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination.Root>
  );
}
