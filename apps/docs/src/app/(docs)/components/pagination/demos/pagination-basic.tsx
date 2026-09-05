"use client";

import { Pagination } from "@elmeragroup/ui/pagination";

export function PaginationBasic() {
  return (
    <Pagination.Root>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#previous" />
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
          <Pagination.Next href="#next" />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination.Root>
  );
}
