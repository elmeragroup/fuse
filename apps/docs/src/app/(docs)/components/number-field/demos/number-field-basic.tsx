"use client";

import { NumberField } from "@elmeragroup/ui/number-field";

export function NumberFieldBasic() {
  return <NumberField label="Quantity" description="Whole packs." minValue={0} maxValue={20} step={1} />;
}
