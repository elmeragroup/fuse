---
"@elmeragroup/fuse": minor
---

`PhoneNumberField` takes part in `Form` under its `name`. It shows `errors[name]` when it gets no `errorMessage`, marks the number input invalid, clears the error when the number it submits changes (an edit, or a country that changes it, but not a search in the picker), and gives `onFormSubmit` that number in its `outputFormat` under `name`, where the callback used to get the display text under `${name}-display-value`. After a submit, `Form` focuses the number input for an error it marks. Native form data is unchanged: one `name` and one `${name}-display-value` entry. The country picker no longer joins the field's label, description, error or registration: the field's description and error describe the number input alone, the picker's trigger and search no longer share an id with each other or with the number input, and in server-rendered markup the label names the input before hydration.
