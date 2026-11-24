# Cobros

Personal Spanish-language honors tracking PWA for studies, settlements and invoice follow-up. Static HTML and ES modules use Firebase Authentication, Firestore and Gemini via Firebase AI Logic. Serve the repository root over HTTP for local UI review. Use a separate Firebase project for functional tests. GitHub Pages deploys from main. Preserve existing Firestore field names, keep changes focused and bump the service-worker cache whenever shell files change. Keep documentation in English and the UI in Spanish.

Treat invoice delivery addresses as private user data. Never put them in public URLs, client logs, or test fixtures copied from production.

Hospital invoice profiles are optional private defaults. Preserve existing invoice and study links when editing the profile.

Keep the visible Settings release number in sync with the service-worker cache.

Keep profile-only saves independent of study and invoice writes.

The public invoice preview is isolated under factura/. Keep live records and authentication data out of its public assets.

Keep the intake catalogue and format validation aligned with SAT CFDI 4.0.

Keep the optional address distinct from the required fiscal postal code.

Keep demo data separate from live records.

The local demo may store the fictional amount and folio only.

Demo payment selections are local only.

Keep public intake writes and Google profile reads constrained by Firestore rules.

Keep the visible profile opt-in next to its checkbox.

Keep sign-in status next to the Google control and preserve the manual intake path on failure.

Confirm public privacy notice details before enabling the patient URL.
