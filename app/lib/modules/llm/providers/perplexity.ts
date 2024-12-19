import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export class PerplexityProvider extends BaseProvider {
  name = 'Perplexity';
  getApiKeyLink = 'https://www.perplexity.ai/settings/api';

  config = {
    apiTokenKey: 'PERPLEXITY_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'llama-3.1-sonar-small-128k-online',
      label: 'Sonar Small Online',
      provider: 'Perplexity',
      maxTokenAllowed: 8192,
    },
    {
      name: 'llama-3.1-sonar-large-128k-online',
      label: 'Sonar Large Online',
      provider: 'Perplexity',
      maxTokenAllowed: 8192,
    },
    {
      name: 'llama-3.1-sonar-huge-128k-online',
      label: 'Sonar Huge Online',
      provider: 'Perplexity',
      maxTokenAllowed: 8192,
    },
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
      defaultApiTokenKey: 'PERPLEXITY_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const perplexity = createOpenAI({
      baseURL: 'https://api.perplexity.ai/',
      apiKey,
    });

    return perplexity(model);
  }
}
