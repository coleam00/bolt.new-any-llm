import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { lookupSavedPassword, saveGitAuth, ensureEncryption, removeGitAuth } from '~/lib/auth';
import { gitProviders } from '~/lib/git/providers';

interface ProviderCredentials {
  username: string;
  token: string;
  isConnected: boolean;
  isVerifying: boolean;
}

interface ProviderState {
  [key: string]: ProviderCredentials;
}

export function useGitProviders() {
  const [credentials, setCredentials] = useState<ProviderState>(() => {
    return Object.keys(gitProviders).reduce(
      (acc, key) => ({
        ...acc,
        [key]: { username: '', token: '', isConnected: false, isVerifying: false },
      }),
      {},
    );
  });

  const [expandedProviders, setExpandedProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    initializeEncryption();
  }, []);

  const initializeEncryption = async () => {
    const success = await ensureEncryption();

    if (success) {
      loadSavedCredentials();
    }
  };

  const loadSavedCredentials = async () => {
    for (const [key, plugin] of Object.entries(gitProviders)) {
      const auth = await lookupSavedPassword(plugin.provider.url);

      if (auth?.username && auth?.password) {
        setCredentials((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            username: auth.username || '',
            token: auth.password || '',
            isConnected: true,
          },
        }));
      }
    }
  };

  const handleSaveConnection = async (providerKey: string) => {
    const plugin = gitProviders[providerKey];

    if (!plugin) {
      return;
    }

    const { username, token } = credentials[providerKey];

    if (!username || !token) {
      toast.error(`Please provide both ${plugin.provider.title} username and token`);
      return;
    }

    setCredentials((prev) => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], isVerifying: true },
    }));

    try {
      const isValid = await plugin.api.validateCredentials(username, token);

      if (isValid) {
        await saveGitAuth(plugin.provider.url, { username, password: token });
        setCredentials((prev) => ({
          ...prev,
          [providerKey]: {
            ...prev[providerKey],
            isConnected: true,
            isVerifying: false,
          },
        }));
        toast.success(`${plugin.provider.title} credentials verified and saved successfully!`);
      } else {
        setCredentials((prev) => ({
          ...prev,
          [providerKey]: {
            ...prev[providerKey],
            isConnected: false,
            isVerifying: false,
          },
        }));
        toast.error(`Invalid ${plugin.provider.title} credentials. Please check your username and token.`);
      }
    } catch (error) {
      setCredentials((prev) => ({
        ...prev,
        [providerKey]: {
          ...prev[providerKey],
          isConnected: false,
          isVerifying: false,
        },
      }));
      console.error(`Error validating ${plugin.provider.title} credentials:`, error);
      toast.error(`Error validating ${plugin.provider.title} credentials`);
    }
  };

  const handleDisconnect = async (providerKey: string) => {
    const plugin = gitProviders[providerKey];

    if (!plugin) {
      return;
    }

    await removeGitAuth(plugin.provider.url);
    setCredentials((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        username: '',
        token: '',
        isConnected: false,
      },
    }));
  };

  const updateProviderCredentials = (providerKey: string, updates: { username?: string; token?: string }) => {
    setCredentials((prev) => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], ...updates },
    }));
  };

  const toggleProvider = (providerKey: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [providerKey]: !prev[providerKey],
    }));
  };

  return {
    providers: gitProviders,
    credentials,
    expandedProviders,
    handleSaveConnection,
    handleDisconnect,
    updateProviderCredentials,
    toggleProvider,
  };
}
