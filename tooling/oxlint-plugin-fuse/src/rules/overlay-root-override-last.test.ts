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
    `import * as Base from "@base-ui/react";
import { useOverlayRootOverride } from "../../internal/overlay-exclusion";
function Root(props) { const override = useOverlayRootOverride(); return <Base.Dialog.Root {...props} {...override} />; }`,
    // A root-entry export that does not lock scroll.
    `import { Popover as Dialog } from "@base-ui/react";
function Root(props) { return <Dialog.Root {...props} />; }`,
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
    // The package root entry, under its own name and an alias.
    {
      code: `import { AlertDialog } from "@base-ui/react";
function Root(props) { return <AlertDialog.Root {...props} />; }`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `import { Dialog as D } from "@base-ui/react";
function Root(props) { return <D.Root {...props} />; }`,
      errors: [{ messageId: "missing" }],
    },
    // A namespace import of the root or a subpath.
    {
      code: `import * as Base from "@base-ui/react";
function Root(props) { return <Base.Drawer.Root {...props} />; }`,
      errors: [{ messageId: "missing" }],
    },
    {
      code: `import * as DialogModule from "@base-ui/react/dialog";
function Root(props) { return <DialogModule.Dialog.Root {...props} />; }`,
      errors: [{ messageId: "missing" }],
    },
  ],
});
