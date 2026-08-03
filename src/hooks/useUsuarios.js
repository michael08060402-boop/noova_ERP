import { useState, useEffect, useCallback } from 'react';
import {
  getUsuarios,
  crearUsuario,
  cambiarRolUsuario,
  cambiarDatosUsuario,
  cambiarEstadoUsuario,
  resetearPasswordUsuario
} from '../services/usuarioService';

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsuarios = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsuarios();
      setUsuarios(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching usuarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsuarios();
  }, [fetchUsuarios]);

  const addUsuario = useCallback(async (datos) => {
    setError(null);
    const nuevo = await crearUsuario(datos);
    setUsuarios((prev) => [...prev, nuevo].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')));
    return nuevo;
  }, []);

  const editRol = useCallback(async (uid, role) => {
    setError(null);
    await cambiarRolUsuario(uid, role);
    setUsuarios((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
  }, []);

  const editDatos = useCallback(async (uid, datos) => {
    setError(null);
    await cambiarDatosUsuario(uid, datos);
    setUsuarios((prev) => prev.map((u) => (u.uid === uid ? { ...u, ...datos } : u)));
  }, []);

  const editEstado = useCallback(async (uid, activo) => {
    setError(null);
    await cambiarEstadoUsuario(uid, activo);
    setUsuarios((prev) => prev.map((u) => (u.uid === uid ? { ...u, activo } : u)));
  }, []);

  const resetPassword = useCallback(async (uid, nuevaPassword) => {
    setError(null);
    return resetearPasswordUsuario(uid, nuevaPassword);
  }, []);

  return {
    usuarios,
    loading,
    error,
    fetchUsuarios,
    addUsuario,
    editRol,
    editDatos,
    editEstado,
    resetPassword
  };
}
