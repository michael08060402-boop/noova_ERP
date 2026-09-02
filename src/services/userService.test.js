import test from 'node:test';
import assert from 'node:assert/strict';
import { getPermisosUsuario, tienePermiso } from './accessControl.js';

test('un administrador con permisos vacíos hereda el acceso de su rol', () => {
  const permisos = getPermisosUsuario({ role: 'administrador', permissions: [], activo: true });
  assert.ok(permisos.includes('dashboard'));
  assert.ok(permisos.includes('clientes'));
  assert.ok(permisos.includes('configuracion'));
});

test('un rol legado admin conserva el acceso completo de administrador', () => {
  const permisos = getPermisosUsuario({ role: 'admin', permissions: [], activo: true });
  assert.ok(permisos.includes('clientes'));
  assert.ok(permisos.includes('usuarios'));
  assert.ok(permisos.includes('configuracion'));
});

test('un administrador no queda restringido por permissions heredados', () => {
  const permisos = getPermisosUsuario({ role: 'admin', permissions: ['dashboard'], activo: true });
  assert.ok(permisos.includes('clientes'));
  assert.ok(permisos.includes('compras'));
  assert.ok(permisos.includes('usuarios'));
  assert.ok(permisos.includes('configuracion'));
});



test('roles legacy de propietario/creador conservan acceso total', () => {
  for (const role of ['owner', 'propietario', 'creator', 'creador', 'superadmin', 'super_admin', 'super-admin', 'root']) {
    const permisos = getPermisosUsuario({ role, permissions: ['dashboard'], activo: true });
    assert.ok(permisos.includes('clientes'), `${role} debe ver clientes`);
    assert.ok(permisos.includes('compras'), `${role} debe ver compras`);
    assert.ok(permisos.includes('usuarios'), `${role} debe ver usuarios`);
    assert.ok(permisos.includes('configuracion'), `${role} debe ver configuración`);
  }
});
test('un permiso personalizado conserva dashboard como inicio seguro', () => {
  const permisos = getPermisosUsuario({ role: 'operaciones', permissions: ['nube'], activo: true });
  assert.deepEqual(permisos, ['dashboard', 'nube']);
});

test('sin_acceso e inactivo nunca reciben permisos', () => {
  assert.equal(tienePermiso({ role: 'sin_acceso', permissions: ['dashboard'], activo: true }, 'dashboard'), false);
  assert.equal(tienePermiso({ role: 'administrador', activo: false }, 'dashboard'), false);
});

test('el administrador también ve el módulo independiente Proveedores', () => {
  const permisos = getPermisosUsuario({ role: 'admin', permissions: ['dashboard'], activo: true });
  assert.ok(permisos.includes('proveedores'));
});

test('el rol Compras recibe órdenes y proveedores sin exponer administración', () => {
  const permisos = getPermisosUsuario({ role: 'compras', permissions: [], activo: true });
  assert.ok(permisos.includes('compras'));
  assert.ok(permisos.includes('proveedores'));
  assert.equal(permisos.includes('usuarios'), false);
  assert.equal(permisos.includes('configuracion'), false);
});
