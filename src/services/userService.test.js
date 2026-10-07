import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  normalizarRol,
  puede,
  tienePermiso,
  puedeConfiguracion,
  getRutaInicial,
  getCarpetaNube,
  getAreaPredeterminada
} from './accessControl.js';

function perfil(role, extra = {}) {
  return { role, activo: true, ...extra };
}

test('solo existen los 5 roles funcionales definidos', () => {
  assert.deepEqual(Object.keys(ROLES), [
    'gerencia',
    'administrador',
    'soporte_ti',
    'responsable_marketing',
    'jefe_proyecto_mina'
  ]);
});

test('Gerencia tiene acceso completo a los módulos', () => {
  const user = perfil('gerencia');

  for (const modulo of [
    'dashboard', 'clientes', 'equipos', 'mangas', 'servicios',
    'cotizaciones', 'solicitudes', 'calibraciones', 'mensajeria',
    'proveedores', 'compras', 'facturacion', 'nube', 'perfil', 'configuracion'
  ]) {
    assert.equal(tienePermiso(user, modulo), true, `Gerencia debe poder leer ${modulo}`);
  }

  assert.equal(puede(user, 'clientes', 'delete'), true);
  assert.equal(puede(user, 'servicios', 'delete'), true);
  assert.equal(puedeConfiguracion(user, 'usuarios'), true);
  assert.equal(puedeConfiguracion(user, 'logs'), true);
});

test('Administrador ve todos los módulos pero Configuración solo Correlativos y Plantillas', () => {
  const user = perfil('administrador');

  assert.equal(tienePermiso(user, 'clientes'), true);
  assert.equal(tienePermiso(user, 'facturacion'), true);
  assert.equal(tienePermiso(user, 'calibraciones'), true);
  assert.equal(tienePermiso(user, 'configuracion'), true);
  assert.equal(puedeConfiguracion(user, 'correlativo'), true);
  assert.equal(puedeConfiguracion(user, 'plantillas'), true);

  for (const seccion of ['empresa', 'pagos', 'usuarios', 'logs']) {
    assert.equal(puedeConfiguracion(user, seccion), false, `Administrador no debe acceder a Configuración/${seccion}`);
  }
});

test('Soporte TI solo recibe Configuración, Perfil, Nube y Mensajería', () => {
  const user = perfil('soporte_ti');

  for (const modulo of ['configuracion', 'perfil', 'nube', 'mensajeria']) {
    assert.equal(tienePermiso(user, modulo), true);
  }

  for (const modulo of [
    'dashboard', 'clientes', 'equipos', 'mangas', 'cotizaciones',
    'solicitudes', 'calibraciones', 'proveedores', 'compras', 'facturacion'
  ]) {
    assert.equal(tienePermiso(user, modulo), false);
  }

  assert.equal(puedeConfiguracion(user, 'usuarios'), true);
  assert.equal(puedeConfiguracion(user, 'logs'), true);
  assert.equal(getRutaInicial(user), '/configuracion');
  assert.equal(getCarpetaNube(user), 'NOOVA SAC/10. SISTEMAS');
});

test('Marketing tiene lectura en Dashboard, Clientes y Perfil', () => {
  const user = perfil('responsable_marketing');

  assert.equal(puede(user, 'dashboard', 'read'), true);
  assert.equal(puede(user, 'clientes', 'read'), true);
  assert.equal(puede(user, 'clientes', 'create'), false);
  assert.equal(puede(user, 'clientes', 'update'), false);
  assert.equal(puede(user, 'clientes', 'delete'), false);
  assert.equal(puede(user, 'perfil', 'read'), true);
  assert.equal(puede(user, 'perfil', 'update'), false);
  assert.equal(puede(user, 'mensajeria', 'create'), true);
  assert.equal(puede(user, 'mensajeria', 'update'), true);
  assert.equal(puede(user, 'mensajeria', 'delete'), true);
  assert.equal(getCarpetaNube(user), 'NOOVA SAC/04. MARKETING');
  assert.equal(getRutaInicial(user), '/dashboard');
});

test('Jefe de Proyecto de Mina ve solo Solicitud de cotización, Nube y Perfil', () => {
  const user = perfil('jefe_proyecto_mina');

  assert.equal(tienePermiso(user, 'nube'), true);
  assert.equal(tienePermiso(user, 'perfil'), true);
  assert.equal(tienePermiso(user, 'solicitudes'), true);
  assert.equal(puede(user, 'solicitudes', 'create'), true);
  assert.equal(puede(user, 'solicitudes', 'update'), true);
  assert.equal(puede(user, 'solicitudes', 'delete'), false);

  for (const modulo of [
    'dashboard', 'clientes', 'cotizaciones', 'calibraciones', 'equipos',
    'mangas', 'servicios', 'mensajeria', 'proveedores', 'compras',
    'facturacion', 'configuracion'
  ]) {
    assert.equal(tienePermiso(user, modulo), false, `Minas no debe acceder a ${modulo}`);
  }

  assert.equal(getCarpetaNube(user), 'NOOVA SAC/13. PROYECTOS');
  assert.equal(getRutaInicial(user), '/solicitudes');
});

test('un usuario inactivo o con rol desconocido no recibe acceso', () => {
  assert.equal(tienePermiso(perfil('gerencia', { activo: false }), 'dashboard'), false);
  assert.equal(tienePermiso(perfil('operaciones'), 'dashboard'), false);
});

test('aliases legacy inequívocos se normalizan sin crear roles nuevos', () => {
  assert.equal(normalizarRol('gerente'), 'gerencia');
  assert.equal(normalizarRol('sistemas'), 'soporte_ti');
  assert.equal(normalizarRol('marketing'), 'responsable_marketing');
  assert.equal(normalizarRol('ing_minas'), 'jefe_proyecto_mina');
  assert.equal(normalizarRol('admin'), 'administrador');
});

test('cada rol usa su área y raíz lógica canónicas', () => {
  assert.deepEqual(
    Object.fromEntries(Object.keys(ROLES).map((role) => [role, {
      area: getAreaPredeterminada(role),
      nube: getCarpetaNube(perfil(role))
    }])),
    {
      gerencia: { area: 'gerencia', nube: 'NOOVA SAC' },
      administrador: { area: 'administracion', nube: 'NOOVA SAC' },
      soporte_ti: { area: 'sistemas', nube: 'NOOVA SAC/10. SISTEMAS' },
      responsable_marketing: { area: 'marketing', nube: 'NOOVA SAC/04. MARKETING' },
      jefe_proyecto_mina: { area: 'minas', nube: 'NOOVA SAC/13. PROYECTOS' }
    }
  );
});
