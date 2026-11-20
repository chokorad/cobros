# Architecture

`index.html` contains views, styles and dialogs. `app.js` handles rendering, authentication, dictation and Firestore writes. `config.js` holds client configuration. `firestore.rules` scopes reads and writes to the authorized user. `sw.js` caches the app shell, and `manifest.json` defines installation. Manage backend access and any provider credentials outside the repository.

Firestore stores user data under `users/{uid}` in `hospitales`, `contactos`, `estudios`, `cobros` and `facturas`. An invoice contains fields such as `tipo: "hospital"`, `estado: "solicitada"`, `estudioIds: ["study-a", "study-b"]`, `hospitalId`, `solicitante`, `receptor`, `folio`, status dates and a revision counter. The study's optional `facturaId` points to that invoice. One transaction creates the invoice and links every study. Status edits validate the revision before writing. Settlement records remain independent.
