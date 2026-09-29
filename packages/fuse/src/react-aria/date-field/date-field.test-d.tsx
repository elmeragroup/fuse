import { expectTypeOf, test } from "vitest";

import type * as DateFieldApi from "@elmeragroup/fuse/react-aria/date-field";
import { DateField, DateInput } from "@elmeragroup/fuse/react-aria/date-field";

test("dateFieldVariants and RAC types are not public exports", () => {
  expectTypeOf<typeof DateFieldApi>().not.toHaveProperty("dateFieldVariants");
  // @ts-expect-error DateSegment is not a public export
  type _NoSegment = DateFieldApi.DateSegment;
  // @ts-expect-error DateValue is not re-exported from this entry
  type _NoDateValue = DateFieldApi.DateValue;
  // @ts-expect-error ValidationResult is not re-exported from this entry
  type _NoValidation = DateFieldApi.ValidationResult;
  // @ts-expect-error RAC DateFieldProps is not leaked under a bare RAC name
  type _NoAria = DateFieldApi.AriaDateFieldProps;
});

test("the elements take the public props and reject DateInput children and a size axis", () => {
  const _nodeError = <DateField label="Invoice date" errorMessage={<span>Required</span>} isInvalid />;
  const _functionError = (
    <DateField
      label="Invoice date"
      minValue={undefined}
      errorMessage={(result) => result.validationErrors.join(" ")}
    />
  );
  const _open = (
    <DateField
      label="Due"
      granularity="hour"
      hourCycle={24}
      isDisabled
      isReadOnly
      isRequired
      name="due"
      autoFocus
      aria-label="Due date"
      className={(renderProps) => (renderProps.isDisabled ? "opacity-80" : "gap-2")}
      onChange={(value) => {
        const _year: number | undefined = value?.year;
        return _year;
      }}
    />
  );
  const _input = (
    <DateInput slot="start" className={(renderProps) => (renderProps.isInvalid ? "ring" : "")} />
  );

  // @ts-expect-error DateInput always renders segments and omits children
  const _noChildren = <DateInput>{() => null}</DateInput>;
  // @ts-expect-error no size axis
  const _noSize = <DateField size="md" />;
});
