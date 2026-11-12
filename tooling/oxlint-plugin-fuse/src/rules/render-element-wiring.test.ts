import { ruleTester } from "../rule-tester.ts";
import { renderElementWiring } from "./render-element-wiring.ts";

ruleTester.run("render-element-wiring", renderElementWiring, {
  valid: [
    '<P.Icon render={<span className="x" />} />',
    "<P.Input disabled={disabled} render={<Group className={c} />} />",
    "<P.Trigger render={renderTrigger} />",
    // The render element repeats the part's own name.
    '<P.Close aria-label={name} render={<Button size="icon-sm" aria-label={name} />} {...props} />',
    "<P.Close aria-label={strings.close} render={<Button aria-label={strings.close} />} />",
    // A fallback render element is held to the same contract, and may repeat the name too.
    '<P.Trigger render={render ?? <Button variant="ghost" />} />',
    "<P.Remove aria-label={label} render={render ?? <Button aria-label={label} />} />",
    // A later spread without an object literal is the consumer's override, not a different name.
    "<P.Close aria-label={label} render={<Button aria-label={label} />} {...definedProps(props)} />",
  ],
  invalid: [
    {
      code: "<P.Input render={<Group disabled={false} aria-label={x} className={c} />} />",
      errors: [{ messageId: "attribute" }, { messageId: "attribute" }],
    },
    { code: "<Control render={<Textarea {...props} />} />", errors: [{ messageId: "spread" }] },
    { code: '<P.Input render={<input id="name" value={value} />} />', errors: 2 },
    // A different name than the part's, or a name only the render element carries.
    { code: "<P.Close aria-label={label} render={<Button aria-label={other} />} />", errors: 1 },
    { code: "<P.Trigger render={<Button aria-label={label} />} {...props} />", errors: 1 },
    { code: '<P.Close aria-label="Close" render={<Button aria-label="Close" />} />', errors: 1 },
    // Only the part's effective name counts: a name a spread object may hold is not it.
    {
      code: `<P.Close {...(custom ? { "aria-label": customLabel } : { "aria-label": defaultLabel })}
        render={<Button aria-label={customLabel} />} />`,
      errors: 1,
    },
    {
      code: '<P.Close aria-label={label} {...{ "aria-label": other }} render={<Button aria-label={label} />} />',
      errors: 1,
    },
    {
      code: '<P.Close {...{ "aria-label": label }} render={<Button aria-label={label} />} />',
      errors: 1,
    },
    // Every element a `??`, `||`, `&&` or ternary render expression yields is inspected.
    { code: "<P.Input render={render ?? <Group disabled={false} />} />", errors: 1 },
    { code: "<P.Input render={render || <Group {...props} />} />", errors: [{ messageId: "spread" }] },
    { code: "<P.Input render={wrap && <Group id={id} />} />", errors: 1 },
    {
      code: "<P.Input render={a ? <Group value={v} /> : (b ? <Group /> : <Group readOnly />)} />",
      errors: 2,
    },
  ],
});
