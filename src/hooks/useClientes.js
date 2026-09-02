import { useState, useEffect, useCallback } from 'react';
import {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente
} from '../services/clienteService';

export function useClientes(enabled = true) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const fetchClientes = useCallback(async () => {
    if (!enabled) return [];
    try {
      setLoading(true);
      setError(null);
      const data = await getClientes();
      setClientes(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) fetchClientes();
  }, [enabled, fetchClientes]);

  const addCliente = useCallback(async (data) => {
    try {
      setError(null);
      const id = await createCliente(data);
      setClientes((prev) => [...prev, { id, ...data, createdAt: new Date().toISOString() }]);
      return id;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const editCliente = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateCliente(id, data);
      setClientes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeCliente = useCallback(async (id) => {
    try {
      setError(null);
      await deleteCliente(id);
      setClientes((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getCliente = useCallback(async (id) => {
    try {
      return await getClienteById(id);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    clientes,
    loading,
    error,
    fetchClientes,
    addCliente,
    editCliente,
    removeCliente,
    getCliente
  };
}
