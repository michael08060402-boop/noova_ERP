import { useState, useEffect, useCallback } from 'react';
import {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor
} from '../services/proveedorService';

export function useProveedores(enabled = true) {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchProveedores = useCallback(async () => {
    if (!enabled) return [];
    try {
      setLoading(true);
      setError(null);
      const data = await getProveedores();
      setProveedores(data);
      return data;
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los proveedores');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) fetchProveedores().catch(() => {});
  }, [enabled, fetchProveedores]);

  const addProveedor = useCallback(async (data) => {
    setError(null);
    const id = await createProveedor(data);
    await fetchProveedores();
    return id;
  }, [fetchProveedores]);

  const editProveedor = useCallback(async (id, data) => {
    setError(null);
    await updateProveedor(id, data);
    await fetchProveedores();
  }, [fetchProveedores]);

  const removeProveedor = useCallback(async (id) => {
    setError(null);
    await deleteProveedor(id);
    await fetchProveedores();
  }, [fetchProveedores]);

  const getProveedor = useCallback(async (id) => getProveedorById(id), []);

  return {
    proveedores,
    loading,
    error,
    fetchProveedores,
    addProveedor,
    editProveedor,
    removeProveedor,
    getProveedor
  };
}
