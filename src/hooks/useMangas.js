import { useState, useEffect, useCallback } from 'react';
import {
  getMangas,
  getMangaById,
  searchMangaByCodigo,
  createManga,
  updateManga,
  deleteManga
} from '../services/mangaService';

export function useMangas() {
  const [mangas, setMangas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMangas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMangas();
      setMangas(data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching mangas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMangas();
  }, [fetchMangas]);

  const addManga = useCallback(async (data) => {
    try {
      setError(null);
      const id = await createManga(data);
      setMangas((prev) => [...prev, { id, ...data, createdAt: new Date().toISOString() }]);
      return id;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const editManga = useCallback(async (id, data) => {
    try {
      setError(null);
      await updateManga(id, data);
      setMangas((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...data, updatedAt: new Date().toISOString() } : m))
      );
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeManga = useCallback(async (id) => {
    try {
      setError(null);
      await deleteManga(id);
      setMangas((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const getManga = useCallback(async (id) => {
    try {
      return await getMangaById(id);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const searchByCodigo = useCallback(async (codigo) => {
    try {
      return await searchMangaByCodigo(codigo);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    mangas,
    loading,
    error,
    fetchMangas,
    addManga,
    editManga,
    removeManga,
    getManga,
    searchByCodigo
  };
}
