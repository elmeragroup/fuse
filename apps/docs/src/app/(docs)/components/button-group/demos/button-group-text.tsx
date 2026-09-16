"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/ui/button";
import { ButtonGroup } from "@elmeragroup/ui/button-group";
import { MagnifyingGlass } from "@elmeragroup/ui/icons";
import { Input } from "@elmeragroup/ui/input";

export function ButtonGroupText() {
  const [amount, setAmount] = useState("120");
  const [result, setResult] = useState("");
  return (
    <div className="max-w-sm flex w-full flex-col gap-3">
      <ButtonGroup.Root aria-label="Copy URL">
        <ButtonGroup.Text>
          <MagnifyingGlass />
          https://
        </ButtonGroup.Text>
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText("https://example.com").then(
              () => setResult("Example URL copied."),
              () => setResult("Copy unavailable. Example URL: https://example.com")
            );
          }}>
          Copy
        </Button>
      </ButtonGroup.Root>
      <ButtonGroup.Root aria-label="Amount">
        <ButtonGroup.Text render={<label htmlFor="amount" />}>NOK</ButtonGroup.Text>
        <Input
          id="amount"
          aria-label="Amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => setResult(`Demo payment: NOK ${amount}. No payment was made.`)}>
          Pay
        </Button>
      </ButtonGroup.Root>
      <p role="status">{result}</p>
      {result ? (
        <Button
          variant="outline"
          onClick={() => {
            setAmount("120");
            setResult("");
          }}>
          Reset example
        </Button>
      ) : null}
    </div>
  );
}
