# Verification

1. Register an invoice on an existing pending study, using different requester and recipient names. Verify the badge changes to requested, issued and sent and survives reload.
2. Record a three-study hospital payment, open its invoice dialog and confirm that its three eligible studies are selected. Exclude one and save. Verify one invoice appears and only the included studies share its status.
3. Open the same hospital from another payment and confirm other unlinked paid studies can be selected. Already linked studies must be excluded. Try submitting overlapping selections from two sessions and verify only one invoice is created.
4. Undo a payment and check that the invoice is still visible from the now-pending study. Check that a linked study cannot be deleted or assigned to another hospital through the edit card.
5. Verify dictation, manual entry, production and payment history. Check the dialog and badges on a narrow screen. Verify an offline invoice write reports a failure and can be retried once online.

In a test Firebase project, create and reopen an individual and a hospital invoice with `billing@example.test`, edit or clear the email, verify malformed email is blocked by form validation, and open and save a legacy invoice with a blank address.

In a separate test project, save a hospital draft for two studies with an overridden invoice amount and profile enabled. Open a new draft for the same hospital and verify that billing fields load while the amount, folio and study selection start fresh. Edit the profile using an existing invoice and verify a draft for another hospital remains independent. Repeat with the profile checkbox off and test the SAT link and draft clipboard.

Verify the Facturas tab and deep link. For a 5500 target, check 6111.11 at 10% and 5569.62 at 1.25%. Change the draft amount and verify the calculated withholding is cleared.

Save only the profile, close and reopen a new draft. Verify the billing data and rate return, both amount fields are blank, and no invoice or study link was created.

On a phone and desktop, open factura/, confirm the panel is readable over the background, try an incomplete form, and submit valid fictional inputs. Verify no request is transmitted and the credential row is hidden when empty.
