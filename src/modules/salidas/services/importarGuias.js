import { addLog } from '../../../services/logService';
import { leerDocumentoGuia } from '../utils/leerGuia';
import { claveGuia, crearSalida, formatearGuia, formatoDesdeGuia, siguienteCorrelativo, validarSalida } from '../utils/salida';
import { crearSalidaGuia, guardarArchivoGuia } from './salidaService';

export async function importarGuias(archivos, { salidas, usuario, porDefecto }) {
  const resultado = { listas: [], pendientes: [], vinculadas: [], sinTexto: [], problemas: [] };
  const existentes = new Map(salidas.map((s) => [s.claveGuia, s]));
  let correlativo = siguienteCorrelativo(salidas);

  for (const file of archivos) {
    try {
      const { bytes, documento, resultado: lectura, mensaje } = await leerDocumentoGuia(file);
      const archivo = { bytes, ...documento };
      if (!lectura) {
        resultado.sinTexto.push({ archivo, documento, mensaje });
        continue;
      }

      const salida = crearSalida({
        guia: lectura.guia,
        items: lectura.items,
        origen: 'pdf',
        documento,
        formato: formatoDesdeGuia(lectura.guia, { ...porDefecto, correlativo })
      });
      const clave = claveGuia(salida.guia);
      if (!clave) {
        resultado.problemas.push(`${file.name}: no se pudo leer el número de guía.`);
        continue;
      }
      if (existentes.has(clave)) {
        const existente = existentes.get(clave);
        await guardarArchivoGuia(existente.id, archivo);
        resultado.vinculadas.push({ salida: existente, archivo });
        continue;
      }

      const id = await crearSalidaGuia(salida, usuario);
      await guardarArchivoGuia(id, archivo);
      const importada = { salida: { ...salida, id, version: 1 }, archivo };
      (validarSalida(salida).valido ? resultado.listas : resultado.pendientes).push(importada);
      existentes.set(clave, importada.salida);
      correlativo += 1;
      addLog({ usuario, accion: 'importar_guia_remision', detalle: formatearGuia(salida.guia) }).catch(() => {});
    } catch (err) {
      console.error('Error importando guía:', err);
      resultado.problemas.push(`${file.name}: ${err.message}`);
    }
  }
  return resultado;
}
