"use client";

import { Kbd, KbdGroup } from "@elmeragroup/fuse/kbd";

export function KbdCombination() {
  return (
    <dl className="text-sm grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-3">
      <dt>Open the command palette</dt>
      <dd>
        <KbdGroup>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </dd>
      <dt>Open the command palette on a Mac</dt>
      <dd>
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </dd>
      <dt>Add a line break in a note</dt>
      <dd>
        <KbdGroup>
          <Kbd>Shift</Kbd>
          <Kbd>Enter</Kbd>
        </KbdGroup>
      </dd>
    </dl>
  );
}
