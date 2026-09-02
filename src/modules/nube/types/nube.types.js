// Tipos y constantes del módulo Nube

// Tipo de item en el explorador
export const TIPO_ITEM = {
  CARPETA: 'carpeta',
  ARCHIVO: 'archivo'
};

// Proveedor de almacenamiento activo
export const PROVEEDOR_NUBE = {
  GRAPH: 'graph' // Microsoft Graph mediante Firebase Cloud Functions
};

// Estructura de un item devuelto por cualquier proveedor
// { id, nombre, tipo, tamaño, fechaModificacion, extension?, mimeType?, urlWeb? }

// Estructura del breadcrumb
// { id, nombre }

// Principio de diseño:
// La UI se conecta únicamente a Microsoft Graph mediante Cloud Functions.
