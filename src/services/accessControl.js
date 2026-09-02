// Definiciones y utilidades puras de acceso. Se mantienen separadas de
// Firebase para poder validarlas sin inicializar red, Auth o Firestore.
export const ROLES = {
  administrador: {
    label: 'Administrador', sector: 'Administración',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'cotizaciones', 'mensajeria', 'proveedores', 'compras', 'facturacion', 'nube', 'usuarios', 'configuracion'],
    nubeCarpeta: null, puedeCotizar: true
  },
  gerencia: {
    label: 'Gerencia', sector: 'Gerencia',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'cotizaciones', 'mensajeria', 'proveedores', 'compras', 'facturacion', 'nube', 'usuarios', 'configuracion'],
    nubeCarpeta: null, puedeCotizar: true
  },
  comercial: {
    label: 'Comercial', sector: 'Ventas',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'cotizaciones', 'mensajeria', 'compras', 'facturacion', 'nube'],
    nubeCarpeta: null, puedeCotizar: true
  },
  compras: {
    label: 'Compras', sector: 'Compras',
    navItems: ['dashboard', 'proveedores', 'compras', 'equipos', 'mangas', 'nube'],
    nubeCarpeta: 'Compras', puedeCotizar: false
  },
  operaciones: {
    label: 'Operaciones', sector: 'Operaciones',
    navItems: ['dashboard', 'clientes', 'equipos', 'mangas', 'mensajeria', 'compras', 'nube'],
    nubeCarpeta: 'Operaciones', puedeCotizar: false
  },
  marketing: {
    label: 'Marketing', sector: 'Marketing',
    navItems: ['dashboard', 'mensajeria', 'nube'],
    nubeCarpeta: 'Marketing', puedeCotizar: false
  },
  sistemas: {
    label: 'Sistemas', sector: 'Sistemas',
    navItems: ['dashboard', 'nube', 'usuarios'],
    nubeCarpeta: 'Sistemas', puedeCotizar: false
  },
  ing_minas: {
    label: 'Ingeniería de Minas', sector: 'Ingeniería',
    navItems: ['dashboard', 'mensajeria', 'nube'],
    nubeCarpeta: 'Ingeniería de Minas', puedeCotizar: false
  },
  sin_acceso: {
    label: 'Sin acceso', sector: 'Sin asignar', navItems: [],
    nubeCarpeta: 'Sin acceso', puedeCotizar: false
  }
};

export const MODULOS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'equipos', label: 'Equipos' },
  { key: 'mangas', label: 'Mangas' },
  { key: 'cotizaciones', label: 'Cotizaciones' },
  { key: 'mensajeria', label: 'Mensajería' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'compras', label: 'Órdenes de compra' },
  { key: 'facturacion', label: 'Boletas y facturas' },
  { key: 'nube', label: 'Nube' },
  { key: 'usuarios', label: 'Usuarios y roles' },
  { key: 'configuracion', label: 'Configuración y auditoría' }
];

const ALIAS_ROL = {
  admin: 'administrador',
  administrator: 'administrador',
  owner: 'administrador',
  propietario: 'administrador',
  creator: 'administrador',
  creador: 'administrador',
  superadmin: 'administrador',
  super_admin: 'administrador',
  'super-admin': 'administrador',
  root: 'administrador',
  ventas: 'comercial'
};

export function normalizarRol(role) {
  const valor = String(role || '').trim().toLowerCase();
  return ALIAS_ROL[valor] || valor;
}

export function getPermisosUsuario(profile) {
  const role = normalizarRol(profile?.role);
  if (!profile || profile.activo === false || role === 'sin_acceso') return [];

  const permisosRol = ROLES[role]?.navItems || [];

  // El administrador es el propietario funcional del ERP y nunca debe
  // quedar bloqueado por una lista permissions heredada o incompleta.
  // Los permisos personalizados se reservan para los demás colaboradores.
  if (role === 'administrador') {
    return [...new Set(permisosRol)];
  }

  const permisosConfigurados = Array.isArray(profile.permissions) && profile.permissions.length > 0
    ? profile.permissions
    : permisosRol;

  return [...new Set(['dashboard', ...permisosConfigurados])];
}

export function tienePermiso(profile, modulo) {
  return getPermisosUsuario(profile).includes(modulo);
}
