# Tasks

- Review the invoice-tracking change against TESTS.md using fake studies and a separate Firebase project.
- Publish through the existing GitHub Pages workflow after review and verify the installed PWA loads the new cache.

Next invoice delivery steps: add a public submission endpoint with server-side validation and a private request inbox; link requests to existing invoices in a transaction; accept private XML/PDF uploads and confirm recipient and files; queue email on confirmation with invoice UUID-based duplicate protection; record provider acceptance and bounces and allow an explicit resend. Verify end-to-end in a separate Firebase project using synthetic data.

Validate profiles against historical invoices in a test project. Implement public intake and email attachment delivery as tracked above. Evaluate SAT field-by-field autofill separately.

Verify the hospital profile and gross-up flow in an authorized Firebase test session.
