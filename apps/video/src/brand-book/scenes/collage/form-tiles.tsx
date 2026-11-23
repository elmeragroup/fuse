import type { ReactElement } from "react";

import { Button } from "@elmeragroup/fuse/button";
import { Calendar } from "@elmeragroup/fuse/calendar";
import { CheckboxGroup } from "@elmeragroup/fuse/checkbox";
import { CheckboxCard } from "@elmeragroup/fuse/checkbox-card";
import { Field } from "@elmeragroup/fuse/field";
import { Meter } from "@elmeragroup/fuse/meter";
import { PhoneNumberField } from "@elmeragroup/fuse/phone-number-field";
import { Radio, RadioGroup } from "@elmeragroup/fuse/radio-group";
import { Slider } from "@elmeragroup/fuse/slider";
import { Switch } from "@elmeragroup/fuse/switch";
import { TextField } from "@elmeragroup/fuse/text-field";
import { useTheme } from "@elmeragroup/fuse/theme";

import { budgetFor } from "../../../brand/brand-market";
import { useCopy, useVideoLocale } from "../../../copy/copy";
import { CALENDAR_DAY } from "../../sample-data";

/** A contact form: an email field, a phone field, a switch and its save action. */
export function FormTile(): ReactElement {
  const { form } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <TextField label={form.email} defaultValue="ingrid.lie@example.com" />
      <PhoneNumberField label={form.phone} defaultValue="+4791234567" />
      <Field.Root orientation="horizontal" className="items-center">
        <Field.Content>
          <Field.Label>{form.paper}</Field.Label>
        </Field.Content>
        <Switch checked />
      </Field.Root>
      <Button className="self-start">{form.save}</Button>
    </div>
  );
}

/** A contract choice, spot price picked, over add-on cards with the first one chosen. */
export function ChoicesTile(): ReactElement {
  const { addons, contract } = useCopy().brandBook.collage;
  return (
    <div className="flex h-full flex-col justify-center gap-5">
      <RadioGroup label={contract.label} value="spot" orientation="horizontal">
        <Radio value="fixed">{contract.fixed}</Radio>
        <Radio value="spot">{contract.spot}</Radio>
      </RadioGroup>
      <CheckboxGroup name="addons" label={addons.label} value={["alerts"]}>
        <CheckboxCard value="alerts" title={addons.alerts} description={addons.alertsDescription} />
        <CheckboxCard value="paper" title={addons.paper} description={addons.paperDescription} />
      </CheckboxGroup>
    </div>
  );
}

/** A price-alert slider over a budget meter, in its plate's market currency. */
export function BudgetTile(): ReactElement {
  const { budget } = useCopy().brandBook.collage;
  const spend = budgetFor(useTheme().brand, useVideoLocale());
  return (
    <div className="flex h-full flex-col justify-center gap-6">
      <Slider label={budget.slider} showValue value={80} formatOptions={{ style: "unit", unit: "percent" }} />
      <Meter label={budget.meter} value={spend.share * 100} valueLabel={`${spend.spent} / ${spend.limit}`} />
    </div>
  );
}

/** A month of the date picker's calendar with one day selected, in the scene's locale. */
export function CalendarTile(): ReactElement {
  return (
    <Calendar.Root value={Temporal.PlainDate.from(CALENDAR_DAY)} className="mx-auto">
      <Calendar.Header>
        <Calendar.DecrementMonth />
        <Calendar.VisibleRangeHeading />
        <Calendar.IncrementMonth />
      </Calendar.Header>
      <Calendar.Months />
    </Calendar.Root>
  );
}
