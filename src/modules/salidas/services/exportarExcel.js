import { FIRMANTES_SALIDA } from '../../../data/firmantes';
import { desdeBase64 } from '../../../utils/base64';
import plantillaUrl from '../assets/formato-salida.xlsx?url';

async function leerBytes(url) {
  // Vite incrusta las imágenes pequeñas como data: y la CSP del hosting no permite fetch a data:.
  if (url.startsWith('data:')) return desdeBase64(url.slice(url.indexOf(',') + 1));
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error('No se pudo cargar la plantilla del formato.');
  return new Uint8Array(await respuesta.arrayBuffer());
}

function guardarArchivo(bytes, nombre) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function descargarExcel(salida) {
  const [{ generarFormatoSalida, nombreArchivoSalida }, plantilla, ...imagenes] = await Promise.all([
    import('../utils/excelSalida'),
    leerBytes(plantillaUrl),
    ...FIRMANTES_SALIDA.map((f) => leerBytes(f.firma))
  ]);
  const firmas = FIRMANTES_SALIDA.map((f, i) => ({ nombre: f.nombre, bytes: imagenes[i] }));
  guardarArchivo(await generarFormatoSalida(plantilla, salida, { firmas }), nombreArchivoSalida(salida));
}
