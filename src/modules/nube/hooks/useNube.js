import { useState, useCallback, useRef } from 'react';
import {
  listarCarpeta, buscarDocumentos,
  obtenerContexto, crearCarpeta as crearCarpetaServicio,
  subirArchivo as subirArchivoServicio,
  renombrarItem as renombrarItemServicio,
  eliminarItem as eliminarItemServicio
} from '../services/nubeService';

export default function useNube() {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [ruta, setRuta] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState(null);
  const [carpetaArea, setCarpetaArea] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const raizForzadaId = useRef(null);
  const contextoListo = useRef(false);

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

  const cargarCarpeta = useCallback(async (carpetaId = null, nombreCarpeta = null) => {
    setCargando(true);
    setError(null);
    setResultadosBusqueda(null);
    setTerminoBusqueda('');

    try {
      const idEfectivo = await resolverRaiz(carpetaId);
      const resultado = await listarCarpeta(idEfectivo);
      setItems(resultado);

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

  const abrirArchivo = useCallback((urlWeb) => {
    if (!urlWeb) {
      setError('OneDrive no devolvió un enlace web para este documento. Revisa la configuración de Microsoft Graph y los permisos del sitio.');
      return;
    }
    window.open(urlWeb, '_blank', 'noopener');
  }, []);

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

  const limpiarBusqueda = useCallback(() => {
    setResultadosBusqueda(null);
    setTerminoBusqueda('');
  }, []);

  const carpetaActualId = useCallback(() => {
    return ruta.length > 0 ? ruta[ruta.length - 1].id : (raizForzadaId.current || null);
  }, [ruta]);

  const refrescar = useCallback(async () => {
    if (resultadosBusqueda !== null) {
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
