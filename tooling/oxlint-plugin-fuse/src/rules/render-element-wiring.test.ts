import { ruleTester } from "../rule-tester.ts";
import { renderElementWiring } from "./render-element-wiring.ts";

ruleTester.run("render-element-wiring", renderElementWiring, {
  valid: [
    '<P.Icon render={<span className="x" />} />',
    "<P.Input disabled={disabled} render={<Group className={c} />} />",
    "<P.Trigger render={renderTrigger} />",
  ],
  invalid: [
    {
      code: "<P.Input render={<Group disabled={false} aria-label={x} className={c} />} />",
      errors: [{ messageId: "attribute" }, { messageId: "attribute" }],
    },
    { code: "<Control render={<Textarea {...props} />} />", errors: [{ messageId: "spread" }] },
    { code: '<P.Input render={<input id="name" value={value} />} />', errors: 2 },
  ],
});
