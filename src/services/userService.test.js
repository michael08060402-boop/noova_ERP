import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  normalizarRol,
  puede,
  tienePermiso,
  puedeConfiguracion,
  getRutaInicial,
  getCarpetaNube
} from './accessControl.js';

function perfil(role, extra = {}) {
  return {
    role,
    activo: true,
    ...extra
  };
}

test('solo existen los 5 roles funcionales definidos', () => {
  assert.deepEqual(
    Object.keys(ROLES),
    [
      'gerente',
      'administrador',
      'soporte_ti',
      'responsable_marketing',
      'jefe_proyecto_mina'
    ]
  );
});

test('Gerente tiene acceso completo a los módulos', () => {
  const user = perfil('gerente');

  for (const modulo of [
    'dashboard',
    'clientes',
    'equipos',
    'mangas',
    'cotizaciones',
    'mensajeria',
    'proveedores',
    'compras',
    'facturacion',
    'nube',
    'perfil',
    'configuracion'
  ]) {
    assert.equal(
      tienePermiso(user, modulo),
      true,
      `Gerente debe poder leer ${modulo}`
    );
  }

  assert.equal(puede(user, 'clientes', 'delete'), true);
  assert.equal(puedeConfiguracion(user, 'usuarios'), true);
  assert.equal(puedeConfiguracion(user, 'logs'), true);
});

test('Administrador ve todos los módulos pero Configuración solo Correlativos', () => {
  const user = perfil('administrador');

  assert.equal(tienePermiso(user, 'clientes'), true);
  assert.equal(tienePermiso(user, 'facturacion'), true);
  assert.equal(tienePermiso(user, 'configuracion'), true);
  assert.equal(puedeConfiguracion(user, 'correlativo'), true);

  for (const seccion of ['empresa', 'pagos', 'usuarios', 'logs']) {
    assert.equal(
      puedeConfiguracion(user, seccion),
      false,
      `Administrador no debe acceder a Configuración/${seccion}`
    );
  }
});

test('Soporte TI solo recibe Configuración, Perfil, Nube y Mensajería', () => {
  const user = perfil('soporte_ti');

  for (const modulo of [
    'configuracion',
    'perfil',
    'nube',
    'mensajeria'
  ]) {
    assert.equal(tienePermiso(user, modulo), true);
  }

  for (const modulo of [
    'dashboard',
    'clientes',
    'equipos',
    'mangas',
    'cotizaciones',
    'proveedores',
    'compras',
    'facturacion'
  ]) {
    assert.equal(tienePermiso(user, modulo), false);
  }

  assert.equal(puedeConfiguracion(user, 'usuarios'), true);
  assert.equal(puedeConfiguracion(user, 'logs'), true);
  assert.equal(getRutaInicial(user), '/configuracion');
  assert.equal(getCarpetaNube(user), null);
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

  assert.equal(getCarpetaNube(user), 'Marketing');
  assert.equal(getRutaInicial(user), '/dashboard');
});

test('Jefe de Proyecto de Mina solo tiene Nube restringida a Mina', () => {
  const user = perfil('jefe_proyecto_mina');

  assert.equal(tienePermiso(user, 'nube'), true);
  assert.equal(tienePermiso(user, 'dashboard'), false);
  assert.equal(tienePermiso(user, 'perfil'), false);
  assert.equal(tienePermiso(user, 'mensajeria'), false);
  assert.equal(getCarpetaNube(user), 'Mina');
  assert.equal(getRutaInicial(user), '/nube');
});

test('un usuario inactivo o con rol desconocido no recibe acceso', () => {
  assert.equal(
    tienePermiso(perfil('gerente', { activo: false }), 'dashboard'),
    false
  );

  assert.equal(
    tienePermiso(perfil('operaciones'), 'dashboard'),
    false
  );
});

test('aliases legacy inequívocos se normalizan sin crear roles nuevos', () => {
  assert.equal(normalizarRol('gerencia'), 'gerente');
  assert.equal(normalizarRol('sistemas'), 'soporte_ti');
  assert.equal(normalizarRol('marketing'), 'responsable_marketing');
  assert.equal(normalizarRol('ing_minas'), 'jefe_proyecto_mina');
  assert.equal(normalizarRol('admin'), 'administrador');
});
