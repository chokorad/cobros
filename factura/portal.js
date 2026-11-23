'use strict';

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
formulario.addEventListener('input', () => { resultado.hidden = true; });
boton.addEventListener('click', () => {
  if (!formulario.reportValidity()) return;
  resultado.textContent = 'Formulario completo. Esta prueba no envía ni guarda los datos.';
  resultado.hidden = false;
});
boton.disabled = false;
