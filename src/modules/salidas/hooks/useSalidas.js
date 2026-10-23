import { useCallback, useEffect, useState } from 'react';
import { getSalidas } from '../services/salidaService';

export function useSalidas() {
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      const lista = await getSalidas();
      setSalidas(lista);
      return lista;
    } catch (err) {
      console.error('Error cargando salidas:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return { salidas, loading, error, recargar: cargar };
}
