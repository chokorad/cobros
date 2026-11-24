export const nubeActiva = true;

let cliente;
async function conectar() {
  const base = 'https://www.gstatic.com/firebasejs/12.19.0/';
  const [sdk, authSdk, firestore, check, config] = await Promise.all([
    import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js'), import(base + 'firebase-app-check.js'),
    import('../config.js')
  ]);
  const app = sdk.initializeApp(config.firebaseConfig, 'solicitudes-publicas');
  if (config.RECAPTCHA_KEY) {
    check.initializeAppCheck(app, { provider: new check.ReCaptchaEnterpriseProvider(config.RECAPTCHA_KEY) });
  }
  const auth = authSdk.initializeAuth(app, {
    persistence: authSdk.browserSessionPersistence,
    popupRedirectResolver: authSdk.browserPopupRedirectResolver
  });
  await auth.authStateReady();
  return { auth, authSdk, firestore, db: firestore.getFirestore(app) };
}
function obtenerCliente() {
  cliente ??= conectar().catch((error) => {
    cliente = undefined;
    throw error;
  });
  return cliente;
}

export function prepararGoogle() {
  return obtenerCliente();
}

export async function entrarConGoogle(alCargarPerfil) {
  const { auth, authSdk, firestore, db } = await obtenerCliente();
  const { user } = await authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider());
  alCargarPerfil();
  const perfil = await firestore.getDocFromServer(firestore.doc(db, 'perfilesFiscales', user.uid));
  return { correo: user.email, perfil: perfil.data() };
}

export async function salirDelPerfil() {
  const { auth, authSdk } = await obtenerCliente();
  await authSdk.signOut(auth);
}

export async function enviarSolicitud({ clave, recordar, ...datos }) {
  const { auth, authSdk, firestore, db } = await obtenerCliente();
  const user = auth.currentUser || (await authSdk.signInAnonymously(auth)).user;
  const folio = 'SOL-' + clave.toUpperCase();
  const { doc, writeBatch, serverTimestamp } = firestore;
  const lote = writeBatch(db);
  lote.set(doc(db, 'solicitudesFactura', folio), {
    ...datos, remitente: user.uid, creada: serverTimestamp(), facturaId: null
  });
  if (recordar && !user.isAnonymous) {
    const { rfc, nombre, cp, direccion, regimen, uso } = datos;
    lote.set(doc(db, 'perfilesFiscales', user.uid), { rfc, nombre, cp, direccion, regimen, uso });
  }
  await lote.commit();
  return { folio };
}
