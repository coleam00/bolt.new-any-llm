import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createCohere } from '@ai-sdk/cohere';

export class CohereProvider extends BaseProvider {
  name = 'Cohere';
  getApiKeyLink = 'https://dashboard.cohere.com/api-keys';

  config = {
    apiTokenKey: 'COHERE_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'command-r-plus-08-2024', label: 'Command R plus Latest', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'command-r-08-2024', label: 'Command R Latest', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'command-r-plus', label: 'Command R plus', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'command-r', label: 'Command R', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'command', label: 'Command', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'command-nightly', label: 'Command Nightly', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'command-light', label: 'Command Light', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'command-light-nightly', label: 'Command Light Nightly', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'c4ai-aya-expanse-8b', label: 'c4AI Aya Expanse 8b', provider: 'Cohere', maxTokenAllowed: 4096 },
    { name: 'c4ai-aya-expanse-32b', label: 'c4AI Aya Expanse 32b', provider: 'Cohere', maxTokenAllowed: 4096 },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'COHERE_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const cohere = createCohere({
      apiKey,
    });

    return cohere(model);
  }
}
