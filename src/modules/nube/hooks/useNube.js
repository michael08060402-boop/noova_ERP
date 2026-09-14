import { useState, useCallback, useRef } from 'react';
import {
  listarCarpeta, buscarDocumentos,
  obtenerContexto, crearCarpeta as crearCarpetaServicio,
  subirArchivo as subirArchivoServicio,
  renombrarItem as renombrarItemServicio,
  eliminarItem as eliminarItemServicio
} from '../services/nubeService';

// Hook principal del modulo Nube
// Maneja navegacion, breadcrumb, busqueda, CRUD y restriccion por area/rol.
//
// Si el usuario tiene un rol restringido (ej. Marketing, Sistemas), el
// backend le asigna una carpeta de area como "raiz forzada": toda la
// navegacion (incluido el boton "Inicio" del breadcrumb) ocurre dentro de
// esa carpeta, sin exponer el resto del drive.

export default function useNube() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [ruta, setRuta] = useState([]); // [{ id, nombre }, ...] (relativo a la raiz forzada, si aplica)
  const [buscando, setBuscando] = useState(false);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState(null); // null = no buscando
  const [carpetaArea, setCarpetaArea] = useState(null); // nombre del area si el rol esta restringido
  const [procesando, setProcesando] = useState(false);

  const raizForzadaId = useRef(null); // id de carpeta que actua como "raiz" para roles restringidos
  const contextoListo = useRef(false);

  // Resuelve el contexto de rol (una sola vez) y devuelve el id a usar
  // cuando se pide la raiz (carpetaId === null)
  const resolverRaiz = useCallback(async (carpetaId) => {
    if (carpetaId) return carpetaId;
    if (!contextoListo.current) {
      const ctx = await obtenerContexto();
      if (!ctx?.carpetaId) {
        throw new Error('Nube no devolvió una carpeta raíz válida para tu rol.');
      }
      contextoListo.current = true;
      raizForzadaId.current = ctx.carpetaId;
      if (ctx.carpetaArea) {
        setCarpetaArea(ctx.carpetaArea);
      }
    }
    if (!raizForzadaId.current) {
      throw new Error('No se pudo determinar la carpeta raíz de Nube.');
    }
    return raizForzadaId.current;
  }, []);

  // Cargar contenido de una carpeta
  const cargarCarpeta = useCallback(async (carpetaId = null, nombreCarpeta = null) => {
    setCargando(true);
    setError(null);
    setResultadosBusqueda(null);
    setTerminoBusqueda('');

    try {
      const idEfectivo = await resolverRaiz(carpetaId);
      const resultado = await listarCarpeta(idEfectivo);
      setItems(resultado);

      // Actualizar breadcrumb
      if (carpetaId && nombreCarpeta) {
        setRuta(prev => [...prev, { id: carpetaId, nombre: nombreCarpeta }]);
      } else if (!carpetaId) {
        setRuta([]);
      }
    } catch (err) {
      console.error('Error cargando carpeta:', err);
      setError(err.message || 'Error al cargar la carpeta');
    } finally {
      setCargando(false);
    }
  }, [resolverRaiz]);

  // Navegar a una carpeta del breadcrumb (ir hacia atras)
  const navegarA = useCallback(async (indiceRuta) => {
    if (indiceRuta < 0) {
      await cargarCarpeta(null);
      return;
    }

    const nuevaRuta = ruta.slice(0, indiceRuta + 1);
    const carpetaDestino = nuevaRuta[nuevaRuta.length - 1];

    setRuta(nuevaRuta);
    setCargando(true);
    setError(null);
    setResultadosBusqueda(null);
    setTerminoBusqueda('');

    try {
      const resultado = await listarCarpeta(carpetaDestino.id);
      setItems(resultado);
    } catch (err) {
      console.error('Error navegando:', err);
      setError(err.message || 'Error al navegar');
    } finally {
      setCargando(false);
    }
  }, [ruta, cargarCarpeta]);

  // Abrir un archivo — redirige al enlace de SharePoint/OneDrive
  // El usuario vera el documento en el navegador con sus permisos de Microsoft 365
  const abrirArchivo = useCallback((urlWeb) => {
    if (!urlWeb) {
      setError('OneDrive no devolvió un enlace web para este documento. Revisa la configuración de Microsoft Graph y los permisos del sitio.');
      return;
    }
    window.open(urlWeb, '_blank', 'noopener');
  }, []);

  // Buscar documentos
  const buscar = useCallback(async (termino) => {
    const terminoLimpio = termino.trim();

    if (!terminoLimpio || terminoLimpio.length < 2) {
      setResultadosBusqueda(null);
      setTerminoBusqueda('');
      return;
    }

    setBuscando(true);
    setError(null);
    setTerminoBusqueda(terminoLimpio);

    try {
      const resultados = await buscarDocumentos(terminoLimpio);
      setResultadosBusqueda(resultados);
    } catch (err) {
      console.error('Error buscando:', err);
      setError(err.message || 'Error al buscar documentos');
    } finally {
      setBuscando(false);
    }
  }, []);

  // Limpiar busqueda y volver a la carpeta actual
  const limpiarBusqueda = useCallback(() => {
    setResultadosBusqueda(null);
    setTerminoBusqueda('');
  }, []);

  // Carpeta actualmente abierta (para crear/subir dentro de ella)
  const carpetaActualId = useCallback(() => {
    return ruta.length > 0 ? ruta[ruta.length - 1].id : (raizForzadaId.current || null);
  }, [ruta]);

  // Refrescar la carpeta actual
  const refrescar = useCallback(async () => {
    if (resultadosBusqueda !== null) {
      // Si estabamos viendo resultados de busqueda, re-ejecutar
      setBuscando(true);
      try {
        const resultados = await buscarDocumentos(terminoBusqueda);
        setResultadosBusqueda(resultados);
      } catch (err) {
        setError(err.message || 'Error al buscar');
      } finally {
        setBuscando(false);
      }
      return;
    }

    const idEfectivo = carpetaActualId();
    setCargando(true);
    setError(null);
    try {
      const resultado = await listarCarpeta(idEfectivo);
      setItems(resultado);
    } catch (err) {
      setError(err.message || 'Error al refrescar');
    } finally {
      setCargando(false);
    }
  }, [carpetaActualId, resultadosBusqueda, terminoBusqueda]);

  // ── CRUD ──

  const crearCarpeta = useCallback(async (nombre) => {
    setProcesando(true);
    setError(null);
    try {
      await crearCarpetaServicio(carpetaActualId(), nombre);
      await refrescar();
    } catch (err) {
      setError(err.message || 'Error al crear la carpeta');
      throw err;
    } finally {
      setProcesando(false);
    }
  }, [carpetaActualId, refrescar]);

  const subirArchivo = useCallback(async (archivo) => {
    setProcesando(true);
    setError(null);
    try {
      await subirArchivoServicio(carpetaActualId(), archivo);
      await refrescar();
    } catch (err) {
      setError(err.message || 'Error al subir el archivo');
      throw err;
    } finally {
      setProcesando(false);
    }
  }, [carpetaActualId, refrescar]);

  const renombrarItem = useCallback(async (itemId, nuevoNombre) => {
    setProcesando(true);
    setError(null);
    try {
      await renombrarItemServicio(itemId, nuevoNombre);
      await refrescar();
    } catch (err) {
      setError(err.message || 'Error al renombrar');
      throw err;
    } finally {
      setProcesando(false);
    }
  }, [refrescar]);

  const eliminarItem = useCallback(async (itemId) => {
    setProcesando(true);
    setError(null);
    try {
      await eliminarItemServicio(itemId);
      await refrescar();
    } catch (err) {
      setError(err.message || 'Error al eliminar');
      throw err;
    } finally {
      setProcesando(false);
    }
  }, [refrescar]);

  // Items visibles: resultados de busqueda o contenido de carpeta
  const itemsVisibles = resultadosBusqueda !== null ? resultadosBusqueda : items;

  return {
    items: itemsVisibles,
    cargando,
    buscando,
    error,
    ruta,
    terminoBusqueda,
    enBusqueda: resultadosBusqueda !== null,
    carpetaArea,
    procesando,
    cargarCarpeta,
    navegarA,
    abrirArchivo,
    buscar,
    limpiarBusqueda,
    refrescar,
    crearCarpeta,
    subirArchivo,
    renombrarItem,
    eliminarItem
  };
}
