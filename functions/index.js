const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createHash } = require('node:crypto');

initializeApp();
exports.recibirSolicitud = onCall({
  enforceAppCheck: true,
  cors: ['https://chokorad.github.io'],
  maxInstances: 3
}, async ({ data }) => {
  function campo(nombre, maximo, patron = /\S/) {
    const valor = typeof data?.[nombre] === 'string' ? data[nombre].trim() : '';
    if (valor.length > maximo || !patron.test(valor)) {
      throw new HttpsError('invalid-argument', 'Revisa el campo ' + nombre + '.');
    }
    return valor;
  }
  const clave = campo('clave', 36, /^[a-f0-9-]{36}$/);
  const solicitud = {
    rfc: campo('rfc', 13, /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/),
    nombre: campo('nombre', 160),
    cp: campo('cp', 5, /^\d{5}$/),
    direccion: campo('direccion', 240),
    regimen: campo('regimen', 3, /^(601|603|605|606|607|608|610|611|612|614|615|616|620|621|622|623|624|625|626)$/),
    uso: campo('uso', 3, /^(G0[1-3]|I0[1-8]|D0[1-9]|D10|S01)$/),
    correo: campo('correo', 254, /^[^\s@]+@[^\s@]+\.[^\s@]+$/),
    pago: campo('pago', 13, /^(debito|credito|efectivo|transferencia|cheque|otro|pendiente)$/),
    montoCentavos: data.montoCentavos
  };
  if (!Number.isSafeInteger(solicitud.montoCentavos) || solicitud.montoCentavos < 1 || solicitud.montoCentavos > 99999999999) {
    throw new HttpsError('invalid-argument', 'Revisa el monto.');
  }
  const folio = 'SOL-' + clave.toUpperCase();
  const db = getFirestore();
  const ref = db.collection('solicitudesFactura').doc(folio);
  const huella = createHash('sha256').update(JSON.stringify(solicitud)).digest('hex');
  await db.runTransaction(async tx => {
    const anterior = await tx.get(ref);
    if (anterior.exists) {
      if (anterior.get('huella') !== huella) throw new HttpsError('already-exists', 'El folio ya se utilizó.');
      return;
    }
    tx.create(ref, { ...solicitud, huella, creada: FieldValue.serverTimestamp(), facturaId: null });
  });
  return { folio };
});
