"use client";

/**
 * The user menu at the header's end: who is signed in, a link to Settings, the appearance and
 * signing out.
 */

import type { ReactElement } from "react";

import Link from "next/link";

import { Avatar } from "@elmeragroup/fuse/avatar";
import { Button } from "@elmeragroup/fuse/button";
import { DropdownMenu } from "@elmeragroup/fuse/dropdown-menu";
import { Gear, SignOut } from "@elmeragroup/fuse/icons";
import { COLOR_SCHEMES, useColorScheme } from "@elmeragroup/fuse/theme";
import type { ColorScheme } from "@elmeragroup/fuse/theme";
import { Toast } from "@elmeragroup/fuse/toast";

import { appPage } from "./app-config";
import { SIGNED_IN } from "./power-data";

const SCHEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} as const satisfies Record<ColorScheme, string>;

/** The signed-in user's avatar and menu. */
export function UserMenu(): ReactElement {
  const { colorScheme, setColorScheme } = useColorScheme();
  const toasts = Toast.useToastManager();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Account menu for ${SIGNED_IN.name}`} />}>
        <Avatar.Root className="size-7">
          <Avatar.Fallback>{SIGNED_IN.initials}</Avatar.Fallback>
        </Avatar.Root>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="w-60">
        <DropdownMenu.Group>
          <DropdownMenu.Label>
            <span className="text-sm font-medium block text-foreground">{SIGNED_IN.name}</span>
            <span className="text-xs font-normal block truncate">{SIGNED_IN.email}</span>
          </DropdownMenu.Label>
        </DropdownMenu.Group>
        <DropdownMenu.Separator />
        <DropdownMenu.LinkItem render={<Link href={appPage("Settings").href} />}>
          <Gear />
          Settings
        </DropdownMenu.LinkItem>
        <DropdownMenu.RadioGroup
          value={colorScheme}
          onValueChange={(value) => {
            const scheme = COLOR_SCHEMES.find((candidate) => candidate === value);
            if (scheme !== undefined) setColorScheme(scheme);
          }}>
          <DropdownMenu.Label>Appearance</DropdownMenu.Label>
          {COLOR_SCHEMES.map((scheme) => (
            <DropdownMenu.RadioItem key={scheme} value={scheme} closeOnClick={false}>
              {SCHEME_LABELS[scheme]}
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
        <DropdownMenu.Separator />
        <DropdownMenu.Item
          onClick={() => {
            toasts.add({
              title: "Signed out",
              description: "This preview has no sign-in, so it opens again as Ingrid.",
            });
          }}>
          <SignOut />
          Sign out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
