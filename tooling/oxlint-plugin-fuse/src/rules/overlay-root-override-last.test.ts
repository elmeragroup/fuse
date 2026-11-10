import { ruleTester } from "../rule-tester.ts";
import { overlayRootOverrideLast } from "./overlay-root-override-last.ts";

const dialog = 'import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";\n';

ruleTester.run("overlay-root-override-last", overlayRootOverrideLast, {
  valid: [
    `${dialog}import { useOverlayRootOverride } from "../../internal/overlay-exclusion";
function Root(props) { const override = useOverlayRootOverride(); return <DialogPrimitive.Root {...props} {...override} />; }`,
    `${dialog}import { useOverlayRootOverride as useClosed } from "../../internal/overlay-exclusion";
function Root(props) { const closed = useClosed(); return <DialogPrimitive.Root {...props} {...closed} />; }`,
    // A Base UI primitive that does not lock scroll from its Root.
    `import { Popover } from "@base-ui/react/popover";
function Root(props) { return <Popover.Root {...props} />; }`,
    // Another part of a scroll-locking primitive.
    `${dialog}function Popup(props) { return <DialogPrimitive.Popup {...props} />; }`,
  ],
  invalid: [
    {
      code: `${dialog}function Root(props) { return <DialogPrimitive.Root {...props} />; }`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `${dialog}import { useOverlayRootOverride } from "../../internal/overlay-exclusion";
function Root(props) { const override = useOverlayRootOverride(); return <DialogPrimitive.Root {...override} {...props} />; }`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `${dialog}import { useOverlayRootOverride } from "./elsewhere";
function Root(props) { const override = useOverlayRootOverride(); return <DialogPrimitive.Root {...props} {...override} />; }`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `import { Drawer as SheetPrimitive } from "@base-ui/react/drawer";
import { useOverlayExcluded as useClosed } from "../../internal/overlay-exclusion";
function Root(props) { const closed = useClosed(); return <SheetPrimitive.Root {...props} {...closed} />; }`,
      errors: [{ messageId: "missing" }],
    },
  ],
});
