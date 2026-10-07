import { useCallback, useEffect, useState } from 'react';
import { eliminarPlantilla, getPlantillasGuardadas, guardarPlantilla } from '../services/plantillaSolicitudService';
import { combinarPlantillas, plantillasBase } from '../utils/plantillasSolicitud';

export function usePlantillasSolicitud() {
  const [plantillas, setPlantillas] = useState(() => plantillasBase());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPlantillas(combinarPlantillas(await getPlantillasGuardadas()));
    } catch (err) {
      console.error('Error cargando plantillas de solicitud:', err);
      setError(err.message);
      setPlantillas(plantillasBase());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (plantilla) => {
    const id = await guardarPlantilla(plantilla);
    await cargar();
    return id;
  }, [cargar]);

  const eliminar = useCallback(async (id) => {
    await eliminarPlantilla(id);
    await cargar();
  }, [cargar]);

  return { plantillas, loading, error, guardar, eliminar, recargar: cargar };
}
