import { firebaseConfig, MODELO, CORREOS_PERMITIDOS, LADA_DEFAULT, RECAPTCHA_KEY } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';

// ---------- Firebase
const app = initializeApp(firebaseConfig);
// App Check: Firebase lo exige para dejar pasar las llamadas a Gemini.
if (RECAPTCHA_KEY) {
  try { initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_KEY), isTokenAutoRefreshEnabled: true }); }
  catch (e) { console.error('App Check', e); }
}
// Sesión guardada en el teléfono hasta que cierres sesión.
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver
});
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const ai = getAI(app, { backend: new GoogleAIBackend() });
// Modelo principal + respaldos por si Google está saturado.
const MODELOS = [...new Set([MODELO, 'gemini-3.8-flash', 'gemini-3.5-flash-lite'])];
const modelos = MODELOS.map(m => getGenerativeModel(ai, { model: m, generationConfig: { responseMimeType: 'application/json' } }));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// ---------- Utilidades
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const isoLocal = d => { d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const hoyISO = () => isoLocal(new Date());
const sumarDias = (iso, n) => { const d = new Date((iso || hoyISO()) + 'T12:00'); d.setDate(d.getDate() + n); return isoLocal(d); };
// Antes de las 5 a.m. cuenta como el día clínico anterior (lo que dictas de madrugada es de la guardia de ayer).
const diaClinicoISO = () => new Date().getHours() < 5 ? sumarDias(hoyISO(), -1) : hoyISO();
const fechaBonita = iso => iso ? new Date(iso + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
// Color fijo por día de la semana (0 = domingo). Paleta validada para daltonismo sobre fondo oscuro.
const COLOR_DIA = ['#e66767', '#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];
const ABREV_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const diaSemana = iso => new Date(iso + 'T12:00').getDay();
const porNombre = (a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es');
const setEstado = t => { $('#estado').textContent = t; };

function normTel(t) {
  t = String(t || '').trim();
  if (!t) return '';
  const dig = t.replace(/\D/g, '');
  if (t.startsWith('+')) return '+' + dig;
  if (dig.length === 10) return '+' + LADA_DEFAULT + dig;
  return '+' + dig;
}

// ---------- Estado
let uid = null;
const hospitales = new Map();
const contactos = new Map();
let estudios = [];
let desuscribir = [];

const col = n => collection(db, 'users', uid, n);
// Escrituras sin await: con la caché local funcionan aunque no haya señal y se suben después.
const crear = (n, data) => { const ref = doc(col(n)); setDoc(ref, data).catch(err); return ref.id; };
const actualizar = (n, id, data) => updateDoc(doc(col(n), id), data).catch(err);
const err = e => { console.error(e); alert('Error al guardar: ' + e.message); };

const cobradorDe = e => contactos.get(e.cobrarAId || hospitales.get(e.hospitalId)?.cobradorId);

// ---------- Sesión
$('#btn-login').onclick = async () => {
  const p = new GoogleAuthProvider();
  try { await signInWithPopup(auth, p); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) await signInWithRedirect(auth, p);
    else if (e.code !== 'auth/popup-closed-by-user') alert(e.message);
  }
};
$('#btn-salir').onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  desuscribir.forEach(f => f());
  desuscribir = [];
  if (!user) { uid = null; document.body.dataset.auth = 'no'; return; }
  if (CORREOS_PERMITIDOS.length && !CORREOS_PERMITIDOS.includes(user.email)) {
    alert('Esta cuenta no está autorizada.');
    signOut(auth);
    return;
  }
  uid = user.uid;
  document.body.dataset.auth = 'si';
  desuscribir.push(
    onSnapshot(col('hospitales'), s => { hospitales.clear(); s.forEach(d => hospitales.set(d.id, { id: d.id, ...d.data() })); render(); }),
    onSnapshot(col('contactos'), s => { contactos.clear(); s.forEach(d => contactos.set(d.id, { id: d.id, ...d.data() })); render(); }),
    onSnapshot(col('estudios'), s => { estudios = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); })
  );
  ir(location.hash.slice(1) || 'dictar');
  cargarPendiente();
});

// ---------- Navegación
function ir(v) {
  if (!['dictar', 'panel', 'produccion', 'ajustes'].includes(v)) v = 'dictar';
  document.querySelectorAll('.vista').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  document.querySelectorAll('[data-ir]').forEach(b => b.classList.toggle('act', b.dataset.ir === v));
  if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
}
document.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ir(b.dataset.ir); });
$('#barra-total').onclick = () => ir('panel');
window.addEventListener('hashchange', () => ir(location.hash.slice(1)));

function render() { renderTotal(); renderPanel(); renderProduccion(); renderAjustes(); }

// ---------- 1. Dictar
let grabadora = null;
const mic = $('#mic');

