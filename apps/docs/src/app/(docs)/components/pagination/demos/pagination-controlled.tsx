"use client";

import { useState } from "react";
import type { MouseEvent } from "react";

import { Pagination } from "@elmeragroup/ui/pagination";

const PAGES = [1, 2, 3, 4, 5];

export function PaginationControlled() {
  const [page, setPage] = useState(2);

  function goTo(next: number) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      setPage(Math.min(PAGES.length, Math.max(1, next)));
    };
  }

  return (
    <Pagination.Root>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous href="#previous" onClick={goTo(page - 1)} />
        </Pagination.Item>
        {PAGES.map((number) => (
          <Pagination.Item key={number}>
            <Pagination.Link href={`#page-${number}`} isActive={number === page} onClick={goTo(number)}>
              {number}
            </Pagination.Link>
          </Pagination.Item>
        ))}
        <Pagination.Item>
          <Pagination.Next href="#next" onClick={goTo(page + 1)} />
        </Pagination.Item>
      </Pagination.Content>
    </Pagination.Root>
  );
}
