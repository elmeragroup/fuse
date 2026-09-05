"use client";

import { Button } from "@elmeragroup/ui/button";
import { ButtonGroup } from "@elmeragroup/ui/button-group";
import { MagnifyingGlass } from "@elmeragroup/ui/icons";

export function ButtonGroupText() {
  return (
    <div className="flex flex-col gap-3">
      <ButtonGroup.Root aria-label="Copy URL">
        <ButtonGroup.Text>
          <MagnifyingGlass />
          https://
        </ButtonGroup.Text>
        <Button variant="outline">Copy</Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root aria-label="Amount">
        <ButtonGroup.Text render={<label htmlFor="amount" />}>NOK</ButtonGroup.Text>
        <input id="amount" aria-label="Amount" defaultValue="120" />
        <Button variant="outline">Pay</Button>
      </ButtonGroup.Root>
    </div>
  );
}