mic.onclick = async () => {
  if (grabadora?.state === 'recording') { grabadora.stop(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch { setEstado('No tengo permiso para el micrófono'); return; }
  const tipo = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  grabadora = new MediaRecorder(stream, tipo ? { mimeType: tipo } : {});
  const trozos = [];
  grabadora.ondataavailable = e => { if (e.data.size) trozos.push(e.data); };
  grabadora.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    mic.classList.remove('rec');
    procesar({ audio: new Blob(trozos, { type: grabadora.mimeType || tipo || 'audio/webm' }) });
  };
  grabadora.start(250);
  mic.classList.add('rec');
  setEstado('Grabando… toca para terminar');
};

$('#btn-texto').onclick = () => { const f = $('#form-texto'); f.hidden = !f.hidden; if (!f.hidden) f.texto.focus(); };
// Si hay un dictado atorado, llenarlo a mano lo da por resuelto al guardar.
$('#btn-manual').onclick = () => { abrirTarjeta({ transcripcion: pendiente?.texto || '' }); desdePendiente = !!pendiente; };
$('#form-texto').onsubmit = e => {
  e.preventDefault();
  const t = e.target.texto.value.trim();
  if (t) { procesar({ texto: t }); e.target.texto.value = ''; e.target.hidden = true; }
};

// Gemini no acepta audio/webm (lo que graba Chrome). Convertimos a WAV mono 16 kHz.
async function aWav(blob) {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let audio;
  try { audio = await ctx.decodeAudioData(buf); } finally { ctx.close?.(); }
  const RATE = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * RATE)), RATE);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const txt = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  txt(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); txt(8, 'WAVE');
  txt(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, RATE, true); out.setUint32(28, RATE * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
  txt(36, 'data'); out.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}

const aBase64 = blob => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = mal;
  r.readAsDataURL(blob);
});

function construirPrompt(diaRef = diaClinicoISO()) {
  const hs = [...hospitales.values()].filter(h => !h.archivado)
    .map(h => `${h.id} | ${h.nombre} | ${(h.alias || []).join(', ')}`).join('\n') || '(ninguno todavía)';
  const cs = [...contactos.values()].map(c => `${c.id} | ${c.nombre}`).join('\n') || '(ninguno todavía)';
  const frecuentes = [...new Set(estudios.map(e => e.estudio).filter(Boolean))].slice(0, 40).join('; ') || '(ninguno todavía)';
  return `Eres el asistente de un radiólogo en Mexicali, México. Del dictado extrae UN registro de honorarios pendientes de cobrar.
Hoy es ${diaRef} (día clínico; si son menos de las 5 a.m. ya se cuenta como el día anterior). Convierte fechas relativas ("hoy", "ayer", "el lunes", "el 25 de septiembre") a YYYY-MM-DD tomando esa fecha como "hoy". Si no se menciona fecha, usa ${diaRef}.

Hospitales conocidos (id | nombre | otros nombres):
${hs}

Contactos conocidos para cobrar (id | nombre):
${cs}

Estudios que ya ha registrado antes: ${frecuentes}

Aseguradoras conocidas: ${aseguradorasConocidas().join(', ')}

Reglas:
- paciente: el nombre tal como se dijo (completo o parcial), con mayúsculas y acentos correctos.
- estudio: nombre claro del estudio; si se parece a uno ya registrado, usa esa misma forma.
- hospital_id: id del hospital conocido que corresponda, tolerando variaciones o errores de pronunciación. Si se menciona un hospital que no está en la lista, hospital_id = null y su nombre en hospital_nuevo.
- cobrar_a_id: SOLO si se dice explícitamente a quién cobrarle y coincide con un contacto conocido. Si se menciona a alguien que no está en la lista, cobrar_a_id = null y su nombre en cobrar_a_nuevo. Si no se dice a quién cobrar, ambos null.
- monto: número sin símbolos ("mil quinientos" → 1500).
- pago: "aseguradora" si se menciona que lo paga una aseguradora, seguro de gastos médicos o póliza; si no, "particular" (ordinario, efectivo, el paciente, el médico o el hospital pagan directo).
- aseguradora: nombre de la aseguradora si pago = "aseguradora" (usa la forma de la lista si coincide); "" si no.
- nota: el comentario personal para recordar al paciente, breve y fiel a lo dicho; "" si no hay.
- transcripcion: lo que se dijo, textual.

Responde SOLO con este JSON:
{"paciente":string,"estudio":string,"hospital_id":string|null,"hospital_nuevo":string|null,"cobrar_a_id":string|null,"cobrar_a_nuevo":string|null,"monto":number|null,"fecha":"YYYY-MM-DD","pago":"particular"|"aseguradora","aseguradora":string,"nota":string,"transcripcion":string}`;
}

// ---------- Dictado pendiente (no se pierde si Gemini falla)
const CLAVE_PEND = 'cobros-dictado-pendiente';
let pendiente = null; // { b64, texto, diaRef, ts }
function guardarPendiente(p) {
  pendiente = p;
  try { p ? localStorage.setItem(CLAVE_PEND, JSON.stringify(p)) : localStorage.removeItem(CLAVE_PEND); } catch {}
  $('#reintento').hidden = !p;
}
function cargarPendiente() {
  try { const p = JSON.parse(localStorage.getItem(CLAVE_PEND) || 'null'); if (p && (p.b64 || p.texto)) pendiente = p; } catch {}
  if (pendiente) {
    $('#reintento').hidden = false;
    const cuando = new Date(pendiente.ts).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    setEstado(`Tienes un dictado sin procesar (${cuando}). Toca Reintentar.`);
  }
}

