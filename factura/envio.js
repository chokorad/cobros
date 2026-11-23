export const nubeActiva = false;

let cliente;
async function prepararCliente() {
  const version = 'https://www.gstatic.com/firebasejs/12.19.0/';
  const [{ initializeApp }, { initializeAppCheck, ReCaptchaEnterpriseProvider }, { getFunctions, httpsCallable }, config] =
    await Promise.all([
      import(version + 'firebase-app.js'),
      import(version + 'firebase-app-check.js'),
      import(version + 'firebase-functions.js'),
      import('../config.js')
    ]);
  const app = initializeApp(config.firebaseConfig);
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(config.RECAPTCHA_KEY) });
  return httpsCallable(getFunctions(app), 'recibirSolicitud');
}

export async function enviarSolicitud(datos) {
  cliente ??= prepararCliente().catch(error => { cliente = undefined; throw error; });
  const respuesta = await (await cliente)(datos);
  return respuesta.data;
}
