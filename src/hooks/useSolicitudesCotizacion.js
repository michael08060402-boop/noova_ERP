import { useState, useEffect, useCallback } from 'react';
import {
  getSolicitudes,
  createSolicitud,
  updateSolicitud,
  deleteSolicitud,
  enviarSolicitudPorCorreo
} from '../services/solicitudCotizacionService';

export function useSolicitudesCotizacion() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSolicitudes();
      setSolicitudes(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching solicitudes de cotización:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  const addSolicitud = useCallback(async (data) => {
    try {
      setError(null);
      const { id, codigo } = await createSolicitud(data);
      setSolicitudes((prev) => [
        { id, codigo, ...data, estado: data.estado || 'Borrador', historialEnvios: [], createdAt: new Date().toISOString() },
        ...prev
      ]);
      return { id, codigo };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const editSolicitud = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateSolicitud(id, data);
      setSolicitudes((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data, updatedAt: new Date().toISOString() } : s))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeSolicitud = useCallback(async (id) => {
    try {
      setError(null);
      await deleteSolicitud(id);
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const enviarSolicitud = useCallback(async ({ solicitudId, destinatarios, cc, asunto, cuerpoHtml }) => {
    try {
      setError(null);
      const resultado = await enviarSolicitudPorCorreo({ solicitudId, destinatarios, cc, asunto, cuerpoHtml });
      const ahora = new Date().toISOString();
      setSolicitudes((prev) =>
        prev.map((s) => (s.id === solicitudId
          ? {
              ...s,
              estado: 'Enviada',
              updatedAt: ahora,
              historialEnvios: [
                ...(s.historialEnvios || []),
                { fecha: ahora, destinatarios: Array.isArray(destinatarios) ? destinatarios : [destinatarios], cc: cc || [], asunto }
              ]
            }
          : s))
      );
      return resultado;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    solicitudes,
    loading,
    error,
    fetchSolicitudes,
    addSolicitud,
    editSolicitud,
    removeSolicitud,
    enviarSolicitud
  };
}
