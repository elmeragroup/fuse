import { ruleTester } from "../rule-tester.ts";
import { definedPropsWiring } from "./defined-props-wiring.ts";

const slider = 'import { Slider as S } from "@base-ui/react/slider";\n';
const input = 'import { Input as InputPrimitive } from "@base-ui/react/input";\n';

ruleTester.run("defined-props-wiring", definedPropsWiring, {
  valid: [
    `${slider}const root = <S.Root {...definedProps(props)} />;`,
    `${slider}const root = <S.Root {...mergeProps({ onClick }, definedProps(props))} />;`,
    // Not a wiring part of the slider.
    `${slider}const track = <S.Track {...props} />;`,
    `${input}const field = <InputPrimitive {...definedProps(props)} />;`,
    `import * as Base from "@base-ui/react";\nconst track = <Base.Slider.Track {...props} />;`,
    // A local component that happens to share a Base UI name.
    'import { Input } from "../input/input";\nconst field = <Input {...props} />;',
  ],
  invalid: [
    { code: `${slider}const root = <S.Root {...props} />;`, errors: [{ messageId: "raw" }] },
    {
      code: `${slider}const root = <S.Root {...mergeProps({ onClick }, props)} />;`,
      errors: [{ messageId: "raw" }],
    },
    { code: `${input}const field = <InputPrimitive {...props} />;`, errors: [{ messageId: "raw" }] },
    {
      code: 'import { Combobox as C } from "@base-ui/react";\nconst field = <C.Input {...rest} />;',
      errors: [{ messageId: "raw" }],
    },
    // A namespace import of the root entry or a subpath, a part and a self-rendered export.
    {
      code: 'import * as Base from "@base-ui/react";\nconst label = <Base.Field.Label {...props} />;\nconst button = <Base.Button {...props} />;',
      errors: [{ messageId: "raw" }, { messageId: "raw" }],
    },
    {
      code: 'import * as SliderModule from "@base-ui/react/slider";\nconst root = <SliderModule.Slider.Root {...props} />;',
      errors: [{ messageId: "raw" }],
    },
  ],
});
