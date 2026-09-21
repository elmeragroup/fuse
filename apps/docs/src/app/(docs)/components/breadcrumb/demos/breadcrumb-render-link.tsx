"use client";

import type { ComponentProps } from "react";

import { Breadcrumb } from "@elmeragroup/fuse/breadcrumb";

function RouterLink({ href = "#", ...props }: ComponentProps<"a">) {
  return <a href={href} {...props} />;
}

export function BreadcrumbRenderLink() {
  return (
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link render={<RouterLink href="/" />}>Home</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Link render={<RouterLink href="/quick-start" />}>Quick start</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>Breadcrumb</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
  );
}
