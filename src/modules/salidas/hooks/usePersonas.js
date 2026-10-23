import { useMemo } from 'react';
import { useAvatares } from '../../../hooks/useAvatares';
import { FIRMANTES_SALIDA } from '../../../data/firmantes';
import { mismaPersona } from '../../../utils/nombres';

export function usePersonas() {
  const { avatares } = useAvatares();

  return useMemo(() => {
    const nombres = [];
    for (const nombre of [...FIRMANTES_SALIDA.map((f) => f.nombre), ...avatares.map((a) => a.nombre)]) {
      if (nombre && !nombres.some((n) => mismaPersona(n, nombre))) nombres.push(nombre);
    }
    return nombres.sort((a, b) => a.localeCompare(b, 'es'));
  }, [avatares]);
}
