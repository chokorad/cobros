# Cobros — honorarios pendientes por hospital

PWA para dictar un estudio ("ultrasonido renal a Juanita Pérez en el Quirúrgico del Valle, mil quinientos, ayer, la de la nariz chueca, le cobro al Dr. Ramírez"), confirmar la tarjeta y ver lo que te deben agrupado por hospital, con botón de llamar.

Todo corre en el plan gratuito (Spark) de Firebase: sin servidor, sin Cloud Functions.

## Cómo funciona

```
🎙 Grabar ──► audio (webm/mp4) ──► Gemini (Firebase AI Logic)
                                      │  prompt incluye tus hospitales,
                                      │  contactos y estudios frecuentes
                                      ▼
                              JSON con los campos
                                      ▼
                       Tarjeta editable ──► Guardar ──► Firestore
                                                          ▼
                              Panel por hospital · subtotales · 📞 · Cobrado
```

## Esquema de datos (Firestore)

Todo vive bajo `users/{uid}/`:

**hospitales**
| campo | tipo | nota |
|---|---|---|
| nombre | string | "Hospital Quirúrgico del Valle" |
| alias | string[] | cómo lo dices: "Quirúrgico", "el del Valle" (ayuda a Gemini) |
| cobradorId | string \| null | contacto que paga por defecto |
| archivado | bool | lo oculta del dictado sin perder historial |

**contactos**
| campo | tipo | nota |
|---|---|---|
| nombre | string | "Caja Quirúrgico del Valle", "Dr. Ramírez" |
| telefono | string | formato internacional `+526861234567` / `+17605550100` |

**estudios**
| campo | tipo | nota |
|---|---|---|
| paciente | string | como lo dictaste |
| estudio | string | "Ultrasonido renal" |
| hospitalId | string | dónde se hizo |
| cobrarAId | string \| null | `null` = usa el cobrador por defecto del hospital (si cambias el default, se actualiza en todos los pendientes) |
| monto | number | |
| fecha | "YYYY-MM-DD" | día del estudio |
| nota | string | "el de la nariz chueca" |
| transcripcion | string | lo que dijiste, por si hay que revisar |
| estatus | "pendiente" \| "cobrado" | |
| cobradoFecha | "YYYY-MM-DD" \| null | |

## Puesta en marcha (en la compu, ~15 min)

1. **Proyecto Firebase** — console.firebase.google.com → Crear proyecto (plan Spark, sin tarjeta).
2. **App web** — ⚙ Configuración → Tus apps → `</>` → registra "Cobros". Copia el `firebaseConfig` a `config.js`.
3. **Authentication** — Comenzar → Proveedor **Google** → Habilitar. En *Settings → Authorized domains* agrega `chokorad.github.io`.
4. **Firestore** — Crear base de datos (modo producción, región `us-west2` o la más cercana). En *Reglas*, pega `firestore.rules` con tu correo.
5. **AI Logic** — menú *AI Logic* → Get started → **Gemini Developer API**. No copies ninguna API key al código; el SDK la maneja.
6. **config.js** — pon tu correo en `CORREOS_PERMITIDOS`.
7. **GitHub** — crea el repo (p. ej. `chokorad/cobros`), sube la carpeta, *Settings → Pages → Deploy from branch → main / root*.
8. Abre `https://chokorad.github.io/cobros/` en el teléfono → Entrar con Google → menú ⋮ → *Instalar app*.
9. En **Ajustes**, da de alta tus contactos (caja de cada hospital) y tus 3 hospitales con su cobrador por defecto y alias.

### Recomendado: App Check
Sin App Check, cualquiera que copie tu `firebaseConfig` podría gastar tu cuota gratis de Gemini. En la consola: *App Check* → registra la app web con **reCAPTCHA Enterprise** → activa *Enforce* para AI Logic. Luego agrega al inicio de `app.js`:

```js
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';
initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider('TU_SITE_KEY'), isTokenAutoRefreshEnabled: true });
```

## Notas

- **Privacidad:** en el nivel gratuito de la Gemini Developer API, Google puede usar lo que envías para mejorar sus productos. Aquí van nombres de pacientes. Si eso te pesa: dicta solo iniciales/apellido + la nota, o cambia a *Vertex AI Gemini API* (requiere plan Blaze, pero el uso sería de centavos al mes).
- **Sin señal:** puedes llenar la tarjeta a mano; se guarda en el teléfono y se sube sola al volver la conexión. El dictado sí necesita internet.
- **Modelo:** se cambia en `config.js` (`MODELO`).
- **Íconos:** `icon-192.png`, `icon-512.png` (maskable), `apple-touch-icon.png` y `favicon-32.png`, generados del logo neón.
- Al actualizar archivos, sube el número en `CACHE` de `sw.js` (`cobros-v2`…) para forzar la recarga.
