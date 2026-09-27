"use client";
import { useState } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";

export function ClientIsland() {
  const [count, setCount] = useState(0);
  return (
    <section>
      <Button id="counter" onClick={() => setCount((value) => value + 1)}>
        Clicked {count}
      </Button>
      <PhoneNumberField defaultCountryCode="NO" aria-label="Phone" />
    </section>
  );
}
