import React, { useState, useEffect, useCallback } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { ProviderInfo } from '~/types/model';
import { getApiKey, setApiKey as persistApiKey, apiKeysStore } from '~/lib/stores/apiKeys';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';

interface APIKeyManagerProps {
  provider: ProviderInfo;
  apiKey: string;
  setApiKey: (key: string) => void;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
}

export const APIKeyManager: React.FC<APIKeyManagerProps> = ({ 
  provider, 
  apiKey, 
  setApiKey,
  getApiKeyLink,
  labelForGetApiKey 
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [tempKey, setTempKey] = useState<string>(apiKey);
  const [statusInfo, setStatusInfo] = useState<string>('');
  const storedKeys = useStore(apiKeysStore);

  const loadSavedApiKey = useCallback(async () => {
    try {
      const savedKey = await getApiKey(provider.name);
      if (savedKey) {
        setApiKey(savedKey);
        setTempKey(savedKey);
        setStatusInfo(`API Key caricata dallo store locale`);
      } else {
        setStatusInfo(apiKey ? 'API Key presente in .env' : 'API Key non impostata');
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
      setStatusInfo('Errore nel caricamento della API Key');
      toast.error('Errore nel caricamento della API Key');
    }
  }, [provider.name, setApiKey, apiKey]);

  useEffect(() => {
    void loadSavedApiKey();
  }, [loadSavedApiKey]);

  const handleSave = async () => {
    try {
      await persistApiKey(provider.name, tempKey);
      setApiKey(tempKey);
      setIsEditing(false);
      setStatusInfo('API Key salvata nello store locale');
      toast.success('API Key salvata con successo');
    } catch (error) {
      console.error('Failed to save API key:', error);
      setStatusInfo('Errore nel salvataggio della API Key');
      toast.error('Errore nel salvataggio della API Key');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setTempKey(apiKey);
  };

  const showTestInfo = () => {
    const storeInfo = storedKeys[provider.name] 
      ? 'Presente nello store' 
      : 'Non presente nello store';
    const envInfo = apiKey && !storedKeys[provider.name] 
      ? 'Presente in .env' 
      : 'Non presente in .env';
    alert(`Test API Key:\n\nStato: ${statusInfo}\nStore locale: ${storeInfo}\nEnvironment: ${envInfo}`);
  };

  return (
    <div className="flex items-start sm:items-center mt-2 mb-2 flex-col sm:flex-row">
      <div>
        <span className="text-sm text-bolt-elements-textSecondary">
          {provider.name} API Key:
          <button 
            onClick={showTestInfo}
            className="ml-2 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
            title="Testa lo stato della API Key"
            type="button"
          >
            [test]
          </button>
        </span>
        {!isEditing && (
          <div className="flex items-center mb-4">
            <span className="flex-1 text-xs text-bolt-elements-textPrimary mr-2">
              {apiKey ? '••••••••' : 'Not set (will still work if set in .env file)'}
            </span>
            <IconButton onClick={() => setIsEditing(true)} title="Edit API Key">
              <div className="i-ph:pencil-simple" />
            </IconButton>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-3 mt-2">
          <input
            type="password"
            value={tempKey}
            placeholder="Your API Key"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempKey(e.target.value)}
            className="flex-1 px-2 py-1 text-xs lg:text-sm rounded border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus"
          />
          <IconButton onClick={() => void handleSave()} title="Save API Key">
            <div className="i-ph:check" />
          </IconButton>
          <IconButton onClick={handleCancel} title="Cancel">
            <div className="i-ph:x" />
          </IconButton>
        </div>
      ) : (
        <>
          {getApiKeyLink && (
            <IconButton className="ml-auto" onClick={() => window.open(getApiKeyLink)} title="Get API Key">
              <span className="mr-2 text-xs lg:text-sm">{labelForGetApiKey || 'Get API Key'}</span>
              <div className={provider.icon || 'i-ph:key'} />
            </IconButton>
          )}
        </>
      )}
      <div className="text-xs text-bolt-elements-textSecondary mt-1">
        {statusInfo}
      </div>
    </div>
  );
};
