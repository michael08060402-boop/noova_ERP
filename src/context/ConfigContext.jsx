import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getConfig as fetchConfig, updateConfig as saveConfig } from '../services/configService';

const ConfigContext = createContext();

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadConfig() {
      try {
        const data = await fetchConfig();
        if (mounted) {
          setConfig(data);
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
  }, []);

  async function refreshConfig() {
    setLoadingConfig(true);
    try {
      const latest = await fetchConfig(true);
      setConfig(latest);
      return latest;
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
      cotizacion: { ...prevConfig?.cotizacion, ...data.cotizacion }
    }));
  }

  const value = useMemo(
    () => ({ config, loadingConfig, configError, refreshConfig, updateConfig }),
    [config, loadingConfig, configError]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}
