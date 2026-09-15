// Fuente única de permisos para el frontend del ERP.
// Los permisos se derivan exclusivamente del rol. Los campos legacy
// `permissions` y `sector` de usuarios antiguos se ignoran para autorización.

export const AREAS = {
  gerencia: { label: 'Gerencia' },
  administracion: { label: 'Administración' },
  marketing: { label: 'Marketing' },
  minas: { label: 'Minas' },
  contabilidad: { label: 'Contabilidad' },
  sistemas: { label: 'Sistemas' }
};

const TODO = ['read', 'create', 'update', 'delete'];

const PERMISOS_TOTALES = {
  dashboard: ['read'],
  clientes: TODO,
  equipos: TODO,
  mangas: TODO,
  cotizaciones: TODO,
  ventas: TODO,
  mensajeria: TODO,
  proveedores: TODO,
  compras: TODO,
  facturacion: TODO,
  nube: TODO,
  perfil: TODO,
  configuracion: ['read', 'update']
};

export const SECCIONES_CONFIGURACION = [
  { key: 'empresa', label: 'Empresa' },
  { key: 'pagos', label: 'Condiciones' },
  { key: 'correlativo', label: 'Correlativos' },
  { key: 'usuarios', label: 'Usuarios y Roles' },
  { key: 'logs', label: 'Auditoría' }
];

export const ROLES = {
  gerencia: {
    label: 'Gerencia',
    areaPredeterminada: 'gerencia',
    permissions: { ...PERMISOS_TOTALES },
    configuracion: ['*'],
    nubeCarpeta: 'NOOVA SAC',
    rutaInicial: '/dashboard'
  },

  administrador: {
    label: 'Administrador',
    areaPredeterminada: 'administracion',
    permissions: { ...PERMISOS_TOTALES },
    // El documento funcional indica: Configuración parcial, solo Correlativos.
    configuracion: ['correlativo'],
    nubeCarpeta: 'NOOVA SAC',
    rutaInicial: '/dashboard'
  },

  soporte_ti: {
    label: 'Soporte TI',
    areaPredeterminada: 'sistemas',
    permissions: {
      configuracion: ['read', 'update'],
      perfil: TODO,
      nube: TODO,
      mensajeria: TODO
    },
    // Como el documento no marca Configuración como parcial para Soporte TI,
    // se interpreta acceso completo a sus secciones.
    configuracion: ['*'],
    nubeCarpeta: 'NOOVA SAC/10. SISTEMAS',
    rutaInicial: '/configuracion'
  },

  responsable_marketing: {
    label: 'Responsable de Marketing',
    areaPredeterminada: 'marketing',
    permissions: {
      dashboard: ['read'],
      clientes: ['read'],
      mensajeria: TODO,
      perfil: ['read'],
      nube: TODO
    },
    configuracion: [],
    nubeCarpeta: 'NOOVA SAC/04. MARKETING',
    rutaInicial: '/dashboard'
  },

  jefe_proyecto_mina: {
    label: 'Jefe de Proyecto de Mina',
    areaPredeterminada: 'minas',
    permissions: {
      nube: TODO,
      perfil: ['read', 'update']
    },
    configuracion: [],
    nubeCarpeta: 'NOOVA SAC/13. PROYECTOS',
    rutaInicial: '/nube'
  }
};

export const MODULOS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'equipos', label: 'Equipos' },
  { key: 'mangas', label: 'Mangas' },
  { key: 'cotizaciones', label: 'Cotizaciones' },
  { key: 'ventas', label: 'Ventas' },
  { key: 'mensajeria', label: 'Mensajería' },
  { key: 'proveedores', label: 'Proveedores' },
  { key: 'compras', label: 'Órdenes de compra' },
  { key: 'facturacion', label: 'Boletas y facturas' },
  { key: 'nube', label: 'Nube' },
  { key: 'perfil', label: 'Perfil' },
  { key: 'configuracion', label: 'Configuración' }
];

// Alias únicamente para una transición segura desde valores antiguos que
// tienen una equivalencia inequívoca. No crea roles adicionales en la UI.
const ALIAS_ROL = {
  admin: 'administrador',
  gerente: 'gerencia',
  marketing: 'responsable_marketing',
  sistemas: 'soporte_ti',
  ing_minas: 'jefe_proyecto_mina'
};

export function normalizarRol(role) {
  const valor = String(role || '').trim().toLowerCase();
  return ALIAS_ROL[valor] || valor;
}

export function esRolValido(role) {
  return Boolean(ROLES[normalizarRol(role)]);
}

export function normalizarArea(area) {
  const valor = String(area || '').trim().toLowerCase();
  const alias = {
    'administración': 'administracion',
    'mina': 'minas',
    'minería': 'minas',
    'ingenieria': 'minas',
    'ingeniería': 'minas'
  };
  const normalizada = alias[valor] || valor;
  return Object.prototype.hasOwnProperty.call(AREAS, normalizada)
    ? normalizada
    : '';
}

export function getDefinicionRol(profileOrRole) {
  const role = typeof profileOrRole === 'string'
    ? normalizarRol(profileOrRole)
    : normalizarRol(profileOrRole?.role);

  return ROLES[role] || null;
}

export function esUsuarioActivo(profile) {
  return Boolean(
    profile &&
    profile.activo !== false &&
    getDefinicionRol(profile)
  );
}

export function puede(profile, modulo, accion = 'read') {
  if (!esUsuarioActivo(profile)) return false;

  const definicion = getDefinicionRol(profile);
  const acciones = definicion?.permissions?.[modulo];

  if (!Array.isArray(acciones)) return false;
  return acciones.includes('all') || acciones.includes(accion);
}

// Compatibilidad con componentes existentes: equivale a poder leer/entrar.
export function tienePermiso(profile, modulo) {
  return puede(profile, modulo, 'read');
}

// Compatibilidad con código que todavía espera una lista plana de módulos.
export function getPermisosUsuario(profile) {
  if (!esUsuarioActivo(profile)) return [];

  return MODULOS
    .map((modulo) => modulo.key)
    .filter((modulo) => puede(profile, modulo, 'read'));
}

export function puedeConfiguracion(profile, seccion) {
  if (!puede(profile, 'configuracion', 'read')) return false;

  const definicion = getDefinicionRol(profile);
  const secciones = definicion?.configuracion || [];

  return secciones.includes('*') || secciones.includes(seccion);
}

export function puedeEditarConfiguracion(profile, seccion) {
  return puede(profile, 'configuracion', 'update')
    && puedeConfiguracion(profile, seccion);
}

export function puedeGestionarUsuarios(profile) {
  return puedeConfiguracion(profile, 'usuarios');
}

export function getRutaInicial(profile) {
  if (!esUsuarioActivo(profile)) return '/login';

  const definicion = getDefinicionRol(profile);
  const preferida = definicion?.rutaInicial;

  if (preferida) return preferida;

  const primera = MODULOS.find((modulo) => puede(profile, modulo.key, 'read'));
  return primera ? `/${primera.key}` : '/login';
}

export function getCarpetaNube(profile) {
  if (!puede(profile, 'nube', 'read')) return undefined;
  return getDefinicionRol(profile)?.nubeCarpeta;
}

export function getAreaPredeterminada(role) {
  return getDefinicionRol(role)?.areaPredeterminada || '';
}

export function getNombreArea(area) {
  const normalizada = normalizarArea(area);
  return normalizada ? AREAS[normalizada].label : '';
}
