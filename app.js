import { firebaseConfig, MODELO, CORREOS_PERMITIDOS, LADA_DEFAULT } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-ai.js';

// ---------- Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const ai = getAI(app, { backend: new GoogleAIBackend() });
const modelo = getGenerativeModel(ai, { model: MODELO, generationConfig: { responseMimeType: 'application/json' } });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// ---------- Utilidades
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dinero = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fechaBonita = iso => iso ? new Date(iso + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
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
});

// ---------- Navegación
function ir(v) {
  if (!['dictar', 'panel', 'ajustes'].includes(v)) v = 'dictar';
  document.querySelectorAll('.vista').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  document.querySelectorAll('[data-ir]').forEach(b => b.classList.toggle('act', b.dataset.ir === v));
  if (location.hash.slice(1) !== v) history.replaceState(null, '', '#' + v);
}
document.querySelectorAll('[data-ir]').forEach(b => { b.onclick = () => ir(b.dataset.ir); });
$('#barra-total').onclick = () => ir('panel');
window.addEventListener('hashchange', () => ir(location.hash.slice(1)));

function render() { renderTotal(); renderPanel(); renderAjustes(); }

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
  grabadora.start();
  mic.classList.add('rec');
  setEstado('Grabando… toca para terminar');
};

$('#btn-texto').onclick = () => { const f = $('#form-texto'); f.hidden = !f.hidden; if (!f.hidden) f.texto.focus(); };
$('#btn-manual').onclick = () => abrirTarjeta({});
$('#form-texto').onsubmit = e => {
  e.preventDefault();
  const t = e.target.texto.value.trim();
  if (t) { procesar({ texto: t }); e.target.texto.value = ''; e.target.hidden = true; }
};

const aBase64 = blob => new Promise((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1]);
  r.onerror = mal;
  r.readAsDataURL(blob);
});

function construirPrompt() {
  const hs = [...hospitales.values()].filter(h => !h.archivado)
    .map(h => `${h.id} | ${h.nombre} | ${(h.alias || []).join(', ')}`).join('\n') || '(ninguno todavía)';
  const cs = [...contactos.values()].map(c => `${c.id} | ${c.nombre}`).join('\n') || '(ninguno todavía)';
  const frecuentes = [...new Set(estudios.map(e => e.estudio).filter(Boolean))].slice(0, 40).join('; ') || '(ninguno todavía)';
  return `Eres el asistente de un radiólogo en Mexicali, México. Del dictado extrae UN registro de honorarios pendientes de cobrar.
Hoy es ${hoyISO()}. Convierte fechas relativas ("hoy", "ayer", "el lunes", "el 25 de septiembre") a YYYY-MM-DD. Si no se menciona fecha, usa hoy.

Hospitales conocidos (id | nombre | otros nombres):
${hs}

Contactos conocidos para cobrar (id | nombre):
${cs}

Estudios que ya ha registrado antes: ${frecuentes}

Reglas:
- paciente: el nombre tal como se dijo (completo o parcial), con mayúsculas y acentos correctos.
- estudio: nombre claro del estudio; si se parece a uno ya registrado, usa esa misma forma.
- hospital_id: id del hospital conocido que corresponda, tolerando variaciones o errores de pronunciación. Si se menciona un hospital que no está en la lista, hospital_id = null y su nombre en hospital_nuevo.
- cobrar_a_id: SOLO si se dice explícitamente a quién cobrarle y coincide con un contacto conocido. Si se menciona a alguien que no está en la lista, cobrar_a_id = null y su nombre en cobrar_a_nuevo. Si no se dice a quién cobrar, ambos null.
- monto: número sin símbolos ("mil quinientos" → 1500).
- nota: el comentario personal para recordar al paciente, breve y fiel a lo dicho; "" si no hay.
- transcripcion: lo que se dijo, textual.

Responde SOLO con este JSON:
{"paciente":string,"estudio":string,"hospital_id":string|null,"hospital_nuevo":string|null,"cobrar_a_id":string|null,"cobrar_a_nuevo":string|null,"monto":number|null,"fecha":"YYYY-MM-DD","nota":string,"transcripcion":string}`;
}

