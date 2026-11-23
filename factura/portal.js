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

formulario.addEventListener('submit', (event) => event.preventDefault());
formulario.addEventListener('input', () => { resultado.hidden = true; });
boton.addEventListener('click', () => {
  if (!formulario.reportValidity()) return;
  resultado.textContent = 'Formulario completo. Esta prueba no envía ni guarda los datos.';
  resultado.hidden = false;
});
boton.disabled = false;
