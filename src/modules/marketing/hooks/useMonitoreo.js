import { useEffect, useState } from 'react';
import { escucharCapturas, escucharEstadoRedes } from '../services/monitoreoService';

export default function useMonitoreo() {
  const [capturas, setCapturas] = useState([]);
  const [estado, setEstado] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [actualizadoEn, setActualizadoEn] = useState(null);

  useEffect(() => {
    const alFallar = (fallo) => {
      setError(fallo.message);
      setCargando(false);
    };
    const detenerCapturas = escucharCapturas(
      (items) => {
        setCapturas(items);
        setError(null);
        setCargando(false);
        setActualizadoEn(new Date());
      },
      alFallar
    );
    const detenerEstado = escucharEstadoRedes(setEstado, alFallar);
    return () => {
      detenerCapturas();
      detenerEstado();
    };
  }, []);

  return { capturas, estado, cargando, error, actualizadoEn };
}
