# Architecture

`index.html` contains views, styles and dialogs. `app.js` handles rendering, authentication, dictation and Firestore writes. `config.js` holds client configuration. `firestore.rules` scopes reads and writes to the authorized user. `sw.js` caches the app shell, and `manifest.json` defines installation. Manage backend access and any provider credentials outside the repository.

Firestore stores user data under `users/{uid}` in `hospitales`, `contactos`, `estudios`, `cobros` and `facturas`. An invoice contains fields such as `tipo: "hospital"`, `estado: "solicitada"`, `estudioIds: ["study-a", "study-b"]`, `hospitalId`, `solicitante`, `receptor`, `folio`, status dates and a revision counter. The study's optional `facturaId` points to that invoice. One transaction creates the invoice and links every study. Status edits validate the revision before writing. Settlement records remain independent.

Invoice records can include `correoEntrega`, an optional string such as `billing@example.test`. Older records display an empty field. The existing invoice transaction saves the address with the same revision check as other invoice fields.

A hospital may store `perfilFactura: { receptor, solicitante, correoEntrega, datosFiscales: { rfc, cp, regimen, uso, concepto } }`. Hospital invoice documents store a snapshot of those editable billing fields and `montoFactura` in MXN. Profile and invoice writes occur in one transaction when selected. Amount, folio, status and study selection are specific to each invoice.

Hospital drafts may store `calculoExento` with `base`, `neto`, `retencion` in MXN and `tasa` as a percentage. It is saved only when the entered base matches the calculator.

A profile-only save updates the existing hospital document and stores the optional withholding rate, without a draft amount.

The static factura/ route contains the intake preview. portal.js holds public branding (name, specialty, optional credential, logo and background). The preview does not call Firebase or submit fields.

The intake script populates versioned local option lists and uses native input validity for RFC format feedback.

The preview has an optional direccion input. It is not persisted.

The preview uses cobros-folio-prueba for its local demo. No fiscal or contact fields are stored or transmitted.

The local demo record is now JSON with folio and integer montoCentavos. Previous plain folios remain readable.

Demo JSON optionally includes pago, a fixed payment-option identifier.

Spark intake writes validated requests directly to Firestore using Firebase Authentication. Guest sessions use anonymous authentication. Verified Google users may store six fiscal fields under their own UID. Staff cannot browse profiles through client rules.

The profile opt-in remains an unchecked native checkbox in the Google section.
