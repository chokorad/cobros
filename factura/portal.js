import { nubeActiva as firebaseActivo, enviarSolicitud, entrarConGoogle, prepararGoogle, salirDelPerfil } from './envio.js?v=21';

const privacidad = {
  responsable: 'Mario Humberto Quintero Peña',
  domicilio: 'Panama 499, Cuahutemoc sur, 21200, Mexicali Baja California',
  correo: 'mariohquintero@gmail.com'
};
const piloto = new URLSearchParams(location.search).get('piloto') === '1';
const portalPacientes = firebaseActivo && !piloto && Object.values(privacidad).every(dato => dato.trim());
const nubeActiva = firebaseActivo && (piloto || portalPacientes);

// Public branding only. Keep credentials and billing data outside this file.
const identidad = {
  nombre: 'Dr. Mario Quintero',
  especialidad: 'Radiología diagnóstica e intervencionista',
  cedula: '',
  logo: '',
  fondo: 'fondo.webp'
};

for (const campo of ['nombre', 'especialidad']) {
  document.getElementById(campo).textContent = identidad[campo];
}
if (identidad.cedula) {
  const cedula = document.getElementById('cedula');
  cedula.textContent = 'Cédula profesional ' + identidad.cedula;
  cedula.hidden = false;
}
if (identidad.logo) {
  const logo = document.getElementById('logo');
  logo.src = identidad.logo;
  logo.hidden = false;
}
if (identidad.fondo) {
  const fondo = new URL(identidad.fondo, document.baseURI);
  if (fondo.origin === location.origin) {
    document.body.style.setProperty('--imagen-fondo', 'url(' + JSON.stringify(fondo.href) + ')');
  }
}

const formulario = document.getElementById('solicitud');
const boton = document.getElementById('enviar');
const resultado = document.getElementById('resultado');

const regimenes = {
  '601': 'General de Ley Personas Morales', '603': 'Personas Morales con Fines no Lucrativos',
  '605': 'Sueldos y Salarios e Ingresos Asimilados a Salarios', '606': 'Arrendamiento',
  '607': 'Enajenación o Adquisición de Bienes', '608': 'Demás ingresos',
  '610': 'Residentes en el Extranjero sin Establecimiento Permanente en México',
  '611': 'Ingresos por Dividendos', '612': 'Actividades Empresariales y Profesionales',
  '614': 'Ingresos por intereses', '615': 'Ingresos por obtención de premios',
  '616': 'Sin obligaciones fiscales', '620': 'Sociedades Cooperativas de Producción',
  '621': 'Incorporación Fiscal', '622': 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
  '623': 'Opcional para Grupos de Sociedades', '624': 'Coordinados',
  '625': 'Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
  '626': 'Régimen Simplificado de Confianza'
};
const usos = {
  G01: 'Adquisición de mercancías', G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general', I01: 'Construcciones', I02: 'Mobiliario y equipo de oficina por inversiones',
  I03: 'Equipo de transporte', I04: 'Equipo de cómputo y accesorios', I05: 'Dados, troqueles, moldes, matrices y herramental',
  I06: 'Comunicaciones telefónicas', I07: 'Comunicaciones satelitales', I08: 'Otra maquinaria y equipo',
  D01: 'Honorarios médicos, dentales y gastos hospitalarios', D02: 'Gastos médicos por incapacidad o discapacidad',
  D03: 'Gastos funerales', D04: 'Donativos', D05: 'Intereses reales efectivamente pagados por créditos hipotecarios',
  D06: 'Aportaciones voluntarias al SAR', D07: 'Primas por seguros de gastos médicos',
  D08: 'Transportación escolar obligatoria', D09: 'Depósitos en cuentas para el ahorro y primas de pensiones',
  D10: 'Pagos por servicios educativos (colegiaturas)', S01: 'Sin efectos fiscales'
};
for (const [campo, catalogo] of [['regimen', regimenes], ['uso', usos]]) {
  for (const [clave, nombre] of Object.entries(catalogo)) {
    formulario.elements.namedItem(campo).add(new Option(clave + ' — ' + nombre, clave));
  }
}

const rfc = document.getElementById('rfc');
const errorRfc = document.getElementById('rfc-error');
function mostrarErrorRfc() {
  const invalido = !rfc.validity.valid;
  rfc.setAttribute('aria-invalid', String(invalido));
  errorRfc.hidden = !invalido;
}
rfc.addEventListener('blur', () => {
  rfc.value = rfc.value.trim().toUpperCase();
  if (rfc.value) mostrarErrorRfc();
});
rfc.addEventListener('input', () => {
  if (!errorRfc.hidden) mostrarErrorRfc();
});
rfc.addEventListener('invalid', mostrarErrorRfc);

