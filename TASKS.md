# Tasks

- Review the invoice-tracking change against TESTS.md using fake studies and a separate Firebase project.
- Publish through the existing GitHub Pages workflow after review and verify the installed PWA loads the new cache.

Next invoice delivery steps: add a public submission endpoint with server-side validation and a private request inbox; link requests to existing invoices in a transaction; accept private XML/PDF uploads and confirm recipient and files; queue email on confirmation with invoice UUID-based duplicate protection; record provider acceptance and bounces and allow an explicit resend. Verify end-to-end in a separate Firebase project using synthetic data.

Validate profiles against historical invoices in a test project. Implement public intake and email attachment delivery as tracked above. Evaluate SAT field-by-field autofill separately.

Verify the hospital profile and gross-up flow in an authorized Firebase test session.

Verify profile-only save and reopen in the authenticated app.

Connect the patient intake to a private queue and add authorized branding edits before sharing the live request link or generating a patient QR.

Before enabling real intake, validate regime and usage compatibility server-side against the official catalogues.

Decide whether the optional address needs to be stored when wiring the private queue.

Deploy an authenticated private intake queue before enabling live submissions; test cross-device delivery and study linking with synthetic data.

Carry the requested amount into the private intake queue when live submission is enabled.

Carry the reported payment option into the private queue for verification.

Verify App Check and rules in a Firebase test project before enabling the intake switch.

Verify profile recall on a separate device before enabling general intake.
