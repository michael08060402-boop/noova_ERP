import { useState, useCallback } from 'react';
import { listarPublicaciones } from '../services/marketingService';

export default function usePublicaciones() {
  const [publicaciones, setPublicaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setPublicaciones(await listarPublicaciones());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  return { publicaciones, cargando, error, cargar };
}
