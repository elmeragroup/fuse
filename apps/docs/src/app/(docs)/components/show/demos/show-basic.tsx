"use client";

import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Show } from "@elmeragroup/fuse/show";

export function ShowBasic() {
  const [visible, setVisible] = useState(true);
  return (
    <div className="flex flex-col items-start gap-3">
      <Button onClick={() => setVisible((current) => !current)}>
        {visible ? "Hide details" : "Show details"}
      </Button>
      <Show when={visible}>
        <p>These details render only while the condition is true.</p>
      </Show>
      {/* Eager evaluation: children JSX runs in the parent before Show decides.
          Guarding `data!.name` here is not safe — use a ternary or optional chaining. */}
      {visible ? <p>The same block via an inline ternary.</p> : null}
    </div>
  );
}