const esperar = ms => new Promise(r => setTimeout(r, ms));
// Errores pasajeros: Google saturado, límite de uso, o se cayó la red.
const esPasajero = e => /high demand|overload|unavailable|exhausted|try again|\b(429|500|502|503|504)\b|network|failed to fetch|timeout/i
  .test(`${e?.message || ''} ${e?.code || ''} ${e?.status || ''}`);

async function procesar({ audio, texto }) {
  setEstado('Preparando…');
  mic.disabled = true;
  try {
    if (!RECAPTCHA_KEY) throw new Error('Falta RECAPTCHA_KEY en config.js (App Check)');
    let b64 = null;
    if (audio) {
      if (audio.size < 1500) throw new Error('No se grabó audio (revisa el permiso del micrófono)');
      b64 = await aBase64(await aWav(audio));
    }
    // Se guarda ANTES de mandarlo: si algo falla (o cierras la app) no tienes que volver a dictar.
    guardarPendiente({ b64, texto: texto || '', diaRef: diaClinicoISO(), ts: Date.now() });
  } catch (e) {
    mic.disabled = false;
    return mostrarError(e, texto);
  }
  await interpretarPendiente();
}

async function interpretarPendiente() {
  const p = pendiente;
  if (!p) return;
  if (!navigator.onLine) { setEstado('Sin conexión. Tu dictado quedó guardado: toca Reintentar cuando tengas señal.'); mic.disabled = false; return; }
  mic.disabled = true;
  $('#reintento').hidden = true;
  const partes = [construirPrompt(p.diaRef)];
  partes.push(p.b64 ? { inlineData: { data: p.b64, mimeType: 'audio/wav' } } : 'Dictado: ' + p.texto);

  let ultimo = null;
  try {
    for (let m = 0; m < modelos.length; m++) {
      for (let intento = 1; intento <= 3; intento++) {
        setEstado(m === 0 && intento === 1 ? 'Interpretando…'
          : `Gemini saturado, reintentando${m ? ' con otro modelo' : ''} (${intento}/3)…`);
        try {
          const r = await modelos[m].generateContent(partes);
          const d = JSON.parse(r.response.text().replace(/^```(json)?|```$/g, '').trim());
          guardarPendiente(null);
          setEstado('Revisa y guarda');
          abrirTarjeta(d);
          return;
        } catch (e) {
          ultimo = e;
          console.warn(MODELOS[m], intento, e);
          if (!esPasajero(e)) throw e;              // error real: no tiene caso reintentar
          if (intento < 3) await esperar(1500 * intento);
        }
      }
    }
    // Todos saturados: el dictado se queda guardado para reintentar.
    setEstado('Gemini sigue saturado. Tu dictado quedó guardado: toca Reintentar en un momento.');
    $('#reintento').hidden = false;
    console.error(ultimo);
  } catch (e) {
    $('#reintento').hidden = false;
    mostrarError(e, p.texto, true);
  } finally {
    mic.disabled = false;
  }
}

function mostrarError(e, texto, sinTarjeta) {
  console.error(e);
  const msg = (e && (e.message || e.code)) || String(e);
  setEstado('Error: ' + msg.slice(0, 220));
  if (sinTarjeta) return;
  abrirTarjeta({ transcripcion: texto || '' });
  $('#transcripcion').textContent = '⚠ No se pudo interpretar: ' + msg.slice(0, 300);
}

$('#btn-reintentar').onclick = () => interpretarPendiente();
$('#btn-descartar').onclick = () => { if (confirm('¿Descartar este dictado?')) { guardarPendiente(null); setEstado('Toca para dictar'); } };

// ---------- Tarjeta de confirmación
const dlg = $('#tarjeta');
const ft = $('#form-tarjeta');
let editando = null;
let transcripcionActual = '';

