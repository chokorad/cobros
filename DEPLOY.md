# Deploy

GitHub Pages serves the repository root from `main`. No build step is required. For local review, run `python -m http.server 8000` from the repository root. Use an authorized local domain and separate Firebase configuration for authenticated integration tests. Existing per-user Firestore rules cover the invoices collection. Verify the service-worker cache version after deployment.

The invoice email field uses the existing private Firestore path and requires no migration. Public intake, private attachments and email delivery require a separate backend deployment when implemented.

Hospital profiles use the existing private hospitals path and need no rules or migration changes. The SAT link is an external navigation.

Verify that Settings and the service-worker cache both report v15.

The Settings label and service-worker cache report v16.

GitHub Pages serves factura/ separately from the private app navigation. Update the public branding configuration and assets inside factura/.

The invoice preview uses versioned CSS and script URLs to load matching assets.

Verify the public preview exposes the optional fiscal address after deployment.
