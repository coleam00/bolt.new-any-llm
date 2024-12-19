import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export class GoogleProvider extends BaseProvider {
  name = 'Google';
  getApiKeyLink = 'https://aistudio.google.com/app/apikey';

  config = {
    apiTokenKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    { name: 'gemini-1.5-flash-latest', label: 'Gemini 1.5 Flash', provider: 'Google', maxTokenAllowed: 8192 },
    { name: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', provider: 'Google', maxTokenAllowed: 8192 },
    { name: 'gemini-1.5-flash-002', label: 'Gemini 1.5 Flash-002', provider: 'Google', maxTokenAllowed: 8192 },
    { name: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8b', provider: 'Google', maxTokenAllowed: 8192 },
    { name: 'gemini-1.5-pro-latest', label: 'Gemini 1.5 Pro', provider: 'Google', maxTokenAllowed: 8192 },
    { name: 'gemini-1.5-pro-002', label: 'Gemini 1.5 Pro-002', provider: 'Google', maxTokenAllowed: 8192 },
    { name: 'gemini-exp-1206', label: 'Gemini exp-1206', provider: 'Google', maxTokenAllowed: 8192 },
  ];

  getModelInstance(options: {
    model: string;
    serverEnv: any;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const google = createGoogleGenerativeAI({
      apiKey,
    });

    return google(model);
  }
}
