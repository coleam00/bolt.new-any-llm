import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export class OpenAIProvider extends BaseProvider {
  name = 'OpenAI';
  getApiKeyLink = 'https://platform.openai.com/api-keys';

  config = {
    apiTokenKey: 'OPENAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI', maxTokenAllowed: 8000 },
    { name: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'OpenAI', maxTokenAllowed: 8000 },
    { name: 'gpt-4', label: 'GPT-4', provider: 'OpenAI', maxTokenAllowed: 8000 },
    { name: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'OpenAI', maxTokenAllowed: 8000 },
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
      defaultApiTokenKey: 'OPENAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      apiKey,
    });

    return openai(model);
  }
}
