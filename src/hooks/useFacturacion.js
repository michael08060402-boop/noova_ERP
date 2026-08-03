import { useState, useEffect, useCallback } from 'react';
import {
  getFacturas,
  crearFacturaDesdeCotizacion,
  eliminarFactura
} from '../services/facturacionService';

export function useFacturacion() {
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarFacturas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getFacturas();
      setFacturas(data);
      setError(null);
    } catch (err) {
      console.error('Error cargando facturas:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarFacturas();
  }, [cargarFacturas]);

  const addFacturaDesdeCotizacion = useCallback(async (cotizacion, facturaData, empresaData) => {
    const resultado = await crearFacturaDesdeCotizacion(cotizacion, facturaData, empresaData);
    await cargarFacturas();
    return resultado;
  }, [cargarFacturas]);

  const removeFactura = useCallback(async (id) => {
    await eliminarFactura(id);
    await cargarFacturas();
  }, [cargarFacturas]);

  return {
    facturas,
    loading,
    error,
    refrescar: cargarFacturas,
    addFacturaDesdeCotizacion,
    removeFactura
  };
}
