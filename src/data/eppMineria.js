// ============================================================
// Catálogo base de EPP para el área de MINAS.
// ------------------------------------------------------------
// Los cuatro primeros ítems corresponden EXACTAMENTE a los EPP
// de la factura de compra (chalecos, lente y polo) con sus
// precios reales, de modo que Noova pueda revenderlos/cotizarlos
// a otras empresas. El resto son EPP habituales de minería
// (tomados del listado operativo de la brigada) con precio
// referencial 0: se completan al cotizar o desde el catálogo.
//
// Se importan al catálogo `epp` (Firestore) mediante el botón
// "Importar EPP de minería" de la página EPP. La importación es
// idempotente: no duplica códigos ya existentes.
// ============================================================

export const EPP_MINERIA = [
  // --- EPP de la factura (precios reales) ---
  {
    codigo: 'CHAL-VF',
    nombre: 'Chaleco de seguridad verde fosforescente',
    categoria: 'Ropa de trabajo',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 16,
    descripcion: 'Chaleco reflectivo de alta visibilidad, color verde fosforescente. Tallas M, L y XL.',
    activo: true
  },
  {
    codigo: 'CHAL-AN',
    nombre: 'Chaleco de seguridad anaranjado',
    categoria: 'Ropa de trabajo',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 16,
    descripcion: 'Chaleco reflectivo de alta visibilidad, color anaranjado. Tallas M, L y XL.',
    activo: true
  },
  {
    codigo: 'LEN-SEG',
    nombre: 'Lente de seguridad (claro / oscuro)',
    categoria: 'Protección ocular',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 3,
    descripcion: 'Lente de seguridad con protección UV. Disponible en mica clara y oscura.',
    activo: true
  },
  {
    codigo: 'POLO-AN',
    nombre: 'Polo anaranjado',
    categoria: 'Ropa de trabajo',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 8,
    descripcion: 'Polo de trabajo color anaranjado. Tallas M, L y XL.',
    activo: true
  },

  // --- EPP habituales de minería (precio referencial a completar) ---
  {
    codigo: 'CASCO-01',
    nombre: 'Casco de seguridad con barbiquejo',
    categoria: 'Protección de cabeza',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Casco de seguridad tipo minero con ranura para lámpara y barbiquejo de 4 puntos.',
    activo: true
  },
  {
    codigo: 'BARB-01',
    nombre: 'Barbiquejo para casco',
    categoria: 'Protección de cabeza',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Barbiquejo de sujeción para casco de seguridad.',
    activo: true
  },
  {
    codigo: 'OVEROL-AM',
    nombre: 'Overol / mameluco amarillo',
    categoria: 'Ropa de trabajo',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Overol de trabajo color amarillo con cintas reflectivas.',
    activo: true
  },
  {
    codigo: 'OVEROL-NA',
    nombre: 'Overol / mameluco anaranjado',
    categoria: 'Ropa de trabajo',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Overol de trabajo color anaranjado con cintas reflectivas.',
    activo: true
  },
  {
    codigo: 'BOTA-01',
    nombre: 'Botas de seguridad punta de acero',
    categoria: 'Protección de pies',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Botas de seguridad con puntera de acero y suela antideslizante.',
    activo: true
  },
  {
    codigo: 'ZAP-SEG',
    nombre: 'Zapato de seguridad',
    categoria: 'Protección de pies',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Zapato de seguridad con puntera reforzada.',
    activo: true
  },
  {
    codigo: 'RESP-01',
    nombre: 'Respirador media cara',
    categoria: 'Protección respiratoria',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Respirador reutilizable de media cara para filtros contra polvo y gases.',
    activo: true
  },
  {
    codigo: 'TAP-01',
    nombre: 'Tapones auditivos',
    categoria: 'Protección auditiva',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Tapones auditivos de espuma con cordón.',
    activo: true
  },
  {
    codigo: 'OREJ-01',
    nombre: 'Orejeras de protección auditiva',
    categoria: 'Protección auditiva',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Orejeras de copa para atenuación de ruido.',
    activo: true
  },
  {
    codigo: 'GUA-BAD',
    nombre: 'Guantes de badana',
    categoria: 'Protección de manos',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Guantes de cuero badana para trabajos generales.',
    activo: true
  },
  {
    codigo: 'LAMP-01',
    nombre: 'Lámpara minera',
    categoria: 'Iluminación',
    marca: '',
    modelo: '',
    unidadMedida: 'UNIDAD',
    precio: 0,
    descripcion: 'Lámpara minera recargable para casco.',
    activo: true
  }
];

export default EPP_MINERIA;
