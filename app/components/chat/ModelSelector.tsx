import type { ProviderInfo } from '~/types/model';
import type { ModelInfo } from '~/utils/types';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { getProvidersInitialState } from '~/components/settings/getProvidersInitialState';

interface ModelSelectorProps {
  model?: string;
  setModel?: (model: string) => void;
  provider?: ProviderInfo;
  setProvider?: (provider: ProviderInfo) => void;
  modelList: ModelInfo[];
  providerList: ProviderInfo[];
  apiKeys: Record<string, string>;
}

export const ModelSelector = ({
  model,
  setModel,
  provider,
  setProvider,
  modelList,
  providerList,
}: ModelSelectorProps) => {
  // Load enabled providers from cookies
  const [enabledProviders, setEnabledProviders] = useState(getProvidersInitialState(providerList));

  // Update enabled providers when cookies change
  useEffect(() => {
    // Function to update providers from cookies
    const updateProvidersFromCookies = () => {
      const savedProviders = Cookies.get('providers');

      if (savedProviders) {
        try {
          const parsedProviders = JSON.parse(savedProviders);
          const newEnabledProviders = providerList.filter((p) => parsedProviders[p.name]);
          setEnabledProviders(newEnabledProviders);

          // If current provider is disabled, switch to first enabled provider
          if (provider && !parsedProviders[provider.name] && newEnabledProviders.length > 0) {
            const firstEnabledProvider = newEnabledProviders[0];
            setProvider?.(firstEnabledProvider);

            // Also update the model to the first available one for the new provider
            const firstModel = modelList.find((m) => m.provider === firstEnabledProvider.name);

            if (firstModel) {
              setModel?.(firstModel.name);
            }
          }
        } catch (error) {
          console.error('Failed to parse providers from cookies:', error);
        }
      }
    };

    // Initial update
    updateProvidersFromCookies();

    // Set up an interval to check for cookie changes
    const interval = setInterval(updateProvidersFromCookies, 1000);

    return () => clearInterval(interval);
  }, [providerList, provider, setProvider, modelList, setModel]);

  if (enabledProviders.length === 0) {
    return (
      <div className="mb-2 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary">
        <p className="text-center">
          No providers are currently enabled. Please enable at least one provider in the settings to start using the
          chat.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2 flex gap-2 flex-col sm:flex-row">
      <select
        value={provider?.name ?? ''}
        onChange={(e) => {
          const newProvider = enabledProviders.find((p: ProviderInfo) => p.name === e.target.value);

          if (newProvider && setProvider) {
            setProvider(newProvider);
          }

          const firstModel = [...modelList].find((m) => m.provider === e.target.value);

          if (firstModel && setModel) {
            setModel(firstModel.name);
          }
        }}
        className="flex-1 p-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus transition-all"
      >
        {enabledProviders.map((provider: ProviderInfo) => (
          <option key={provider.name} value={provider.name}>
            {provider.name}
          </option>
        ))}
      </select>
      <select
        key={provider?.name}
        value={model}
        onChange={(e) => setModel?.(e.target.value)}
        className="flex-1 p-2 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-prompt-background text-bolt-elements-textPrimary focus:outline-none focus:ring-2 focus:ring-bolt-elements-focus transition-all lg:max-w-[70%]"
      >
        {[...modelList]
          .filter((e) => e.provider == provider?.name && e.name)
          .map((modelOption, index) => (
            <option key={index} value={modelOption.name}>
              {modelOption.label}
            </option>
          ))}
      </select>
    </div>
  );
};
