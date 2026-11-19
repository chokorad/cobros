# Deploy

GitHub Pages serves the repository root from `main`. No build step is required. For local review, run `python -m http.server 8000` from the repository root. Use an authorized local domain and separate Firebase configuration for authenticated integration tests. Existing per-user Firestore rules cover the invoices collection. Verify the service-worker cache version after deployment.
