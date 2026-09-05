import type { ReactElement } from "react";

import type { Metadata } from "next";

import { DemoFrame } from "../../../../components/DemoFrame";
import { ButtonPending } from "../../../../examples/button-pending";
import { ButtonPredictiveIntent } from "../../../../examples/button-predictive-intent";
import { ButtonSizes } from "../../../../examples/button-sizes";
import { ButtonVariantMatrix } from "../../../../examples/button-variant-matrix";
import { ButtonVisuallyDisabled } from "../../../../examples/button-visually-disabled";

export const metadata: Metadata = {
  title: "Button",
};

export default function ButtonPage(): ReactElement {
  return (
    <>
      <h1>Button</h1>
      <p className="DocsLede">
        Triggers an action. Renders a native <code>button</code>; compose with links or router primitives
        through the <code>render</code> prop.
      </p>
      <DemoFrame id="variants" title="Variants">
        <ButtonVariantMatrix />
      </DemoFrame>
      <DemoFrame id="sizes" title="Sizes">
        <ButtonSizes />
      </DemoFrame>
      <DemoFrame id="pending" title="Pending">
        <ButtonPending />
      </DemoFrame>
      <DemoFrame id="visually-disabled" title="Visually disabled">
        <ButtonVisuallyDisabled />
      </DemoFrame>
      <DemoFrame id="predictive-intent" title="Predictive intent">
        <ButtonPredictiveIntent />
      </DemoFrame>
    </>
  );
}
