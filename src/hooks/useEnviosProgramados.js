import { useState, useEffect, useCallback, useRef } from 'react';
import { getEnviosProgramados, marcarComoEnviado } from '../services/mensajeriaService';
import { abrirWhatsApp } from '../utils/whatsapp';

const INTERVALO_REVISION_MS = 30 * 1000; // 30 segundos

/**
 * Hook que revisa periódicamente si hay envíos programados pendientes
 * cuya hora ya llegó. Cuando encuentra uno, abre WhatsApp automáticamente
 * y lo marca como enviado en Firestore.
 *
 * Importante: la app debe estar abierta para que el envío se ejecute.
 * Si la app está cerrada en el momento programado, el envío se ejecutará
 * la próxima vez que el usuario abra la app.
 */
export function useEnviosProgramados(usuarioId, onEnvioDisparado) {
  const [enviosPendientes, setEnviosPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ultimoDisparo, setUltimoDisparo] = useState(null);
  const callbackRef = useRef(onEnvioDisparado);
  const procesandoRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onEnvioDisparado;
  }, [onEnvioDisparado]);

  const cargarPendientes = useCallback(async () => {
    if (!usuarioId) {
      setCargando(false);
      return;
    }
    try {
      const data = await getEnviosProgramados(usuarioId, 50);
      setEnviosPendientes(data);
    } catch (err) {
      console.error('Error cargando envíos programados:', err);
    } finally {
      setCargando(false);
    }
  }, [usuarioId]);

  const procesarVencidos = useCallback(async () => {
    if (procesandoRef.current) return;
    procesandoRef.current = true;

    try {
      const ahora = Date.now();
      const vencidos = enviosPendientes.filter(e => {
        if (!e.programadoPara) return false;
        return new Date(e.programadoPara).getTime() <= ahora;
      });

      for (const envio of vencidos) {
        // Abrir WhatsApp automáticamente
        const resultado = abrirWhatsApp(envio.numeroDestino, envio.mensajeCompleto || envio.mensajePreview);
        if (resultado.ok) {
          try {
            await marcarComoEnviado(envio.id);
            setUltimoDisparo({
              envio,
              timestamp: new Date().toISOString()
            });
            if (callbackRef.current) callbackRef.current(envio);
          } catch (err) {
            console.error('Error marcando como enviado:', err);
          }
        } else {
          console.error('No se pudo abrir WhatsApp programado:', resultado.error);
        }
        // Pequeña pausa entre envíos para no saturar
        await new Promise(r => setTimeout(r, 800));
      }

      if (vencidos.length > 0) {
        await cargarPendientes();
      }
    } finally {
      procesandoRef.current = false;
    }
  }, [enviosPendientes, cargarPendientes]);

  // Carga inicial + refresh cada 30s
  useEffect(() => {
    cargarPendientes();
    const interval = setInterval(() => {
      cargarPendientes();
    }, INTERVALO_REVISION_MS);
    return () => clearInterval(interval);
  }, [cargarPendientes]);

  // Procesa vencidos cada 15s (más frecuente que la carga)
  useEffect(() => {
    const interval = setInterval(() => {
      procesarVencidos();
    }, 15000);
    return () => clearInterval(interval);
  }, [procesarVencidos]);

  return {
    enviosPendientes,
    cargando,
    ultimoDisparo,
    refrescar: cargarPendientes
  };
}