let desdePendiente = false;
function abrirTarjeta(d, existente) {
  desdePendiente = false;
  editando = existente?.id || null;
  if (existente) {
    d = { paciente: existente.paciente, estudio: existente.estudio, hospital_id: existente.hospitalId,
      cobrar_a_id: existente.cobrarAId, monto: existente.monto, fecha: existente.fecha,
      nota: existente.nota, transcripcion: existente.transcripcion,
      pago: existente.pago, aseguradora: existente.aseguradora };
  }
  d = d || {};
  transcripcionActual = d.transcripcion || '';

  ft.paciente.value = d.paciente || '';
  ft.estudio.value = d.estudio || '';
  ft.monto.value = d.monto ?? '';
  ft.fecha.value = d.fecha || diaClinicoISO();
  mostrarFecha();
  ft.nota.value = d.nota || '';
  ft.aseguradora.value = d.aseguradora || '';
  $('#lista-aseg').innerHTML = aseguradorasConocidas().map(n => `<option value="${esc(n)}">`).join('');
  ponerPago(d.pago === 'aseguradora' || d.aseguradora ? 'aseguradora' : 'particular');
  ft.hospitalNuevo.value = '';
  ft.cobrarNombre.value = '';
  ft.cobrarTel.value = '';

  const hs = [...hospitales.values()].filter(h => !h.archivado || h.id === d.hospital_id).sort(porNombre);
  ft.hospital.innerHTML = '<option value="">— Elige hospital —</option>'
    + hs.map(h => `<option value="${h.id}">${esc(h.nombre)}</option>`).join('')
    + '<option value="__nuevo">+ Nuevo hospital…</option>';
  if (d.hospital_id && hospitales.has(d.hospital_id)) ft.hospital.value = d.hospital_id;
  else if (d.hospital_nuevo) { ft.hospital.value = '__nuevo'; ft.hospitalNuevo.value = d.hospital_nuevo; }
  else ft.hospital.value = '';

  const cs = [...contactos.values()].sort(porNombre);
  ft.cobrar.innerHTML = '<option value="">Cobrador del hospital</option>'
    + cs.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')
    + '<option value="__nuevo">+ Nuevo contacto…</option>';
  if (d.cobrar_a_id && contactos.has(d.cobrar_a_id)) ft.cobrar.value = d.cobrar_a_id;
  else if (d.cobrar_a_nuevo) { ft.cobrar.value = '__nuevo'; ft.cobrarNombre.value = d.cobrar_a_nuevo; }
  else ft.cobrar.value = '';

  $('#transcripcion').textContent = transcripcionActual ? `“${transcripcionActual}”` : '';
  $('#tarjeta-titulo').textContent = editando ? 'Editar estudio' : 'Confirma el estudio';
  $('#btn-borrar').hidden = !editando;
  sincronizarTarjeta();
  dlg.showModal();
}

