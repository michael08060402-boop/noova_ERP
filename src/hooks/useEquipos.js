import { useState, useEffect, useCallback } from 'react';
import {
  getEquipos,
  getEquipoById,
  searchEquipoByCodigo,
  createEquipo,
  updateEquipo,
  deleteEquipo
} from '../services/equipoService';

export function useEquipos(enabled = true) {
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchEquipos = useCallback(async () => {
    if (!enabled) return [];
    try {
      setLoading(true);
      setError(null);
      const data = await getEquipos();
      setEquipos(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching equipos:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) fetchEquipos();
  }, [enabled, fetchEquipos]);

  const addEquipo = useCallback(async (data) => {
    try {
      setError(null);
      const id = await createEquipo(data);
      setEquipos((prev) => [...prev, { id, ...data, createdAt: new Date().toISOString() }]);
      return id;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const editEquipo = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateEquipo(id, data);
      setEquipos((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...data, updatedAt: new Date().toISOString() } : e))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeEquipo = useCallback(async (id) => {
    try {
      setError(null);
      await deleteEquipo(id);
      setEquipos((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getEquipo = useCallback(async (id) => {
    try {
      return await getEquipoById(id);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const searchByCodigo = useCallback(async (codigo) => {
    try {
      return await searchEquipoByCodigo(codigo);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    equipos,
    loading,
    error,
    fetchEquipos,
    addEquipo,
    editEquipo,
    removeEquipo,
    getEquipo,
    searchByCodigo
  };
}
