---
"@elmeragroup/ui": minor
---

Ship the Toast namespace on `@base-ui/react/toast` — Provider, Viewport, Root, Content, Title, Description, Action, Close, plus `useToastManager` and `createToastManager`. The manager exposes `add`, `update`, `close` and `promise`, and every one of them derives `priority` from the toast `type` when it is omitted (`error` → `high`, everything else → `low`); `promise()` applies that default to each of its loading/success/error states.
