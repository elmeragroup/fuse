---
"@elmeragroup/ui": minor
---

Ship the Toast namespace on `@base-ui/react/toast` — Provider, Viewport, Root, Content, Title, Description, Action, Close, plus `useToastManager` and `createToastManager`. The manager exposes `add`, `update`, `close` and `promise`. Where `priority` is omitted it is derived from the toast `type` (`error` → `high`, everything else → `low`): `add` always derives it, `promise` derives it for each of its loading/success/error states, and `update` derives it only when the update supplies a new `type` — an update that omits both `priority` and `type` keeps the toast's existing priority. `close` takes an id and nothing else.
