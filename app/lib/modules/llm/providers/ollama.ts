import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { ollama } from 'ollama-ai-provider';

interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
}

export interface OllamaApiResponse {
  models: OllamaModel[];
}

export const DEFAULT_NUM_CTX = process?.env?.DEFAULT_NUM_CTX ? parseInt(process.env.DEFAULT_NUM_CTX, 10) : 32768;

export class OllamaProvider extends BaseProvider {
  name = 'Ollama';
  getApiKeyLink = 'https://ollama.com/download';
  labelForGetApiKey = 'Download Ollama';
  icon = 'i-ph:cloud-arrow-down';

  config = {
    baseUrlKey: 'OLLAMA_API_BASE_URL',
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
        defaultBaseUrlKey: 'OLLAMA_API_BASE_URL',
        defaultApiTokenKey: '',
      });

      if (!baseUrl) {
        return [];
      }

      const response = await fetch(`${baseUrl}/api/tags`);
      const data = (await response.json()) as OllamaApiResponse;
      console.log({ ollamamodels: data.models });

      return data.models.map((model: OllamaModel) => ({
        name: model.name,
        label: `${model.name} (${model.details.parameter_size})`,
        provider: this.name,
        maxTokenAllowed: 8000,
      }));
    } catch (e) {
      console.error('Failed to get Ollama models:', e);
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
    const ollamaInstance = ollama(model, {
      numCtx: DEFAULT_NUM_CTX,
    }) as LanguageModelV1 & { config: any };

    ollamaInstance.config.baseURL = `${baseUrl}/api`;

    return ollamaInstance;
  };
}
