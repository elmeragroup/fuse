"use client";

import type { ComponentProps } from "react";

import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";

function Link({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  return <a href={href} {...props} />;
}

export function DropdownMenuLinks() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>Navigate</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Group>
          <DropdownMenu.Label>Pages</DropdownMenu.Label>
          <DropdownMenu.LinkItem href="/profile">Profile</DropdownMenu.LinkItem>
          <DropdownMenu.LinkItem render={<Link href="/settings" />}>Settings</DropdownMenu.LinkItem>
          <DropdownMenu.LinkItem render={<Link href="/billing" />}>Billing</DropdownMenu.LinkItem>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
