"use client";

import type { ComponentProps } from "react";

import { Button } from "@elmeragroup/ui/button";
import { DropdownMenu } from "@elmeragroup/ui/dropdown-menu";

function Link({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  return <a href={href} {...props} />;
}

export function DropdownMenuLinks() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={<Button variant="outline" />}>Navigate</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Label>Pages</DropdownMenu.Label>
        <DropdownMenu.LinkItem href="/profile">Profile</DropdownMenu.LinkItem>
        <DropdownMenu.LinkItem render={<Link href="/settings" />}>Settings</DropdownMenu.LinkItem>
        <DropdownMenu.LinkItem render={<Link href="/billing" />}>Billing</DropdownMenu.LinkItem>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
