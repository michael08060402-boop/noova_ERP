// Tipos y constantes del módulo Nube

// Tipo de item en el explorador
export const TIPO_ITEM = {
  CARPETA: 'carpeta',
  ARCHIVO: 'archivo'
};

// Proveedor de almacenamiento activo
export const PROVEEDOR_NUBE = {
  LOCAL: 'local',   // Lee carpeta OneDrive sincronizada via API local
  GRAPH: 'graph'    // Lee via Microsoft Graph API (Cloud Functions)
};

// Estructura de un item devuelto por cualquier proveedor
// { id, nombre, tipo, tamaño, fechaModificacion, extension?, mimeType?, urlWeb? }

// Estructura del breadcrumb
// { id, nombre }

// Principio de diseño:
// La UI nunca sabe de dónde vienen los datos.
// nubeService.js es la única capa que conoce el proveedor.
// Cambiar de local → graph es solo modificar VITE_NUBE_PROVIDER.
