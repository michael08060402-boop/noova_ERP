import { useCallback, useEffect, useState } from 'react';
import { createOrdenCompra, deleteOrdenCompra, getOrdenesCompra, updateOrdenCompra } from '../services/ordenCompraService';

export function useOrdenesCompra(enabled = true) {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) return [];
    try {
      setError(null);
      const data = await getOrdenesCompra();
      setOrdenes(data);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las órdenes de compra');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const create = useCallback(async (data) => {
    const result = await createOrdenCompra(data);
    await refresh();
    return result;
  }, [refresh]);

  const update = useCallback(async (id, data) => {
    await updateOrdenCompra(id, data);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (id) => {
    await deleteOrdenCompra(id);
    setOrdenes((prev) => prev.filter((orden) => orden.id !== id));
  }, []);

  return { ordenes, loading, error, refresh, create, update, remove };
}
