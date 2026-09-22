const { HttpsError } = require('firebase-functions/v2/https');

const TODO = ['read', 'create', 'update', 'delete'];

const PERMISOS_TOTALES = {
  dashboard: ['read'],
  clientes: TODO,
  equipos: TODO,
  mangas: TODO,
  servicios: TODO,
  epp: TODO,
  cotizaciones: TODO,
  solicitudes: TODO,
  calibraciones: ['read'],
  mensajeria: TODO,
  proveedores: TODO,
  compras: TODO,
  facturacion: TODO,
  nube: TODO,
  perfil: TODO,
  configuracion: ['read', 'update']
};

const AREAS = {
  gerencia: 'Gerencia',
  administracion: 'Administración',
  marketing: 'Marketing',
  minas: 'Minas',
  contabilidad: 'Contabilidad',
  sistemas: 'Sistemas'
};

const ROLES = {
  gerencia: {
    label: 'Gerencia',
    areaPredeterminada: 'gerencia',
    permissions: { ...PERMISOS_TOTALES },
    configuracion: ['*'],
    nubeCarpeta: 'NOOVA SAC'
  },

  administrador: {
    label: 'Administrador',
    areaPredeterminada: 'administracion',
    permissions: { ...PERMISOS_TOTALES },
    configuracion: ['correlativo'],
    nubeCarpeta: 'NOOVA SAC'
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
    configuracion: ['*'],
    nubeCarpeta: 'NOOVA SAC/10. SISTEMAS'
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
    nubeCarpeta: 'NOOVA SAC/04. MARKETING'
  },

  jefe_proyecto_mina: {
    label: 'Jefe de Proyecto de Mina',
    areaPredeterminada: 'minas',
    permissions: {
      solicitudes: ['read', 'create', 'update'],
      epp: ['read'],
      nube: TODO,
      perfil: ['read', 'update']
    },
    configuracion: [],
    nubeCarpeta: 'NOOVA SAC/13. PROYECTOS'
  }
};

const ALIAS_ROL = {
  admin: 'administrador',
  gerente: 'gerencia',
  marketing: 'responsable_marketing',
  sistemas: 'soporte_ti',
  ing_minas: 'jefe_proyecto_mina'
};

function normalizarRol(role) {
  const valor = String(role || '').trim().toLowerCase();
  return ALIAS_ROL[valor] || valor;
}

function esRolValido(role) {
  return Boolean(ROLES[normalizarRol(role)]);
}

function normalizarArea(area) {
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

function esAreaValida(area) {
  return Boolean(normalizarArea(area));
}

function getAreaPredeterminada(role) {
  return ROLES[normalizarRol(role)]?.areaPredeterminada || '';
}

function getNombreArea(area) {
  return AREAS[normalizarArea(area)] || '';
}

function puedePerfil(perfil, modulo, accion = 'read') {
  const role = normalizarRol(perfil?.role);
  const definicion = ROLES[role];

  if (!definicion || perfil?.activo === false) return false;

  const acciones = definicion.permissions?.[modulo];
  return Array.isArray(acciones)
    && (acciones.includes('all') || acciones.includes(accion));
}

function puedeConfiguracionPerfil(perfil, seccion) {
  if (!puedePerfil(perfil, 'configuracion', 'read')) return false;

  const role = normalizarRol(perfil?.role);
  const secciones = ROLES[role]?.configuracion || [];

  return secciones.includes('*') || secciones.includes(seccion);
}

function getCarpetaNubePerfil(perfil) {
  if (!puedePerfil(perfil, 'nube', 'read')) return undefined;
  return ROLES[normalizarRol(perfil?.role)]?.nubeCarpeta;
}

function crearAccessControl(db) {
  async function obtenerPerfilActivo(uid) {
    const snapshot = await db.collection('users').doc(uid).get();

    if (!snapshot.exists) {
      throw new HttpsError(
        'permission-denied',
        'El usuario no tiene un perfil en el ERP'
      );
    }

    const perfil = snapshot.data();
    const role = normalizarRol(perfil.role);

    if (perfil.activo === false || !ROLES[role]) {
      throw new HttpsError(
        'permission-denied',
        'El usuario no tiene un perfil activo o un rol válido'
      );
    }

    return {
      ...perfil,
      role
    };
  }

  async function exigirPermiso(uid, modulo, accion = 'read') {
    const perfil = await obtenerPerfilActivo(uid);

    if (!puedePerfil(perfil, modulo, accion)) {
      throw new HttpsError(
        'permission-denied',
        `No tienes permiso para ${accion} en ${modulo}`
      );
    }

    return perfil;
  }

  async function exigirAlgunoPermisos(uid, permisosRequeridos) {
    const perfil = await obtenerPerfilActivo(uid);

    const autorizado = permisosRequeridos.some((permiso) => {
      if (typeof permiso === 'string') {
        return puedePerfil(perfil, permiso, 'read');
      }

      return puedePerfil(
        perfil,
        permiso.modulo,
        permiso.accion || 'read'
      );
    });

    if (!autorizado) {
      throw new HttpsError(
        'permission-denied',
        'No tienes ninguno de los permisos requeridos'
      );
    }

    return perfil;
  }

  async function exigirSeccionConfiguracion(uid, seccion) {
    const perfil = await obtenerPerfilActivo(uid);

    if (!puedeConfiguracionPerfil(perfil, seccion)) {
      throw new HttpsError(
        'permission-denied',
        `No tienes acceso a Configuración/${seccion}`
      );
    }

    return perfil;
  }

  async function obtenerCarpetaAreaDeUsuario(uid) {
    const perfil = await obtenerPerfilActivo(uid);
    const carpeta = getCarpetaNubePerfil(perfil);

    if (carpeta === undefined) {
      throw new HttpsError(
        'permission-denied',
        'Tu rol no tiene acceso al módulo Nube'
      );
    }

    return carpeta;
  }

  return {
    obtenerPerfilActivo,
    exigirPermiso,
    exigirAlgunoPermisos,
    exigirSeccionConfiguracion,
    obtenerCarpetaAreaDeUsuario
  };
}

module.exports = {
  AREAS,
  ROLES,
  normalizarRol,
  esRolValido,
  normalizarArea,
  esAreaValida,
  getAreaPredeterminada,
  getNombreArea,
  puedePerfil,
  puedeConfiguracionPerfil,
  getCarpetaNubePerfil,
  crearAccessControl
};
