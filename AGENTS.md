# Cobros

Personal Spanish-language honors tracking PWA for studies, settlements and invoice follow-up. Static HTML and ES modules use Firebase Authentication, Firestore and Gemini via Firebase AI Logic. Serve the repository root over HTTP for local UI review. Use a separate Firebase project for functional tests. GitHub Pages deploys from main. Preserve existing Firestore field names, keep changes focused and bump the service-worker cache whenever shell files change. Keep documentation in English and the UI in Spanish.

Treat invoice delivery addresses as private user data. Never put them in public URLs, client logs, or test fixtures copied from production.

Hospital invoice profiles are optional private defaults. Preserve existing invoice and study links when editing the profile.
