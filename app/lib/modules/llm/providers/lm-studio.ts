import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModelV1 } from 'ai';

export class LMStudioProvider extends BaseProvider {
  name = 'LMStudio';
  getApiKeyLink = 'https://lmstudio.ai/';
  labelForGetApiKey = 'Get LMStudio';
  icon = 'i-ph:cloud-arrow-down';

  config = {
    baseUrlKey: 'LMSTUDIO_API_BASE_URL',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    try {
      const { baseUrl } = this.getProviderBaseUrlAndKey({
        apiKeys,
        providerSettings: settings,
        serverEnv,
        defaultBaseUrlKey: 'LMSTUDIO_API_BASE_URL',
        defaultApiTokenKey: '',
      });

      if (!baseUrl) {
        return [];
      }

      const response = await fetch(`${baseUrl}/v1/models`);
      const data = (await response.json()) as { data: Array<{ id: string }> };

      return data.data.map((model) => ({
        name: model.id,
        label: model.id,
        provider: this.name,
        maxTokenAllowed: 8000,
      }));
    } catch (error: any) {
      console.log('Error getting LMStudio models:', error.message);

      return [];
    }
  }
  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModelV1 = (options) => {
    const { apiKeys, providerSettings, serverEnv, model } = options;
    const { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: 'OLLAMA_API_BASE_URL',
      defaultApiTokenKey: '',
    });
    const lmstudio = createOpenAI({
      baseUrl: `${baseUrl}/v1`,
      apiKey: '',
    });

    return lmstudio(model);
  };
}
