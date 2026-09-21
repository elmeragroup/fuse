import { expectTypeOf, test } from "vitest";

import type { Alert as RootAlert } from "@elmeragroup/fuse";
import * as AlertModule from "@elmeragroup/fuse/alert";
import { Alert } from "@elmeragroup/fuse/alert";

test("Alert ships from the alert entry and the root barrel", () => {
  expectTypeOf<typeof Alert>().toEqualTypeOf<typeof RootAlert>();
  expectTypeOf(Alert.Root).toBeFunction();
  expectTypeOf(Alert.Icon).toBeFunction();
  expectTypeOf(Alert.Title).toBeFunction();
  expectTypeOf(Alert.Description).toBeFunction();
});

test("the public namespace is four parts — never the flat ref names or a recipe", () => {
  expectTypeOf(Alert).not.toHaveProperty("AlertIcon");
  expectTypeOf(Alert).not.toHaveProperty("AlertTitle");
  expectTypeOf(Alert).not.toHaveProperty("AlertDescription");
  expectTypeOf(AlertModule).not.toHaveProperty("AlertIcon");
  expectTypeOf(AlertModule).not.toHaveProperty("AlertTitle");
  expectTypeOf(AlertModule).not.toHaveProperty("AlertDescription");
  expectTypeOf(AlertModule).not.toHaveProperty("alertVariants");
});

test("parts take the public API: required icon variant, heading level, no variant on copy", () => {
  expectTypeOf<Parameters<typeof Alert.Root>[0]["variant"]>().toEqualTypeOf<
    "default" | "destructive" | "warning" | "success" | undefined
  >();
  expectTypeOf<Parameters<typeof Alert.Icon>[0]["variant"]>().toEqualTypeOf<
    "default" | "destructive" | "warning" | "success"
  >();
  expectTypeOf<Parameters<typeof Alert.Title>[0]["level"]>().toEqualTypeOf<
    1 | 2 | 3 | 4 | 5 | 6 | undefined
  >();
  expectTypeOf<Parameters<typeof Alert.Title>[0]>().not.toHaveProperty("variant");
  expectTypeOf<Parameters<typeof Alert.Description>[0]>().not.toHaveProperty("variant");
  expectTypeOf<Parameters<typeof Alert.Root>[0]>().not.toHaveProperty("as");

  const _tree = (
    <Alert.Root variant="warning" onAction={() => undefined} actionLabel="Retry">
      <Alert.Title level={2}>Sync delayed</Alert.Title>
      <Alert.Description>Facility data is more than an hour old.</Alert.Description>
    </Alert.Root>
  );

  const _standalone = <Alert.Icon variant="success" className="size-4" />;
  const _ref = <Alert.Description ref={null}>Body</Alert.Description>;

  // @ts-expect-error Icon requires the status variant
  const _iconNeedsVariant = <Alert.Icon />;
  // @ts-expect-error Title has no variant axis
  const _titleVariant = <Alert.Title variant="warning">Title</Alert.Title>;
  // @ts-expect-error Description has no variant axis
  const _descriptionVariant = <Alert.Description variant="warning">Body</Alert.Description>;
  // @ts-expect-error level is constrained to 1-6
  const _badLevel = <Alert.Title level={7}>Title</Alert.Title>;
  // @ts-expect-error polymorphism is never an as prop
  const _noAs = <Alert.Root as="section" />;
  // @ts-expect-error onAction requires actionLabel
  const _actionNoLabel = <Alert.Root onAction={() => undefined} />;
  // @ts-expect-error actionLabel requires onAction
  const _labelNoAction = <Alert.Root actionLabel="Retry" />;
});
