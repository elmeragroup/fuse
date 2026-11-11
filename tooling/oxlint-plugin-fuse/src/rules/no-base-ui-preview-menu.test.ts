import { ruleTester } from "../rule-tester.ts";
import { noBaseUiPreviewMenu } from "./no-base-ui-preview-menu.ts";

ruleTester.run("no-base-ui-preview-menu", noBaseUiPreviewMenu, {
  valid: [
    'import { Menu as M } from "@base-ui/react/menu";\nM.Item; M.Popup;',
    'import { Menu } from "./menu";\nMenu.Input;',
    'import { Combobox } from "@base-ui/react";\nCombobox.Input;',
    'import * as Base from "@base-ui/react";\nBase.Menu.Item; Base.Combobox.Input;',
  ],
  invalid: [
    {
      code: 'import { Menu as M } from "@base-ui/react/menu";\nM.FilterProvider; M.Item; M.useFilter;',
      errors: [{ messageId: "preview" }, { messageId: "preview" }],
    },
    { code: 'import { Menu } from "@base-ui/react";\nMenu.Clear;', errors: [{ messageId: "preview" }] },
    {
      code: 'import { Menu as M } from "@base-ui/react/menu";\ntype P = M.Empty.Props;\nconst list = <M.List />;',
      errors: [{ messageId: "preview" }, { messageId: "preview" }],
    },
    // A namespace import of the root entry or the subpath, in code, JSX and types.
    {
      code: 'import * as Base from "@base-ui/react";\nBase.Menu.useFilter;\nconst list = <Base.Menu.List />;\ntype P = Base.Menu.Empty.Props;',
      errors: [{ messageId: "preview" }, { messageId: "preview" }, { messageId: "preview" }],
    },
    {
      code: 'import type { Menu } from "@base-ui/react";\ntype P = Menu.Input.Props;',
      errors: [{ messageId: "preview" }],
    },
    {
      code: 'import * as MenuModule from "@base-ui/react/menu";\nMenuModule.Menu.Input;',
      errors: [{ messageId: "preview" }],
    },
  ],
});