function sincronizarTarjeta() {
  $('#bloque-hosp-nuevo').hidden = ft.hospital.value !== '__nuevo';
  $('#bloque-cobrar-nuevo').hidden = ft.cobrar.value !== '__nuevo';
  const def = contactos.get(hospitales.get(ft.hospital.value)?.cobradorId);
  ft.cobrar.options[0].textContent = def ? `Cobrador del hospital (${def.nombre})` : 'Cobrador del hospital (sin definir)';
}
function mostrarFecha() {
  const v = ft.fecha.value;
  const rel = v === hoyISO() ? 'hoy' : v === sumarDias(hoyISO(), -1) ? 'ayer' : v === sumarDias(hoyISO(), -2) ? 'antier' : '';
  $('#fecha-texto').textContent = v
    ? new Date(v + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (rel ? ` (${rel})` : '')
    : '';
}
ft.fecha.addEventListener('change', mostrarFecha);
ft.fecha.addEventListener('input', mostrarFecha);
ft.addEventListener('click', e => {
  const b = e.target.closest('button[data-dia], button[data-fecha]');
  if (!b) return;
  if (b.dataset.dia) ft.fecha.value = sumarDias(ft.fecha.value, +b.dataset.dia);
  else ft.fecha.value = sumarDias(hoyISO(), { hoy: 0, ayer: -1, antier: -2 }[b.dataset.fecha]);
  mostrarFecha();
});
function ponerPago(p) {
  ft.pago.value = p;
  document.querySelectorAll('#seg-pago button').forEach(b => b.classList.toggle('on', b.dataset.pago === p));
  $('#bloque-aseg').hidden = p !== 'aseguradora';
}
$('#seg-pago').onclick = e => {
  const b = e.target.closest('button[data-pago]');
  if (!b) return;
  ponerPago(b.dataset.pago);
  if (b.dataset.pago === 'aseguradora') ft.aseguradora.focus();
};
ft.hospital.onchange = sincronizarTarjeta;
ft.cobrar.onchange = sincronizarTarjeta;
$('#btn-cancelar').onclick = () => dlg.close();
$('#btn-borrar').onclick = () => {
  if (editando && confirm('¿Borrar este estudio?')) { deleteDoc(doc(col('estudios'), editando)).catch(err); dlg.close(); }
};

ft.onsubmit = e => {
  e.preventDefault();
  let hospitalId = ft.hospital.value;
  if (!hospitalId) { alert('Elige el hospital'); return; }
  if (hospitalId === '__nuevo') {
    const nombre = ft.hospitalNuevo.value.trim();
    if (!nombre) { alert('Escribe el nombre del hospital'); return; }
    hospitalId = crear('hospitales', { nombre, alias: [], cobradorId: null, archivado: false, creado: serverTimestamp() });
  }
  let cobrarAId = ft.cobrar.value || null;
  if (cobrarAId === '__nuevo') {
    const nombre = ft.cobrarNombre.value.trim();
    if (!nombre) { alert('Escribe a quién le cobras'); return; }
    cobrarAId = crear('contactos', { nombre, telefono: normTel(ft.cobrarTel.value), creado: serverTimestamp() });
  }
  const datos = {
    paciente: ft.paciente.value.trim(),
    estudio: ft.estudio.value.trim(),
    hospitalId,
    cobrarAId,                       // null = usa el cobrador por defecto del hospital
    monto: Number(ft.monto.value) || 0,
    fecha: ft.fecha.value || diaClinicoISO(),
    nota: ft.nota.value.trim(),
    pago: ft.pago.value === 'aseguradora' ? 'aseguradora' : 'particular',
    aseguradora: ft.pago.value === 'aseguradora' ? ft.aseguradora.value.trim() : ''
  };
  if (datos.pago === 'aseguradora' && !datos.aseguradora) { alert('Escribe el nombre de la aseguradora'); return; }
  if (editando) actualizar('estudios', editando, datos);
  else crear('estudios', { ...datos, transcripcion: transcripcionActual, estatus: 'pendiente', cobradoFecha: null, creado: serverTimestamp() });
  dlg.close();
  if (desdePendiente) { guardarPendiente(null); desdePendiente = false; }
  setEstado('Guardado ✓  Toca para dictar otro');
};

// ---------- Aseguradoras
const ASEGURADORAS_BASE = ['GNP', 'AXA', 'MetLife', 'Seguros Monterrey New York Life', 'Mapfre', 'Allianz', 'BUPA', 'Plan Seguro', 'Banorte', 'Inbursa', 'Atlas', 'Zurich', 'SURA'];
function aseguradorasConocidas() {
  const usadas = estudios.map(e => (e.aseguradora || '').trim()).filter(Boolean);
  const vistas = new Map();
  for (const n of [...usadas, ...ASEGURADORAS_BASE]) {
    const k = n.toLowerCase();
    if (!vistas.has(k)) vistas.set(k, n);
  }
  return [...vistas.values()];
}
const esAseg = e => e.pago === 'aseguradora' || !!e.aseguradora;
const diasDesde = iso => iso ? Math.max(0, Math.round((new Date(hoyISO() + 'T12:00') - new Date(iso + 'T12:00')) / 864e5)) : 0;

// ---------- 2. Panel
function renderTotal() {
  const p = estudios.filter(e => e.estatus === 'pendiente');
  $('#total-monto').textContent = dinero(p.reduce((s, e) => s + (+e.monto || 0), 0));
  $('#total-n').textContent = `${p.length} pendiente${p.length === 1 ? '' : 's'} ›`;
}

const botonLlamar = (tel, nombre) => `<a class="llamar" href="tel:${esc(tel)}" title="Llamar a ${esc(nombre)}">📞</a>`;

function itemHTML(e) {
  const c = cobradorDe(e);
  const propio = !!e.cobrarAId;
  const dias = diasDesde(e.fecha);
  const limite = esAseg(e) ? 30 : 7;
  const diasTxt = e.estatus === 'pendiente'
    ? `<span class="dias${dias > limite ? ' tarde' : ''}">${dias === 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`}</span>`
    : '';
  const extra = [
    e.fecha ? `<span class="dia-tag">${ABREV_DIA[diaSemana(e.fecha)]}</span> ${fechaBonita(e.fecha)}` : '',
    diasTxt,
    e.nota ? `<i>${esc(e.nota)}</i>` : '',
    propio && c ? `cobrar a ${esc(c.nombre)}` : '',
    e.estatus === 'cobrado' && e.cobradoFecha ? `cobrado ${fechaBonita(e.cobradoFecha)}` : ''
  ].filter(Boolean).join(' · ');
  return `<div class="item"${e.fecha ? ` style="--dia:${COLOR_DIA[diaSemana(e.fecha)]}"` : ''}>
    <div class="info"><b>${esc(e.paciente || '—')}${esAseg(e) ? `<span class="chip">🛡 ${esc(e.aseguradora || 'Aseguradora')}</span>` : ''}</b><span>${esc(e.estudio)}</span><small>${extra}</small></div>
    <div class="acc">
      <strong>${dinero(e.monto)}</strong>
      ${propio && c?.telefono ? botonLlamar(c.telefono, c.nombre) : ''}
      <button class="sec" data-act="editar" data-id="${e.id}">✎</button>
      ${e.estatus === 'pendiente'
        ? `<button data-act="cobrado" data-id="${e.id}">Cobrado</button>`
        : `<button class="sec" data-act="pendiente" data-id="${e.id}">Deshacer</button>`}
    </div>
  </div>`;
}

function renderPanel() {
  const filtro = $('#filtro').value;
  const fp = $('#filtro-pago').value;
  const lista = estudios.filter(e => e.estatus === filtro)
    .filter(e => !fp || (fp === 'aseguradora') === esAseg(e))
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
  const grupos = new Map();
  for (const e of lista) {
    const k = e.hospitalId || '_';
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(e);
  }
  const orden = [...grupos].map(([k, arr]) => ({ k, arr, total: arr.reduce((s, e) => s + (+e.monto || 0), 0) }))
    .sort((a, b) => b.total - a.total);

  $('#panel').innerHTML = orden.length ? orden.map(({ k, arr, total }) => {
    const h = hospitales.get(k);
    const def = contactos.get(h?.cobradorId);
    return `<article class="grupo">
      <header>
        <div><h3>${esc(h?.nombre || 'Sin hospital')}</h3>
          <small>${arr.length} estudio${arr.length > 1 ? 's' : ''}${def ? ' · cobra ' + esc(def.nombre) : ''}</small></div>
        <div class="der"><div style="text-align:right"><strong>${dinero(total)}</strong>${(() => {
          const as = arr.filter(esAseg).reduce((s, e) => s + (+e.monto || 0), 0);
          return as && as !== total ? `<span class="sub-pago">${dinero(total - as)} part. · ${dinero(as)} aseg.</span>` : '';
        })()}</div>${def?.telefono ? botonLlamar(def.telefono, def.nombre) : ''}</div>
      </header>
      ${arr.map(itemHTML).join('')}
    </article>`;
  }).join('') : `<p class="vacio">${filtro === 'pendiente' ? 'Nada pendiente por cobrar 🎉' : 'Aún no hay cobrados.'}</p>`;
}

$('#filtro').onchange = renderPanel;
$('#filtro-pago').onchange = renderPanel;
$('#panel').onclick = e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.act === 'editar') abrirTarjeta(null, estudios.find(x => x.id === id));
  if (b.dataset.act === 'cobrado') actualizar('estudios', id, { estatus: 'cobrado', cobradoFecha: hoyISO(), cobradoEn: serverTimestamp() });
  if (b.dataset.act === 'pendiente') actualizar('estudios', id, { estatus: 'pendiente', cobradoFecha: null, cobradoEn: null });
};

// ---------- 3. Producción
const C_COBRADO = '#3987e5', C_PEND = '#d95926';
let prodModo = 'generado', prodDiaSel = null;

function diasPeriodo() {
  const p = $('#prod-periodo').value, hoy = hoyISO();
  let desde;
  if (p === 'mes') desde = hoy.slice(0, 8) + '01';
  else desde = sumarDias(hoy, -(+p - 1));
  const dias = [];
  for (let d = desde; d <= hoy; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}
const dineroCorto = n => n >= 1000 ? `$${(n / 1000).toLocaleString('es-MX', { maximumFractionDigits: n >= 10000 ? 0 : 1 })}k` : `$${Math.round(n)}`;

function renderProduccion() {
  if (!$('#v-produccion')) return;
  const dias = diasPeriodo();
  const clave = prodModo === 'generado' ? 'fecha' : 'cobradoFecha';
  const base = prodModo === 'generado' ? estudios : estudios.filter(e => e.estatus === 'cobrado');
  const porDia = new Map(dias.map(d => [d, { cobrado: 0, pendiente: 0, n: 0, aseg: 0 }]));
  for (const e of base) {
    const d = porDia.get(e[clave]);
    if (!d) continue;
    const m = +e.monto || 0;
    if (e.estatus === 'cobrado') d.cobrado += m; else d.pendiente += m;
    if (esAseg(e)) d.aseg += m;
    d.n++;
  }
  const filas = dias.map(d => ({ d, ...porDia.get(d), total: porDia.get(d).cobrado + porDia.get(d).pendiente }));
  const total = filas.reduce((s, f) => s + f.total, 0);
  const trabajados = filas.filter(f => f.n);
  const mejor = trabajados.reduce((m, f) => (!m || f.total > m.total ? f : m), null);
  const aseg = filas.reduce((s, f) => s + f.aseg, 0);
  const nEst = filas.reduce((s, f) => s + f.n, 0);

  $('#prod-kpis').innerHTML = `
    <div class="kpi"><small>${prodModo === 'generado' ? 'Generado' : 'Cobrado'}</small><b>${dinero(total)}</b><span>${nEst} estudio${nEst === 1 ? '' : 's'}</span></div>
    <div class="kpi"><small>Promedio por día trabajado</small><b>${dinero(trabajados.length ? total / trabajados.length : 0)}</b><span>${trabajados.length} día${trabajados.length === 1 ? '' : 's'} con estudios</span></div>
    <div class="kpi"><small>Mejor día</small><b>${mejor ? dinero(mejor.total) : '—'}</b><span>${mejor ? `${ABREV_DIA[diaSemana(mejor.d)]} ${fechaBonita(mejor.d)}` : 'sin datos'}</span></div>
    <div class="kpi"><small>De aseguradoras</small><b>${dinero(aseg)}</b><span>${total ? Math.round(aseg / total * 100) : 0}% del total</span></div>`;

  $('#prod-leyenda').innerHTML = prodModo === 'generado'
    ? `<span><i style="background:${C_COBRADO}"></i>Cobrado</span><span><i style="background:${C_PEND}"></i>Pendiente</span>`
    : `<span>Lo que marcaste como cobrado cada día</span>`;

  // Gráfica de barras en SVG
  const W = 360, H = 190, PL = 34, PR = 4, PT = 8, PB = 28;
  const maxV = Math.max(...filas.map(f => f.total), 1);
  const paso = maxV <= 2000 ? 500 : maxV <= 5000 ? 1000 : maxV <= 12000 ? 2500 : maxV <= 30000 ? 5000 : 10000;
  const tope = Math.ceil(maxV / paso) * paso;
  const y = v => PT + (H - PT - PB) * (1 - v / tope);
  const n = filas.length, ancho = (W - PL - PR) / n, gap = n > 20 ? 2 : 6, bw = Math.max(3, ancho - gap);
  const r = Math.min(4, bw / 2);
  // Barra con esquinas superiores redondeadas, apoyada en la base.
  const barra = (x, y0, y1, col, redonda) => {
    const h = y0 - y1; if (h <= 0) return '';
    const rr = redonda ? Math.min(r, h) : 0;
    return `<path d="M${x},${y0} V${y1 + rr} Q${x},${y1} ${x + rr},${y1} H${x + bw - rr} Q${x + bw},${y1} ${x + bw},${y1 + rr} V${y0} Z" fill="${col}"/>`;
  };
  let svg = '';
  for (let v = 0; v <= tope; v += paso) {
    svg += `<line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" stroke="#334155" stroke-width="1"${v ? ' stroke-dasharray="2 4"' : ''}/>`;
    svg += `<text class="eje" x="${PL - 6}" y="${y(v) + 3}" text-anchor="end">${dineroCorto(v)}</text>`;
  }
  const cadaCuanto = n <= 10 ? 1 : n <= 20 ? 3 : 5;
  filas.forEach((f, i) => {
    const x = PL + i * ancho + (ancho - bw) / 2;
    const sel = prodDiaSel === f.d, dim = prodDiaSel && !sel;
    const y0 = y(0), yC = y(f.cobrado), yT = y(f.total);
    let marcas = '';
    if (prodModo === 'generado') {
      marcas += barra(x, y0, yC, C_COBRADO, !f.pendiente);
      if (f.pendiente) marcas += barra(x, f.cobrado ? yC - 2 : y0, yT, C_PEND, true); // 2px de separación entre segmentos
    } else marcas += barra(x, y0, yT, C_COBRADO, true);
    const titulo = `${ABREV_DIA[diaSemana(f.d)]} ${fechaBonita(f.d)}: ${dinero(f.total)}${f.n ? ` · ${f.n} estudio${f.n > 1 ? 's' : ''}` : ''}${prodModo === 'generado' && f.total ? ` (cobrado ${dinero(f.cobrado)}, pendiente ${dinero(f.pendiente)})` : ''}`;
    svg += `<g class="barra" data-dia="${f.d}" opacity="${dim ? .35 : 1}"><title>${esc(titulo)}</title>
      <rect x="${PL + i * ancho}" y="${PT}" width="${ancho}" height="${H - PT}" fill="transparent"/>${marcas}
      <rect x="${x}" y="${H - PB + 3}" width="${bw}" height="3" rx="1.5" fill="${COLOR_DIA[diaSemana(f.d)]}"/>
      ${sel ? `<rect x="${x - 1}" y="${yT - 3}" width="${bw + 2}" height="${y0 - yT + 4}" fill="none" stroke="#e2e8f0" stroke-width="1.5" rx="3"/>` : ''}
    </g>`;
    if (i % cadaCuanto === 0 || i === n - 1)
      svg += `<text class="eje" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${n <= 10 ? ABREV_DIA[diaSemana(f.d)] + ' ' : ''}${+f.d.slice(8)}</text>`;
  });
  $('#prod-grafica').innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Producción por día">${svg}</svg>`;

  // Detalle del día seleccionado
  const det = $('#prod-dia');
  if (!prodDiaSel || !porDia.has(prodDiaSel)) { det.innerHTML = ''; return; }
  const lista = base.filter(e => e[clave] === prodDiaSel);
  const f = filas.find(x => x.d === prodDiaSel);
  det.innerHTML = `<article class="grupo">
    <header><div><h3>${new Date(prodDiaSel + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      <small>${lista.length} estudio${lista.length === 1 ? '' : 's'}${prodModo === 'generado' && f.total ? ` · cobrado ${dinero(f.cobrado)} · pendiente ${dinero(f.pendiente)}` : ''}</small></div>
      <div class="der"><strong>${dinero(f.total)}</strong></div></header>
    ${lista.length ? lista.map(e => `<div class="item" style="--dia:${COLOR_DIA[diaSemana(prodDiaSel)]}">
      <div class="info"><b>${esc(e.paciente || '—')}${esAseg(e) ? `<span class="chip">🛡 ${esc(e.aseguradora || 'Aseguradora')}</span>` : ''}</b>
        <span>${esc(e.estudio)}</span><small>${esc(hospitales.get(e.hospitalId)?.nombre || '')} · ${e.estatus === 'cobrado' ? 'cobrado' : 'pendiente'}</small></div>
      <div class="acc"><strong>${dinero(e.monto)}</strong></div></div>`).join('') : '<p class="vacio">Sin estudios ese día.</p>'}
  </article>`;
}

