# Deploy

GitHub Pages serves the repository root from `main`. No build step is required. For local review, run `python -m http.server 8000` from the repository root. Use an authorized local domain and separate Firebase configuration for authenticated integration tests. Existing per-user Firestore rules cover the invoices collection. Verify the service-worker cache version after deployment.

The invoice email field uses the existing private Firestore path and requires no migration. Public intake, private attachments and email delivery require a separate backend deployment when implemented.

Hospital profiles use the existing private hospitals path and need no rules or migration changes. The SAT link is an external navigation.

Verify that Settings and the service-worker cache both report v15.

The Settings label and service-worker cache report v16.

GitHub Pages serves factura/ separately from the private app navigation. Update the public branding configuration and assets inside factura/.

The invoice preview uses versioned CSS and script URLs to load matching assets.

Verify the public preview exposes the optional fiscal address after deployment.

GitHub Pages serves v17. The folio demo needs no database changes.

The private shell cache and version label now use v18.

The app shell now uses v19 and the portal script uses v5.

Enable Anonymous Authentication and Google Authentication, authorize the portal domain, deploy firestore:rules, and test App Check and access rules on Spark before enabling nubeActiva. This flow does not deploy Cloud Functions.

The opt-in layout uses portal.css v3.

When deploying sign-in UI changes, bump the versioned portal assets and verify the pilot URL.

Set the confirmed public controller name, address and contact email in factura/portal.js, bump the script version, and verify the normal URL before sharing it.
