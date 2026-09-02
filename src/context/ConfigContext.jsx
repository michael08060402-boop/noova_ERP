import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getConfig as fetchConfig, updateConfig as saveConfig } from '../services/configService';
import { useAuth } from './AuthContext';

const ConfigContext = createContext();

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  const { currentUser, userProfile } = useAuth();
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    if (!currentUser || !userProfile) {
      setConfig(null);
      setConfigError(null);
      setLoadingConfig(false);
      return;
    }
    let mounted = true;

    async function loadConfig() {
      setLoadingConfig(true);
      try {
        const data = await fetchConfig();
        if (mounted) {
          setConfig(data);
          setConfigError(null);
        }
      } catch (err) {
        console.error('Error cargando configuración:', err);
        if (mounted) {
          setConfigError(err);
        }
      } finally {
        if (mounted) {
          setLoadingConfig(false);
        }
      }
    }

    loadConfig();
    return () => {
      mounted = false;
    };
  }, [currentUser, userProfile]);

  async function refreshConfig() {
    setLoadingConfig(true);
    try {
      const latest = await fetchConfig(true);
      setConfig(latest);
      setConfigError(null);
      return latest;
    } catch (err) {
      setConfigError(err);
      return null;
    } finally {
      setLoadingConfig(false);
    }
  }

  async function updateConfig(data) {
    await saveConfig(data);
    setConfig((prevConfig) => ({
      ...prevConfig,
      ...data,
      empresa: { ...prevConfig?.empresa, ...data.empresa },
      cotizacion: { ...prevConfig?.cotizacion, ...data.cotizacion },
      ordenCompra: { ...prevConfig?.ordenCompra, ...data.ordenCompra }
    }));
  }

  const value = useMemo(
    () => ({ config, loadingConfig, configError, refreshConfig, updateConfig }),
    [config, loadingConfig, configError]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