$('#prod-periodo').onchange = () => { prodDiaSel = null; renderProduccion(); };
$('#prod-modo').onclick = e => {
  const b = e.target.closest('button[data-modo]'); if (!b) return;
  prodModo = b.dataset.modo; prodDiaSel = null;
  document.querySelectorAll('#prod-modo button').forEach(x => x.classList.toggle('on', x === b));
  renderProduccion();
};
$('#prod-grafica').onclick = e => {
  const g = e.target.closest('g.barra'); if (!g) return;
  prodDiaSel = prodDiaSel === g.dataset.dia ? null : g.dataset.dia;
  renderProduccion();
  if (prodDiaSel) $('#prod-dia').scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ---------- 4. Ajustes
function opcionesContacto(sel) {
  return '<option value="">— sin definir —</option>'
    + [...contactos.values()].sort(porNombre)
      .map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.nombre)}</option>`).join('');
}

function renderAjustes() {
  const hs = [...hospitales.values()].sort((a, b) => (!!a.archivado - !!b.archivado) || porNombre(a, b));
  $('#lista-hosp').innerHTML = hs.map(h => `<div class="fila${h.archivado ? ' arch' : ''}">
    <div class="info"><b>${esc(h.nombre)}</b>
      <small>${h.alias?.length ? 'También: ' + esc(h.alias.join(', ')) : 'Sin otros nombres'}</small>
      <small>Paga: <select data-act="cobrador" data-id="${h.id}">${opcionesContacto(h.cobradorId)}</select></small></div>
    <div class="acc">
      <button class="sec" data-act="renombrar" data-id="${h.id}">✎</button>
      <button class="sec" data-act="alias" data-id="${h.id}">Alias</button>
      <button class="sec" data-act="archivar" data-id="${h.id}">${h.archivado ? 'Restaurar' : 'Archivar'}</button>
    </div></div>`).join('') || '<p class="vacio">Agrega tu primer hospital.</p>';

  const selNuevo = $('#nuevo-hosp-cobrador');
  const previo = selNuevo.value;
  selNuevo.innerHTML = opcionesContacto(previo);

  $('#lista-contactos').innerHTML = [...contactos.values()].sort(porNombre).map(c => `<div class="fila">
    <div class="info"><b>${esc(c.nombre)}</b><small>${esc(c.telefono || 'sin teléfono')}</small></div>
    <div class="acc">${c.telefono ? botonLlamar(c.telefono, c.nombre) : ''}
      <button class="sec" data-act="editar-contacto" data-id="${c.id}">✎</button></div>
  </div>`).join('') || '<p class="vacio">Sin contactos todavía.</p>';
}

$('#lista-hosp').onchange = e => {
  const s = e.target.closest('select[data-act="cobrador"]');
  if (s) actualizar('hospitales', s.dataset.id, { cobradorId: s.value || null });
};
$('#lista-hosp').onclick = e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const h = hospitales.get(b.dataset.id);
  if (b.dataset.act === 'renombrar') {
    const n = prompt('Nombre del hospital', h.nombre);
    if (n?.trim()) actualizar('hospitales', h.id, { nombre: n.trim() });
  }
  if (b.dataset.act === 'alias') {
    const a = prompt('Otros nombres, separados por coma', (h.alias || []).join(', '));
    if (a !== null) actualizar('hospitales', h.id, { alias: a.split(',').map(x => x.trim()).filter(Boolean) });
  }
  if (b.dataset.act === 'archivar') actualizar('hospitales', h.id, { archivado: !h.archivado });
};
$('#lista-contactos').onclick = e => {
  const b = e.target.closest('button[data-act="editar-contacto"]');
  if (!b) return;
  const c = contactos.get(b.dataset.id);
  const n = prompt('Nombre', c.nombre);
  if (n === null) return;
  const t = prompt('Teléfono', c.telefono || '');
  if (t === null) return;
  actualizar('contactos', c.id, { nombre: n.trim() || c.nombre, telefono: normTel(t) });
};

$('#form-hosp').onsubmit = e => {
  e.preventDefault();
  const f = e.target;
  crear('hospitales', {
    nombre: f.nombre.value.trim(),
    alias: f.alias.value.split(',').map(x => x.trim()).filter(Boolean),
    cobradorId: f.cobrador.value || null,
    archivado: false,
    creado: serverTimestamp()
  });
  f.reset();
};
$('#form-contacto').onsubmit = e => {
  e.preventDefault();
  const f = e.target;
  crear('contactos', { nombre: f.nombre.value.trim(), telefono: normTel(f.telefono.value), creado: serverTimestamp() });
  f.reset();
};