formulario.addEventListener('submit', (event) => event.preventDefault());
let clave;
if (nubeActiva) {
  document.getElementById('aviso').textContent = piloto
    ? 'Prueba en la nube. Usa únicamente datos ficticios.'
    : 'Recibirás un folio al enviar tu solicitud.';
  boton.textContent = 'Enviar solicitud';
}
if (portalPacientes) {
  document.getElementById('privacidad-responsable').textContent = privacidad.responsable;
  document.getElementById('privacidad-domicilio').textContent = privacidad.domicilio;
  document.getElementById('privacidad-contacto').href = 'mailto:' + privacidad.correo;
  document.getElementById('privacidad').hidden = false;
}
const entrar = document.getElementById('entrar-google');
const salir = document.getElementById('salir-google');
const recordar = document.getElementById('recordar-perfil');
const estadoGoogle = document.getElementById('estado-google');
if (nubeActiva) {
  document.getElementById('perfil-google').hidden = false;
  prepararGoogle().catch(() => {});
}
entrar.onclick = async () => {
  if (boton.disabled) return;
  entrar.disabled = true;
  boton.disabled = true;
  estadoGoogle.dataset.cargando = 'true';
  estadoGoogle.textContent = 'Conectando con Google…';
  const avisoEspera = setTimeout(() => {
    estadoGoogle.textContent = 'Completa el inicio de sesión en la ventana de Google si ya se abrió.';
  }, 5000);
  try {
    const { correo, perfil } = await entrarConGoogle(() => {
      clearTimeout(avisoEspera);
      estadoGoogle.textContent = 'Buscando tus datos fiscales guardados…';
    });
    formulario.elements.namedItem('correo').value = correo || '';
    for (const campo of ['rfc', 'nombre', 'cp', 'direccion', 'regimen', 'uso']) {
      if (perfil) formulario.elements.namedItem(campo).value = perfil[campo] || '';
    }
    if (rfc.value) mostrarErrorRfc();
    entrar.hidden = true;
    salir.hidden = false;
    recordar.hidden = false;
    resultado.hidden = true;
    clave = undefined;
    estadoGoogle.textContent = perfil ? 'Tus datos fiscales se cargaron.' : 'Sesión iniciada. Puedes capturar tus datos fiscales.';
  } catch (error) {
    estadoGoogle.textContent = error?.code === 'auth/popup-blocked'
      ? 'El navegador bloqueó la ventana de Google. Permite las ventanas emergentes y vuelve a intentarlo.'
      : error?.code === 'auth/popup-closed-by-user'
        ? 'Se cerró la ventana de Google. Puedes volver a intentarlo.'
        : 'Hubo un problema al conectar con Google o cargar tus datos. Reintenta o llena el formulario.';
  } finally {
    clearTimeout(avisoEspera);
    delete estadoGoogle.dataset.cargando;
    entrar.disabled = false;
    boton.disabled = false;
  }
};
salir.onclick = async () => {
  await salirDelPerfil();
  estadoGoogle.textContent = '';
  formulario.reset();
  clave = undefined;
  resultado.hidden = true;
  errorRfc.hidden = true;
  rfc.removeAttribute('aria-invalid');
  entrar.hidden = false;
  salir.hidden = true;
  recordar.hidden = true;
};
formulario.addEventListener('input', () => {
  resultado.hidden = true;
  clave = undefined;
});
boton.addEventListener('click', async () => {
  if (!formulario.reportValidity()) return;
  boton.disabled = true;
  try {
    if (nubeActiva) {
      clave ??= crypto.randomUUID();
      const datos = Object.fromEntries(new FormData(formulario));
      datos.recordar = datos.recordar === 'on';
      for (const campo of ['nombre', 'direccion', 'correo']) datos[campo] = datos[campo].trim();
      datos.rfc = datos.rfc.trim().toUpperCase();
      datos.montoCentavos = Math.round(Number(datos.monto) * 100);
      delete datos.monto;
      const { folio } = await enviarSolicitud({ ...datos, clave });
      resultado.textContent = 'Solicitud recibida. Tu folio es ' + folio + '.';
      formulario.reset();
      clave = undefined;
      return;
    }
    const folio = 'PRUEBA-' + crypto.randomUUID().slice(0, 8).toUpperCase();
    const montoCentavos = Math.round(formulario.elements.namedItem('monto').valueAsNumber * 100);
    localStorage.setItem('cobros-folio-prueba', JSON.stringify({ folio, montoCentavos, pago: formulario.elements.namedItem('pago').value }));
    resultado.textContent = 'Folio ' + folio + '. Ábrelo en Facturas de Cobros, en este mismo navegador.';
  } catch {
    resultado.textContent = nubeActiva ? 'No se pudo confirmar el envío. Intenta de nuevo.' : 'Este navegador no pudo guardar el folio de prueba.';
  } finally {
    resultado.hidden = false;
    boton.disabled = false;
  }
});
boton.disabled = false;
