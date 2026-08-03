import { useState, useEffect, useCallback } from 'react';
import {
  getProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor
} from '../services/proveedorService';

export function useProveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProveedores = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProveedores();
      setProveedores(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching proveedores:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProveedores();
  }, [fetchProveedores]);

  const addProveedor = useCallback(async (data) => {
    try {
      setError(null);
      const id = await createProveedor(data);
      setProveedores((prev) => [...prev, { id, ...data, createdAt: new Date().toISOString() }]);
      return id;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const editProveedor = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateProveedor(id, data);
      setProveedores((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeProveedor = useCallback(async (id) => {
    try {
      setError(null);
      await deleteProveedor(id);
      setProveedores((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getProveedor = useCallback(async (id) => {
    try {
      return await getProveedorById(id);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

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