async function procesar({ audio, texto }) {
  if (!navigator.onLine) { setEstado('Sin conexión: llénalo a mano'); abrirTarjeta({ transcripcion: texto || '' }); return; }
  setEstado('Interpretando…');
  mic.disabled = true;
  try {
    const partes = [construirPrompt()];
    if (audio) partes.push({ inlineData: { data: await aBase64(audio), mimeType: audio.type.split(';')[0] } });
    else partes.push('Dictado: ' + texto);
    const r = await modelo.generateContent(partes);
    const d = JSON.parse(r.response.text().replace(/^```(json)?|```$/g, '').trim());
    setEstado('Revisa y guarda');
    abrirTarjeta(d);
  } catch (e) {
    console.error(e);
    setEstado('No pude interpretarlo, llénalo a mano');
    abrirTarjeta({ transcripcion: texto || '' });
  } finally {
    mic.disabled = false;
  }
}

// ---------- Tarjeta de confirmación
const dlg = $('#tarjeta');
const ft = $('#form-tarjeta');
let editando = null;
let transcripcionActual = '';

function abrirTarjeta(d, existente) {
  editando = existente?.id || null;
  if (existente) {
    d = { paciente: existente.paciente, estudio: existente.estudio, hospital_id: existente.hospitalId,
      cobrar_a_id: existente.cobrarAId, monto: existente.monto, fecha: existente.fecha,
      nota: existente.nota, transcripcion: existente.transcripcion };
  }
  d = d || {};
  transcripcionActual = d.transcripcion || '';

  ft.paciente.value = d.paciente || '';
  ft.estudio.value = d.estudio || '';
  ft.monto.value = d.monto ?? '';
  ft.fecha.value = d.fecha || hoyISO();
  ft.nota.value = d.nota || '';
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
    fecha: ft.fecha.value || hoyISO(),
    nota: ft.nota.value.trim()
  };
  if (editando) actualizar('estudios', editando, datos);
  else crear('estudios', { ...datos, transcripcion: transcripcionActual, estatus: 'pendiente', cobradoFecha: null, creado: serverTimestamp() });
  dlg.close();
  setEstado('Guardado ✓  Toca para dictar otro');
};

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
  const extra = [
    fechaBonita(e.fecha),
    e.nota ? `<i>${esc(e.nota)}</i>` : '',
    propio && c ? `cobrar a ${esc(c.nombre)}` : '',
    e.estatus === 'cobrado' && e.cobradoFecha ? `cobrado ${fechaBonita(e.cobradoFecha)}` : ''
  ].filter(Boolean).join(' · ');
  return `<div class="item">
    <div class="info"><b>${esc(e.paciente || '—')}</b><span>${esc(e.estudio)}</span><small>${extra}</small></div>
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
  const lista = estudios.filter(e => e.estatus === filtro)
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
        <div class="der"><strong>${dinero(total)}</strong>${def?.telefono ? botonLlamar(def.telefono, def.nombre) : ''}</div>
      </header>
      ${arr.map(itemHTML).join('')}
    </article>`;
  }).join('') : `<p class="vacio">${filtro === 'pendiente' ? 'Nada pendiente por cobrar 🎉' : 'Aún no hay cobrados.'}</p>`;
}

$('#filtro').onchange = renderPanel;
$('#panel').onclick = e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const id = b.dataset.id;
  if (b.dataset.act === 'editar') abrirTarjeta(null, estudios.find(x => x.id === id));
  if (b.dataset.act === 'cobrado') actualizar('estudios', id, { estatus: 'cobrado', cobradoFecha: hoyISO(), cobradoEn: serverTimestamp() });
  if (b.dataset.act === 'pendiente') actualizar('estudios', id, { estatus: 'pendiente', cobradoFecha: null, cobradoEn: null });
};

// ---------- 3. Ajustes
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
