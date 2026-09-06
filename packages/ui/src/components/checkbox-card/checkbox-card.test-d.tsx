import type { ReactNode } from "react";

import { expectTypeOf, test } from "vitest";

import type { CheckboxCard as RootCheckboxCard } from "@elmeragroup/ui";
import type { CheckboxCardProps } from "@elmeragroup/ui/checkbox-card";
import * as CheckboxCardModule from "@elmeragroup/ui/checkbox-card";
import { CheckboxCard } from "@elmeragroup/ui/checkbox-card";

test("CheckboxCard ships from the checkbox-card entry and the root barrel", () => {
  expectTypeOf<typeof CheckboxCard>().toEqualTypeOf<typeof RootCheckboxCard>();
  expectTypeOf(CheckboxCard).toBeFunction();
});

test("the entry exports only the public names", () => {
  expectTypeOf(CheckboxCardModule).toHaveProperty("CheckboxCard");
  expectTypeOf(CheckboxCardModule).not.toHaveProperty("checkboxCardStyles");
  expectTypeOf(CheckboxCardModule).not.toHaveProperty("checkboxCardVariants");
});

test("CheckboxCardProps is the labeled-composite face with render and className omitted", () => {
  expectTypeOf<CheckboxCardProps["title"]>().toEqualTypeOf<ReactNode>();
  expectTypeOf<CheckboxCardProps["description"]>().toEqualTypeOf<string>();
  expectTypeOf<CheckboxCardProps["tags"]>().toEqualTypeOf<string[] | undefined>();
  expectTypeOf<CheckboxCardProps["rightContent"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<CheckboxCardProps["children"]>().toEqualTypeOf<ReactNode | undefined>();
  expectTypeOf<CheckboxCardProps["variant"]>().toEqualTypeOf<"default" | "muted" | undefined>();
  expectTypeOf<CheckboxCardProps["isDisabled"]>().toEqualTypeOf<boolean | undefined>();
  expectTypeOf<CheckboxCardProps["value"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<CheckboxCardProps>().toHaveProperty("name");
  expectTypeOf<CheckboxCardProps>().toHaveProperty("onCheckedChange");
  expectTypeOf<CheckboxCardProps>().not.toHaveProperty("render");
  expectTypeOf<CheckboxCardProps>().not.toHaveProperty("disabled");
  expectTypeOf<CheckboxCardProps>().not.toHaveProperty("className");
  expectTypeOf<CheckboxCardProps>().not.toHaveProperty("as");
});

test("the element takes the public props and rejects render, disabled, className, and as", () => {
  const _basic = <CheckboxCard value="insurance" title="Insurance" description="Covers everything." />;
  const _full = (
    <CheckboxCard
      value="insurance"
      title={<span>Insurance</span>}
      description="Covers everything."
      tags={["Popular"]}
      rightContent={<button type="button">Details</button>}
      variant="muted"
      isDisabled
      name="addons">
      Extra terms.
    </CheckboxCard>
  );

  const _needsTitle = (
    // @ts-expect-error title is required
    <CheckboxCard description="Covers everything." value="insurance" />
  );
  const _needsDescription = (
    // @ts-expect-error description is required
    <CheckboxCard title="Insurance" value="insurance" />
  );
  const _noRender = (
    // @ts-expect-error consumer-supplied render is omitted; the indicator is fixed
    <CheckboxCard title="Insurance" description="Covers everything." value="a" render={() => <span />} />
  );
  const _nativeDisabled = (
    // @ts-expect-error primitive disabled is omitted; use isDisabled
    <CheckboxCard title="Insurance" description="Covers everything." value="a" disabled />
  );
  const _noClassName = (
    // @ts-expect-error className is omitted; styling axes are variant/isDisabled only
    <CheckboxCard title="Insurance" description="Covers everything." value="a" className="extra" />
  );
  const _noAs = (
    // @ts-expect-error polymorphism is never an as prop
    <CheckboxCard title="Insurance" description="Covers everything." value="a" as="div" />
  );
  const _badVariant = (
    // @ts-expect-error variant is default | muted only
    <CheckboxCard title="Insurance" description="Covers everything." value="a" variant="outline" />
  );
});
