---
"@elmeragroup/fuse": minor
---

New `Form` (`@elmeragroup/fuse/form`), a wrapper over Base UI's `Form`, so validation errors such as a server's response to a submit reach the fields inside it without importing `@base-ui/react` directly. `errors` maps control names to one message or several; `Field.Error` without children and `TextField` without `errorMessage` show them, editing a field clears its error, and after a submit the first field the errors mark gets focus. `onFormSubmit` receives the field values typed by `Form`'s type parameter. The interim react-aria fields read React Aria's own form context and do not see `errors`.
